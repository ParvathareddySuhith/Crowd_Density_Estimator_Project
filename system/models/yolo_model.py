import numpy as np
import cv2
import time
import os
from typing import List
from ultralytics import YOLO
from system.models.base_model import PersonDetector
from system.core.types import Detection

class DetectionTracker:
    def __init__(self, iou_threshold: float = 0.20, max_missed: int = 2):
        self.iou_threshold = iou_threshold
        self.max_missed = max_missed
        self.tracks = [] # List of dict: {"box": (x1, y1, x2, y2), "consecutive_frames": int, "missed_frames": int, "stable": bool}

    def _calculate_iou(self, boxA, boxB):
        xA = max(boxA[0], boxB[0])
        yA = max(boxA[1], boxB[1])
        xB = min(boxA[2], boxB[2])
        yB = min(boxA[3], boxB[3])

        interArea = max(0, xB - xA) * max(0, yB - yA)
        if interArea == 0:
            return 0.0

        boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
        boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])
        unionArea = float(boxAArea + boxBArea - interArea)
        
        if unionArea == 0:
            return 0.0
        return interArea / unionArea

    def update(self, current_detections: List[Detection], bypass_stabilization: bool = False) -> List[Detection]:
        updated_tracks = []
        matched_detections = set()

        # Initialize all current detections as rejected/stabilizing (unless bypassed)
        for det in current_detections:
            if bypass_stabilization:
                det.status = "accepted"
                det.reason = ""
            else:
                det.status = "rejected"
                det.reason = "stabilizing (1/3f)"

        # Update existing tracks with closest matching detection
        for track in self.tracks:
            best_iou = 0.0
            best_det_idx = -1
            for idx, det in enumerate(current_detections):
                if idx in matched_detections:
                    continue
                det_box = (det.x1, det.y1, det.x2, det.y2)
                iou = self._calculate_iou(track["box"], det_box)
                if iou > best_iou:
                    best_iou = iou
                    best_det_idx = idx

            if best_iou >= self.iou_threshold and best_det_idx != -1:
                matched_detections.add(best_det_idx)
                det = current_detections[best_det_idx]
                
                track["box"] = (det.x1, det.y1, det.x2, det.y2)
                track["consecutive_frames"] += 1
                track["missed_frames"] = 0
                if bypass_stabilization or track["consecutive_frames"] >= 3:
                    track["stable"] = True
                
                # Assign status and reason directly to the matched detection
                if track["stable"]:
                    det.status = "accepted"
                    det.reason = ""
                else:
                    det.status = "rejected"
                    det.reason = f"stabilizing ({track['consecutive_frames']}/3f)"
                    
                updated_tracks.append(track)
            else:
                track["missed_frames"] += 1
                if track["missed_frames"] <= self.max_missed:
                    updated_tracks.append(track)

        # Create new tracks for unmatched detections
        for idx, det in enumerate(current_detections):
            if idx not in matched_detections:
                stable_init = True if bypass_stabilization else False
                updated_tracks.append({
                    "box": (det.x1, det.y1, det.x2, det.y2),
                    "consecutive_frames": 1,
                    "missed_frames": 0,
                    "stable": stable_init
                })
                if bypass_stabilization:
                    det.status = "accepted"
                    det.reason = ""

        self.tracks = updated_tracks
        return current_detections

class YOLOv8Detector(PersonDetector):
    def __init__(self, model_path: str = "runs/detect/yolov8m_crowdhuman-3/weights/best.pt", conf_threshold: float = 0.40, use_bytetrack: bool = True, brightness_threshold: float = 80.0):
        self.model = None
        self.conf_threshold = conf_threshold
        self.use_bytetrack = use_bytetrack
        self.tracker = DetectionTracker()
        self.last_inference_time = 0.0
        self.last_brightness = 0.0
        self.brightness_threshold = brightness_threshold
        
        # Automatic device detection (GPU/MPS/CPU)
        import torch
        if torch.cuda.is_available():
            self.device = "cuda"
        elif torch.backends.mps.is_available():
            self.device = "mps"
        else:
            self.device = "cpu"
        print(f"YOLO detector initialized using device: {self.device}")
        
        # ByteTrack specific variables
        self.track_history = {} # track_id -> dict
        self.active_tracks = 0
        self.new_tracks = 0
        self.lost_tracks = 0
        self.avg_track_age = 0.0
        
        curr_dir = os.path.dirname(os.path.abspath(__file__))
        self.tracker_config_path = os.path.join(curr_dir, "bytetrack_custom.yaml")
        
        self.load_model(model_path)

    def load_model(self, model_path: str) -> None:
        resolved_path = None
        if model_path and os.path.isfile(model_path):
            resolved_path = model_path
        elif os.getenv("YOLO_MODEL_PATH") and os.path.isfile(os.getenv("YOLO_MODEL_PATH", "")):
            resolved_path = os.getenv("YOLO_MODEL_PATH")
        else:
            candidates = [
                "best.pt",
                "runs/detect/yolov8m_crowdhuman-3/weights/best.pt",
                "yolov8m.pt",
            ]
            for path in candidates:
                if os.path.isfile(path):
                    resolved_path = path
                    break
        
        if not resolved_path:
            raise FileNotFoundError(f"No valid YOLO model weights found for path: {model_path}")

        try:
            print(f"Loading YOLO model from {resolved_path}...")
            self.model = YOLO(resolved_path)
            print("YOLO model loaded successfully.")
        except Exception as e:
            print(f"Error loading YOLO model: {e}")
            raise e

    def reset_tracker(self):
        print("Resetting temporal detection tracker and ByteTrack trackers.")
        self.tracker = DetectionTracker()
        self.track_history = {}
        self.active_tracks = 0
        self.new_tracks = 0
        self.lost_tracks = 0
        self.avg_track_age = 0.0
        if hasattr(self.model, 'predictor') and self.model.predictor and hasattr(self.model.predictor, 'trackers') and self.model.predictor.trackers:
            for tracker in self.model.predictor.trackers:
                try:
                    tracker.reset()
                except Exception as e:
                    print(f"Error resetting ultralytics tracker: {e}")

    def detect(self, frame: np.ndarray, is_video: bool = False) -> List[Detection]:
        if self.model is None:
            return []
        
        # --- 1. Image Enhancement Pipeline before Inference ---
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        
        # Calculate brightness (mean of L channel)
        self.last_brightness = float(l.mean())
        
        # Apply contrast enhancement and denoising ONLY if in low-light conditions (< threshold)
        if self.last_brightness < self.brightness_threshold:
            # A. CLAHE Contrast Enhancement
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            l_enhanced = clahe.apply(l)
            enhanced = cv2.merge((l_enhanced, a, b))
            frame_enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
            
            # B. Gamma Correction (gamma = 1.5)
            gamma = 1.5
            table = np.array([((i / 255.0) ** (1.0 / gamma)) * 255 for i in np.arange(256)]).astype("uint8")
            frame_enhanced = cv2.LUT(frame_enhanced, table)
            
            # C. Noise Reduction (denoising - optimized parameters for speed)
            inference_frame = cv2.fastNlMeansDenoisingColored(frame_enhanced, None, 10, 10, 5, 11)
        else:
            inference_frame = frame
        
        current_conf = self.conf_threshold if is_video else 0.25
        current_time = time.time()
        
        if self.use_bytetrack:
            # --- 2. YOLO inference with ByteTrack ---
            start_time = time.time()
            results = self.model.track(
                inference_frame,
                persist=True,
                tracker=self.tracker_config_path,
                imgsz=1280,
                conf=current_conf,
                iou=0.45,
                classes=[0],
                verbose=False,
                device=self.device
            )
            self.last_inference_time = (time.time() - start_time) * 1000.0
            
            detections = []
            current_tids = set()
            
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    cls_id = int(box.cls[0])
                    if cls_id == 0: 
                        conf = float(box.conf[0])
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        track_id = int(box.id[0]) if (box.id is not None and len(box.id) > 0) else None
                        
                        width = x2 - x1
                        height = y2 - y1
                        det = Detection(
                            x1=x1, y1=y1, x2=x2, y2=y2,
                            confidence=conf,
                            class_id=cls_id,
                            status="accepted",
                            reason="",
                            track_id=track_id
                        )
                        
                        # Apply size validation rules
                        MIN_WIDTH = 15
                        MIN_HEIGHT = 30
                        if width < MIN_WIDTH:
                            det.status = "rejected"
                            det.reason = f"narrow ({width}px)"
                        elif height < MIN_HEIGHT:
                            det.status = "rejected"
                            det.reason = f"short ({height}px)"
                        
                        # Calculate Position, Velocity, Direction and Position History
                        if det.status == "accepted" and track_id is not None:
                            current_tids.add(track_id)
                            cx = (x1 + x2) / 2.0
                            cy = (y1 + y2) / 2.0
                            det.position = (cx, cy)
                            
                            if track_id in self.track_history:
                                prev = self.track_history[track_id]
                                dt = current_time - prev["last_time"]
                                
                                # Position History: append and cap at 30
                                hist = list(prev.get("history_positions", []))
                                hist.append((cx, cy))
                                if len(hist) > 30:
                                    hist.pop(0)
                                    
                                if dt > 0.0:
                                    dx = cx - prev["last_position"][0]
                                    dy = cy - prev["last_position"][1]
                                    vx = dx / dt
                                    vy = dy / dt
                                    speed = float(np.sqrt(vx**2 + vy**2))
                                    dir_x = float(vx / speed) if speed > 0.0 else 0.0
                                    dir_y = float(dy / speed) if speed > 0.0 else 0.0
                                else:
                                    vx, vy = prev.get("velocity", (0.0, 0.0))
                                    speed = prev.get("speed", 0.0)
                                    dir_x, dir_y = prev.get("direction", (0.0, 0.0))
                                    
                                self.track_history[track_id].update({
                                    "last_position": (cx, cy),
                                    "last_time": current_time,
                                    "last_seen_time": current_time,
                                    "velocity": (vx, vy),
                                    "speed": speed,
                                    "direction": (dir_x, dir_y),
                                    "history_positions": hist,
                                    "frames_seen": prev.get("frames_seen", 0) + 1
                                })
                            else:
                                vx, vy = 0.0, 0.0
                                speed = 0.0
                                dir_x, dir_y = 0.0, 0.0
                                hist = [(cx, cy)]
                                self.track_history[track_id] = {
                                    "last_position": (cx, cy),
                                    "last_time": current_time,
                                    "last_seen_time": current_time,
                                    "first_seen_time": current_time,
                                    "velocity": (vx, vy),
                                    "speed": speed,
                                    "direction": (dir_x, dir_y),
                                    "history_positions": hist,
                                    "frames_seen": 1
                                }
                            
                            det.velocity = (vx, vy)
                            det.speed = speed
                            det.direction = (dir_x, dir_y)
                            det.history_positions = list(hist)
                        
                        detections.append(det)
            
            # Compute tracking statistics
            self.active_tracks = len(current_tids)
            self.new_tracks = len([tid for tid in current_tids if self.track_history.get(tid, {}).get("frames_seen", 0) == 1])
            self.lost_tracks = len([tid for tid, t in self.track_history.items() if tid not in current_tids])
            
            track_ages = [current_time - t["first_seen_time"] for t in self.track_history.values()]
            self.avg_track_age = sum(track_ages) / len(track_ages) if track_ages else 0.0
            
            # Prune dead tracks (not seen for > 2 seconds)
            dead_threshold = 2.0
            dead_tracks = [tid for tid, t in self.track_history.items() if current_time - t["last_seen_time"] > dead_threshold]
            for tid in dead_tracks:
                del self.track_history[tid]
                
            return detections
            
        else:
            # --- Legacy detection and custom tracker rollback fallback ---
            start_time = time.time()
            results = self.model(inference_frame, imgsz=1280, conf=current_conf, iou=0.45, classes=[0], verbose=False, device=self.device)
            self.last_inference_time = (time.time() - start_time) * 1000.0
            
            # Reset tracking statistics properties for legacy mode
            self.active_tracks = 0
            self.new_tracks = 0
            self.lost_tracks = 0
            self.avg_track_age = 0.0
            
            detections = []
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    cls_id = int(box.cls[0])
                    if cls_id == 0: 
                        conf = float(box.conf[0])
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        
                        width = x2 - x1
                        height = y2 - y1
                        det = Detection(
                            x1=x1, y1=y1, x2=x2, y2=y2,
                            confidence=conf,
                            class_id=cls_id,
                            status="accepted",
                            reason=""
                        )
                        
                        MIN_WIDTH = 15
                        MIN_HEIGHT = 30
                        if width < MIN_WIDTH:
                            det.status = "rejected"
                            det.reason = f"narrow ({width}px)"
                        elif height < MIN_HEIGHT:
                            det.status = "rejected"
                            det.reason = f"short ({height}px)"
                            
                        detections.append(det)
            
            candidates = [d for d in detections if d.status == "accepted"]
            pre_rejected = [d for d in detections if d.status == "rejected"]
            tracked_candidates = self.tracker.update(candidates, bypass_stabilization=is_video)
            
            return pre_rejected + tracked_candidates
