# 🚸 Crowd Density Estimator & AI Safety System

An enterprise-grade, real-time **Crowd Density Estimation and Public Safety System** featuring object detection (YOLOv8m + ByteTrack), 2D Gaussian density spatial mapping, dynamic capacity auto-scaling based on ingress velocity, and live WebSocket telemetry dashboards.

---

## 🌟 Key Features

* **Dual Engine Analytics**: Integrates high-speed bounding-box target tracking (**YOLOv8m + ByteTrack**) with 2D Gaussian density spatial mapping.
* **Weighted Count Fusion**: Fuses discrete target detections with spatial density grids using adaptive weight scaling and fail-safe count floors.
* **Dynamic Capacity Auto-Scaling**: Automatically adjusts safety limits (up to 30% reduction) based on crowd ingress velocity ($\Delta \text{headcount} / \Delta \text{time}$).
* **Live Colormapped Heatmaps**: Blends Jet colormap spatial density heatmaps over live MJPEG streams (40% alpha) togglable via UI header.
* **Real-time Telemetry & Log Streaming**: Low-latency WebSocket feed (`/ws/stats`) broadcasting real processing FPS, risk scores, and event logs.
* **Physical Scene Calibration**: Monitored area slider ($10 \text{ m}^2$ to $300 \text{ m}^2$) recalculating spatial density indices ($\text{PAX/m}^2$).
* **Privacy-Preserving & Low-Light Enhancement**: Built-in CLAHE contrast adjustment, Gamma correction, and fast non-local means denoising for low-light feeds.

---

## 🏗️ System Architecture

```text
React 18 Dashboard (Vite + Tailwind CSS)
  ├── Live MJPEG Feed + Colormapped Heatmap Overlay
  ├── Real Hardware FPS Telemetry & Risk Score Index
  ├── Interactive Threshold & Scene Area Controls
  └── Real-time WebSocket Log Timeline (/ws/stats)
                        │
                        ▼
FastAPI 2.1 Backend Server (Python 3.11)
  ├── CrowdMonitoringService (Thread-Safe Capture Lifecycle)
  ├── YOLOv8 + ByteTrack Tracker (Device: MPS / CUDA / CPU)
  ├── 2D Gaussian Density Generator & Spatial Heatmap Engine
  ├── Weighted Fusion Engine (YOLO 0.7 + Density 0.3)
  ├── Risk Engine (Dynamic Ingress Velocity Auto-Scaling)
  └── SQLite Persistent Event Database (data/app.db)
```

---

## 🚀 Quick Start Guide

### Prerequisites
* Python 3.10+
* Node.js 18+

### 1. Installation & Frontend Build
```bash
# Clone the repository
git clone https://github.com/ParvathareddySuhith/Crowd_Density_Estimator_Project.git
cd Crowd_Density_Estimator_Project

# Install Python dependencies
pip install -r requirements.txt

# Build static React frontend
cd frontend
npm install
npm run build
cd ..
```

### 2. Run the System
```bash
python3 main.py
```
> Or with custom model weights:
> `YOLO_MODEL_PATH=runs/detect/yolov8m_crowdhuman-3/weights/best.pt python3 main.py`

### 3. Open Monitored Dashboard
* **Live Dashboard**: [http://localhost:8000/monitor](http://localhost:8000/monitor)
* **Landing Page**: [http://localhost:8000](http://localhost:8000)
* **Health API**: [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

## ⚙️ Configuration & Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `YOLO_MODEL_PATH` | `best.pt` | Path to YOLO PyTorch weights file |
| `ENABLE_CSRNET` | `true` | Enables asynchronous density map sampling |
| `CSRNET_FRAME_INTERVAL` | `5` | Frame cadence for density map updates |
| `MAX_VIDEO_UPLOAD_MB` | `250` | Maximum video file upload limit (MB) |
| `ALLOWED_ORIGINS` | `http://localhost:8000` | Allowed CORS frontend origins |

---

## 🧪 Verification & Testing

Run the automated backend test suite:
```bash
python3 -m unittest discover -s tests -p "test_*.py"
```

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
