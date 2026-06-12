import logging
import os
import threading
import time
from concurrent.futures import Future, ThreadPoolExecutor
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from system.core.alert_manager import AlertManager
from system.core.fusion import FusionEngine
from system.core.safety_rules import RiskEngine
from system.core.types import CrowdFrame, DensityMap
from system.models.csrnet_model import CSRNetEstimator
from system.models.yolo_model import YOLOv8Detector
from system.services.db_service import DBService


logger = logging.getLogger(__name__)


class CrowdMonitoringService:
    """Owns model, camera, inference, tracking, alert, and frame lifecycle state."""

    def __init__(self) -> None:
        self.detector: Optional[YOLOv8Detector] = None
        self.model_error: Optional[str] = None
        self.estimator: Optional[CSRNetEstimator] = None
        self.fusion = FusionEngine()
        self.risk_engine = RiskEngine(base_capacity=50)
        self.alert_manager = AlertManager()
        self.db = DBService()

        self.video_source: int | str = 0
        self.monitoring_enabled = False
        self.heatmap_enabled = False
        self.latest_frame: Optional[CrowdFrame] = None
        self.processing_fps = 0.0

        self.frame_lock = threading.RLock()
        self._lifecycle_lock = threading.RLock()
        self._worker_thread: Optional[threading.Thread] = None
        self._worker_stop: Optional[threading.Event] = None
        self._capture: Optional[cv2.VideoCapture] = None

        self.csrnet_enabled = os.getenv("ENABLE_CSRNET", "false").lower() == "true"
        self.csrnet_interval = max(1, int(os.getenv("CSRNET_FRAME_INTERVAL", "5")))
        self._latest_density_map: Optional[DensityMap] = None
        self._csrnet_executor = ThreadPoolExecutor(
            max_workers=1, thread_name_prefix="csrnet-worker"
        )
        self._csrnet_future: Optional[Future[DensityMap]] = None

    def initialize(self) -> None:
        logger.info("Initializing inference models")
        env_path = os.getenv("YOLO_MODEL_PATH")
        if env_path:
            resolved_path = env_path if Path(env_path).is_file() else None
        else:
            candidates = [
                "best.pt",
                "runs/detect/yolov8m_crowdhuman-3/weights/best.pt",
                "yolov8m.pt",
            ]
            resolved_path = None
            for path in candidates:
                if Path(path).is_file():
                    resolved_path = path
                    break

        if not resolved_path:
            self.model_error = (
                f"YOLO weights were not found at {env_path or 'default candidate paths'}. "
                "Set YOLO_MODEL_PATH to a valid .pt file."
            )
            logger.error(self.model_error)
            return
        try:
            self.detector = YOLOv8Detector(model_path=resolved_path)
            self.model_error = None
        except Exception as exc:
            self.model_error = f"YOLO model initialization failed: {exc}"
            logger.exception(self.model_error)
            return

        if self.csrnet_enabled:
            self.estimator = CSRNetEstimator()

    def shutdown(self) -> None:
        self.stop_monitoring()
        self._csrnet_executor.shutdown(wait=False, cancel_futures=True)
        self.db.dispose()

    def start_monitoring(self) -> bool:
        with self._lifecycle_lock:
            if self._worker_thread and self._worker_thread.is_alive():
                self.monitoring_enabled = True
                return True
            if self.detector is None:
                raise RuntimeError(
                    self.model_error or "Inference models are not initialized"
                )

            capture = cv2.VideoCapture(self.video_source)
            if not capture.isOpened():
                capture.release()
                self.monitoring_enabled = False
                logger.error("Unable to open video source %r", self.video_source)
                return False

            self.detector.reset_tracker()
            self.risk_engine.reset()
            self.alert_manager.reset()
            self._latest_density_map = None
            self._csrnet_future = None

            stop_event = threading.Event()
            self._capture = capture
            self._worker_stop = stop_event
            self.monitoring_enabled = True
            self._worker_thread = threading.Thread(
                target=self._processing_worker,
                args=(capture, stop_event),
                name="crowd-inference-worker",
                daemon=True,
            )
            self._worker_thread.start()
            return True

    def stop_monitoring(self) -> None:
        with self._lifecycle_lock:
            self.monitoring_enabled = False
            stop_event = self._worker_stop
            worker = self._worker_thread
            capture = self._capture
            if stop_event:
                stop_event.set()

        if worker and worker.is_alive():
            worker.join(timeout=5.0)
            if worker.is_alive() and capture:
                logger.warning("Inference worker did not stop in time; releasing capture")
                capture.release()
                worker.join(timeout=2.0)

        with self._lifecycle_lock:
            if self._worker_thread is worker:
                self._worker_thread = None
                self._worker_stop = None
                self._capture = None

    def set_source(self, source_type: str, filename: Optional[str]) -> int | str:
        if source_type == "live":
            new_source: int | str = 0
        elif source_type == "video":
            if not filename:
                raise ValueError("A video filename is required")
            safe_name = Path(filename).name
            if safe_name != filename:
                raise ValueError("Invalid video filename")
            path = Path("data/videos") / safe_name
            if path.suffix.lower() != ".mp4" or not path.is_file():
                raise FileNotFoundError("Video file was not found")
            new_source = str(path)
        else:
            raise ValueError("source_type must be 'live' or 'video'")

        with self._lifecycle_lock:
            was_running = bool(
                self._worker_thread and self._worker_thread.is_alive()
            )
        if was_running:
            self.stop_monitoring()
        self.video_source = new_source
        if was_running and not self.start_monitoring():
            raise RuntimeError("The selected source could not be opened")
        return self.video_source

    def set_capacity(self, capacity: int) -> None:
        with self.frame_lock:
            self.risk_engine.base_capacity = capacity

    def set_brightness_threshold(self, threshold: float) -> None:
        if self.detector is None:
            raise RuntimeError("Detector is not initialized")
        with self.frame_lock:
            self.detector.brightness_threshold = threshold

    def snapshot_stats(self) -> dict:
        with self.frame_lock:
            if not self.monitoring_enabled:
                return {
                    "count": 0,
                    "risk": "STANDBY",
                    "risk_score": 0.0,
                    "brightness": 0.0,
                    "fps": 0.0,
                    "base_capacity": self.risk_engine.base_capacity,
                    "dynamic_capacity": self.risk_engine.base_capacity,
                }
            if not self.latest_frame:
                return {
                    "count": 0,
                    "risk": "INITIALIZING",
                    "risk_score": 0.0,
                    "brightness": 0.0,
                    "fps": self.processing_fps,
                    "base_capacity": self.risk_engine.base_capacity,
                    "dynamic_capacity": self.risk_engine.base_capacity,
                }
            return {
                "count": self.latest_frame.estimated_count,
                "risk": self.latest_frame.risk_level.value,
                "risk_score": self.latest_frame.risk_score,
                "brightness": getattr(self.detector, "last_brightness", 0.0),
                "fps": self.processing_fps,
                "base_capacity": self.risk_engine.base_capacity,
                "dynamic_capacity": self.latest_frame.dynamic_capacity,
            }

    def render_latest_frame(self) -> bytes:
        with self.frame_lock:
            monitoring = self.monitoring_enabled
            frame = self.latest_frame
            heatmap_enabled = self.heatmap_enabled
            detector = self.detector

        if not monitoring:
            image = np.zeros((480, 640, 3), dtype=np.uint8)
            image[:, :] = [22, 13, 9]
            cv2.putText(
                image, "MONITORING STANDBY", (140, 230),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (120, 102, 241), 2, cv2.LINE_AA
            )
        elif frame is None or frame.raw_image is None:
            image = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(
                image, "System Initializing...", (140, 240),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA
            )
        else:
            image = frame.raw_image.copy()
            if heatmap_enabled and frame.density_map is not None:
                heat_map = frame.density_map.heat_map
                if heat_map.size and float(heat_map.max()) > 0:
                    resized = cv2.resize(
                        heat_map, (image.shape[1], image.shape[0]),
                        interpolation=cv2.INTER_LINEAR,
                    )
                    normalized = cv2.normalize(
                        resized, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U
                    )
                    colored = cv2.applyColorMap(normalized, cv2.COLORMAP_JET)
                    image = cv2.addWeighted(image, 0.6, colored, 0.4, 0)

            for detection in frame.detections:
                color = (0, 255, 0) if detection.status == "accepted" else (0, 140, 255)
                if frame.risk_score > 0.8 and detection.status == "accepted":
                    color = (0, 0, 255)
                cv2.rectangle(
                    image,
                    (detection.x1, detection.y1),
                    (detection.x2, detection.y2),
                    color,
                    2 if detection.status == "accepted" else 1,
                )
                track = f"ID:{detection.track_id} " if detection.track_id is not None else ""
                label = f"{track}{detection.status.upper()} {detection.confidence:.2f}"
                cv2.putText(
                    image, label, (detection.x1, max(15, detection.y1 - 5)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1, cv2.LINE_AA
                )

            cv2.putText(
                image,
                f"Count: {frame.estimated_count}  Risk: {frame.risk_level.value}",
                (20, 35),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                (255, 255, 255),
                2,
                cv2.LINE_AA,
            )
            if detector:
                cv2.putText(
                    image,
                    f"Inference: {detector.last_inference_time:.1f} ms",
                    (20, 60),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.45,
                    (220, 220, 220),
                    1,
                    cv2.LINE_AA,
                )

        ok, buffer = cv2.imencode(".jpg", image)
        if not ok:
            raise RuntimeError("JPEG encoding failed")
        return buffer.tobytes()

    def _processing_worker(
        self, capture: cv2.VideoCapture, stop_event: threading.Event
    ) -> None:
        assert self.detector is not None
        frame_id = 0
        resolution_scale = 1.0
        logger.info("Inference worker started for source %r", self.video_source)
        try:
            while not stop_event.is_set():
                ok, frame = capture.read()
                if not ok:
                    if isinstance(self.video_source, str):
                        capture.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    else:
                        stop_event.wait(0.1)
                    continue

                started = time.perf_counter()
                try:
                    height, width = frame.shape[:2]
                    if resolution_scale < 1.0:
                        frame = cv2.resize(
                            frame,
                            (int(width * resolution_scale), int(height * resolution_scale)),
                        )

                    detections = self.detector.detect(
                        frame, is_video=isinstance(self.video_source, str)
                    )
                    density_map = self._density_for_frame(frame_id, frame, detections)
                    crowd_frame = self.fusion.fuse(
                        frame_id, frame, detections, density_map
                    )
                    crowd_frame.timestamp = time.time()
                    crowd_frame = self.risk_engine.evaluate_risk(crowd_frame)

                    alert = self.alert_manager.check_alert(crowd_frame)
                    if alert:
                        logger.warning(alert)
                        self.db.log_event(
                            crowd_frame.risk_level.value,
                            crowd_frame.estimated_count,
                            alert,
                        )

                    crowd_frame.raw_image = frame.copy()
                    with self.frame_lock:
                        self.latest_frame = crowd_frame

                    elapsed_ms = (time.perf_counter() - started) * 1000
                    current_fps = 1000.0 / elapsed_ms if elapsed_ms > 0 else 0.0
                    self.processing_fps = (
                        current_fps
                        if self.processing_fps == 0
                        else (self.processing_fps * 0.8) + (current_fps * 0.2)
                    )
                    if elapsed_ms > 45:
                        resolution_scale = max(0.5, resolution_scale - 0.05)
                    elif elapsed_ms < 30:
                        resolution_scale = min(1.0, resolution_scale + 0.02)
                    self.detector.resolution_scale = resolution_scale
                    frame_id += 1
                    stop_event.wait(0.01)
                except Exception:
                    logger.exception("Frame processing failed")
                    stop_event.wait(0.1)
        finally:
            capture.release()
            logger.info("Inference worker stopped")

    def _density_for_frame(
        self,
        frame_id: int,
        frame: np.ndarray,
        detections: Optional[List[Detection]] = None,
    ) -> Optional[DensityMap]:
        if not self.csrnet_enabled or self.estimator is None:
            return None

        if self._csrnet_future and self._csrnet_future.done():
            try:
                self._latest_density_map = self._csrnet_future.result()
            except Exception:
                logger.exception("Asynchronous CSRNet inference failed")
            finally:
                self._csrnet_future = None

        if (
            frame_id % self.csrnet_interval == 0
            and self._csrnet_future is None
        ):
            # Copy because the capture/inference loop reuses its frame buffer.
            csrnet_frame = frame.copy()
            self._csrnet_future = self._csrnet_executor.submit(
                self.estimator.estimate, csrnet_frame, detections
            )

        return self._latest_density_map
