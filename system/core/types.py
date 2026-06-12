from enum import Enum
from dataclasses import dataclass, field
from typing import List, Tuple, Optional
import numpy as np

class RiskLevel(Enum):
    SAFE = "SAFE"       # Green
    WARNING = "WARNING" # Yellow
    CRITICAL = "CRITICAL" # Red

@dataclass
class Detection:
    """Represents a single person detection from YOLO"""
    x1: int
    y1: int
    x2: int
    y2: int
    confidence: float
    class_id: int
    status: str = "accepted"
    reason: str = ""
    track_id: Optional[int] = None
    position: Optional[Tuple[float, float]] = None
    velocity: Optional[Tuple[float, float]] = None
    direction: Optional[Tuple[float, float]] = None
    speed: float = 0.0
    history_positions: List[Tuple[float, float]] = field(default_factory=list)


@dataclass
class DensityMap:
    """Represents the density map output from CSRNet"""
    heat_map: np.ndarray
    count: float

@dataclass
class CrowdFrame:
    """Unified representation of a processed frame"""
    frame_id: int
    timestamp: float
    original_shape: Tuple[int, int]
    
    # Raw Analysis
    detections: List[Detection]
    density_map: Optional[DensityMap]
    
    # Fused Data
    estimated_count: int
    density_level: float # e.g. people per square meter
    
    # Risk
    risk_level: RiskLevel
    risk_score: float # 0.0 to 1.0 normalization logic
    
    # Dynamic Capacity
    dynamic_capacity: int = 50

    # Optional image retained for MJPEG rendering.
    raw_image: Optional[np.ndarray] = None
