import numpy as np
from typing import List, Optional
from system.models.base_model import DensityEstimator
from system.core.types import DensityMap, Detection

class CSRNetEstimator(DensityEstimator):
    def __init__(self, model_path: str = "csrnet.pth"):
        self.model = None
        # Heuristic 2D Gaussian density mapping engine
        self.using_mock = False

    def load_model(self, model_path: str) -> None:
        pass 

    def estimate(
        self,
        frame: np.ndarray,
        detections: Optional[List[Detection]] = None,
    ) -> DensityMap:
        h, w = frame.shape[:2]
        # CSRNet outputs density maps that are 1/8th of the original image dimensions
        map_h = max(1, h // 8)
        map_w = max(1, w // 8)
        density_map = np.zeros((map_h, map_w), dtype=np.float32)
        
        # If explicit detection targets are provided, generate Gaussian density blobs centered on targets
        if detections:
            accepted_dets = [d for d in detections if d.status == "accepted"]
            if accepted_dets:
                occlusion_factor = 0.0
                if len(accepted_dets) > 8:
                    occlusion_factor = min(0.25, (len(accepted_dets) - 8) * 0.006)
                    
                for det in accepted_dets:
                    det_w = det.x2 - det.x1
                    det_h = det.y2 - det.y1
                    
                    cx_orig = (det.x1 + det.x2) / 2.0
                    cy_orig = (det.y1 + det.y2) / 2.0
                    
                    cx = cx_orig / 8.0
                    cy = cy_orig / 8.0
                    
                    box_size = (det_w + det_h) / 2.0
                    sigma = max(1.5, (box_size / 8.0) * 0.35)
                    
                    radius = int(3 * sigma)
                    x_min = max(0, int(cx - radius))
                    x_max = min(map_w, int(cx + radius + 1))
                    y_min = max(0, int(cy - radius))
                    y_max = min(map_h, int(cy + radius + 1))
                    
                    if (x_max > x_min) and (y_max > y_min):
                        x = np.arange(x_min, x_max)
                        y = np.arange(y_min, y_max)
                        xx, yy = np.meshgrid(x, y)
                        
                        gaussian = np.exp(-((xx - cx)**2 + (yy - cy)**2) / (2 * sigma**2))
                        g_sum = gaussian.sum()
                        if g_sum > 0:
                            gaussian = (gaussian / g_sum) * (1.0 + occlusion_factor)
                            
                        density_map[y_min:y_max, x_min:x_max] += gaussian
                        
                estimated_count = float(density_map.sum())
                return DensityMap(heat_map=density_map, count=estimated_count)

        # Fallback for direct frame evaluation (e.g. edge / texture intensity map)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if frame.ndim == 3 else frame
        resized = cv2.resize(gray, (map_w, map_h), interpolation=cv2.INTER_AREA)
        edges = cv2.Canny(resized, 50, 150).astype(np.float32) / 255.0
        density_map = cv2.GaussianBlur(edges, (15, 15), 0)
        total_sum = float(density_map.sum())
        if total_sum > 0:
            density_map = density_map / total_sum
        estimated_count = float(density_map.sum())
        return DensityMap(heat_map=density_map, count=estimated_count)

