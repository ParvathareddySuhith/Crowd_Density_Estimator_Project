import asyncio
import logging
import os
import re
import tempfile
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, File, HTTPException, Response, UploadFile, WebSocket
from fastapi import WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from system.services.app_service import CrowdMonitoringService


logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)

VIDEO_DIR = Path("data/videos")
FRONTEND_DIST = Path("frontend/dist")
MAX_UPLOAD_BYTES = int(os.getenv("MAX_VIDEO_UPLOAD_MB", "250")) * 1024 * 1024
ALLOWED_VIDEO_CONTENT_TYPES = {
    "video/mp4",
    "application/mp4",
    "application/octet-stream",
}
SAFE_FILENAME = re.compile(r"[^A-Za-z0-9._-]+")

monitoring_service = CrowdMonitoringService()


@asynccontextmanager
async def lifespan(_: FastAPI):
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    await asyncio.to_thread(monitoring_service.initialize)
    print("\n" + "=" * 65)
    print(" 🚀 CROWD DENSITY ESTIMATOR SERVER STARTED SUCCESSFULLY!")
    print(" 👉 Monitor Dashboard: http://localhost:8000/monitor")
    print(" 👉 System Landing Page: http://localhost:8000/")
    print("=" * 65 + "\n")
    try:
        yield
    finally:
        await asyncio.to_thread(monitoring_service.shutdown)


app = FastAPI(
    title="Crowd Density Estimator",
    version="2.1.0",
    lifespan=lifespan,
)

allowed_origins = [
    value.strip()
    for value in os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:8000,http://localhost:5173"
    ).split(",")
    if value.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

if (FRONTEND_DIST / "assets").is_dir():
    app.mount(
        "/assets",
        StaticFiles(directory=FRONTEND_DIST / "assets"),
        name="assets",
    )


class SourceConfig(BaseModel):
    source_type: str
    filename: Optional[str] = None


class CapacityConfig(BaseModel):
    capacity: int = Field(ge=10, le=10_000)


class MonitoringConfig(BaseModel):
    enabled: bool


class BrightnessConfig(BaseModel):
    threshold: float = Field(ge=0, le=255)


class HeatmapConfig(BaseModel):
    enabled: bool


@app.get("/api/health")
def health():
    return {
        "status": "ok" if monitoring_service.detector is not None else "degraded",
        "models_initialized": monitoring_service.detector is not None,
        "model_error": monitoring_service.model_error,
        "monitoring_enabled": monitoring_service.monitoring_enabled,
        "source": monitoring_service.video_source,
        "csrnet_enabled": monitoring_service.csrnet_enabled,
    }


@app.get("/api/videos")
def list_videos():
    return {
        "videos": sorted(
            path.name for path in VIDEO_DIR.glob("*.mp4") if path.is_file()
        )
    }


@app.post("/api/videos/upload")
async def upload_video(file: UploadFile = File(...)):
    original_name = Path(file.filename or "").name
    if original_name != (file.filename or ""):
        raise HTTPException(status_code=400, detail="Invalid filename")
    if Path(original_name).suffix.lower() != ".mp4":
        raise HTTPException(status_code=415, detail="Only MP4 files are supported")
    if file.content_type and file.content_type not in ALLOWED_VIDEO_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported media type")

    safe_stem = SAFE_FILENAME.sub("_", Path(original_name).stem).strip("._")
    stored_name = f"{safe_stem or 'video'}-{uuid.uuid4().hex[:10]}.mp4"
    destination = VIDEO_DIR / stored_name
    temp_path: Optional[Path] = None

    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", dir=VIDEO_DIR, prefix=".upload-", delete=False
        ) as output:
            temp_path = Path(output.name)
            total = 0
            header = b""
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=(
                            "Video exceeds the "
                            f"{MAX_UPLOAD_BYTES // 1024 // 1024} MB limit"
                        ),
                    )
                if len(header) < 32:
                    header += chunk[: 32 - len(header)]
                output.write(chunk)

        if len(header) < 12 or b"ftyp" not in header[:32]:
            raise HTTPException(
                status_code=415,
                detail="File is not a valid MP4 container",
            )

        temp_path.replace(destination)
        logger.info("Stored uploaded video as %s", destination)
        return {"status": "ok", "filename": stored_name}
    finally:
        await file.close()
        if temp_path and temp_path.exists():
            temp_path.unlink(missing_ok=True)


@app.post("/api/config/source")
async def set_source(config: SourceConfig):
    try:
        source = await asyncio.to_thread(
            monitoring_service.set_source,
            config.source_type,
            config.filename,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"status": "ok", "source": source}


@app.get("/api/config/source")
def get_source():
    source = monitoring_service.video_source
    if source == 0:
        return {"source_type": "live", "filename": None}
    return {"source_type": "video", "filename": Path(str(source)).name}


@app.get("/api/config/capacity")
def get_capacity():
    return {"base_capacity": monitoring_service.risk_engine.base_capacity}


@app.post("/api/config/capacity")
def set_capacity(config: CapacityConfig):
    monitoring_service.set_capacity(config.capacity)
    return {"status": "ok", "base_capacity": config.capacity}


@app.get("/api/config/monitoring")
def get_monitoring():
    return {
        "monitoring_enabled": monitoring_service.monitoring_enabled,
        "source": monitoring_service.video_source,
    }


@app.post("/api/config/monitoring")
async def set_monitoring(config: MonitoringConfig):
    if config.enabled:
        try:
            opened = await asyncio.to_thread(monitoring_service.start_monitoring)
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        if not opened:
            raise HTTPException(status_code=503, detail="Video source is unavailable")
    else:
        await asyncio.to_thread(monitoring_service.stop_monitoring)
    return {
        "status": "ok",
        "monitoring_enabled": monitoring_service.monitoring_enabled,
        "source": monitoring_service.video_source,
    }


@app.get("/api/config/brightness")
def get_brightness():
    if monitoring_service.detector is None:
        raise HTTPException(status_code=503, detail="Detector is not initialized")
    return {
        "brightness_threshold": monitoring_service.detector.brightness_threshold
    }


@app.post("/api/config/brightness")
def set_brightness(config: BrightnessConfig):
    try:
        monitoring_service.set_brightness_threshold(config.threshold)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"status": "ok", "brightness_threshold": config.threshold}


@app.get("/api/config/heatmap")
def get_heatmap():
    return {"heatmap_enabled": monitoring_service.heatmap_enabled}


@app.post("/api/config/heatmap")
def set_heatmap(config: HeatmapConfig):
    monitoring_service.heatmap_enabled = config.enabled
    return {"status": "ok", "heatmap_enabled": config.enabled}


@app.get("/api/logs")
def get_logs(limit: int = 50):
    if not 1 <= limit <= 500:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 500")
    return [_serialize_log(item) for item in monitoring_service.db.get_recent_logs(limit)]


@app.websocket("/ws/stats")
async def websocket_stats(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = monitoring_service.snapshot_stats()
            logs = await asyncio.to_thread(
                monitoring_service.db.get_recent_logs, 25
            )
            data["logs"] = [_serialize_log(item) for item in logs]
            await websocket.send_json(data)
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception:
        logger.exception("WebSocket statistics stream failed")


async def generate_mjpeg():
    try:
        while True:
            frame = await asyncio.to_thread(monitoring_service.render_latest_frame)
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Cache-Control: no-store\r\n\r\n"
                + frame
                + b"\r\n"
            )
            await asyncio.sleep(0.05)
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("MJPEG stream failed")


@app.get("/video_feed")
async def video_feed():
    return StreamingResponse(
        generate_mjpeg(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-store"},
    )


def _serialize_log(item) -> dict:
    return {
        "id": item.id,
        "timestamp": item.timestamp.isoformat() if item.timestamp else "",
        "risk_level": item.risk_level,
        "count": item.count,
        "message": item.message,
    }


def _serve_index():
    index = FRONTEND_DIST / "index.html"
    if index.is_file():
        return index.read_text(encoding="utf-8")
    return HTMLResponse(
        "<h1>Frontend assets are not built. Run npm run build in frontend.</h1>",
        status_code=503,
    )


@app.get("/", response_class=HTMLResponse)
def root():
    return _serve_index()


@app.get("/monitor", response_class=HTMLResponse)
def monitor():
    return _serve_index()


@app.get("/favicon.svg")
def favicon():
    path = FRONTEND_DIST / "favicon.svg"
    return FileResponse(path) if path.is_file() else Response(status_code=404)


@app.get("/icons.svg")
def icons():
    path = FRONTEND_DIST / "icons.svg"
    return FileResponse(path) if path.is_file() else Response(status_code=404)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
