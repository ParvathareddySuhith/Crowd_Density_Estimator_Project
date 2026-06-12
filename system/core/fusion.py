from typing import List
import numpy as np
from system.core.types import Detection, DensityMap, CrowdFrame, RiskLevel

class FusionEngine:
    """
    Fuses outputs from YOLO (Detection) and CSRNet (Density Estimation)
    to provide a robust crowd count and risk assessment.
    """
    def __init__(self, yolo_weight: float = 0.7, csrnet_weight: float = 0.3):
        # Base weights; in a dynamic system these could shift based on scene clutter
        self.yolo_weight = yolo_weight
        self.csrnet_weight = csrnet_weight

    def fuse(self, 
             frame_id: int, 
             frame: np.ndarray, 
             detections: List[Detection], 
             density_map: DensityMap) -> CrowdFrame:
        
        accepted_dets = [d for d in detections if d.status == "accepted"]
        yolo_count = len(accepted_dets)
        csr_count = density_map.count if density_map else None
        
        # --- Fusion Logic (Rule-Based) ---
        # Paper Hypothesis: YOLO is better for discrete counting in low density.
        # CSRNet is better for occluded/dense crowds.
        
        # If YOLO sees very few people, trust it almost entirely (low occlusion)
        if csr_count is None or yolo_count < 8:
            final_count = yolo_count
        else:
            # As density increases, trust CSRNet more (weighted average)
            # For this implementation, we use a weighted linear combination
            final_count = round(
                (yolo_count * self.yolo_weight)
                + (csr_count * self.csrnet_weight)
            )
            
            # fail-safe: The count should purely be at least what YOLO sees (visible people)
            # Do not force the fused count to YOLO's result: a real independent
            # density estimator may legitimately correct either over- or under-counts.
            final_count = max(0, final_count)

        # Calculate density (people per pixel area being the rough proxy, 
        # normally we'd project to ground plane meters)
        h, w = frame.shape[:2]
        area_pixels = h * w
        density_val = final_count / (area_pixels / 1_000_000) # px scaled

        # Risk will be calculated by a separate RiskEngine, 
        # but we initialize the frame object here.
        return CrowdFrame(
            frame_id=frame_id,
            timestamp=0.0, # assigned by caller
            original_shape=(h, w),
            detections=detections,
            density_map=density_map,
            estimated_count=final_count,
            density_level=density_val,
            risk_level=RiskLevel.SAFE, # Placeholder
            risk_score=0.0
        )
