from abc import ABC, abstractmethod
from typing import List, Optional
import numpy as np
from system.core.types import Detection, DensityMap

class PersonDetector(ABC):
    """Abstract interface for any object detection model (e.g. YOLO, Faster R-CNN)"""
    
    @abstractmethod
    def load_model(self, model_path: str) -> None:
        pass

    @abstractmethod
    def detect(self, frame: np.ndarray) -> List[Detection]:
        pass

class DensityEstimator(ABC):
    """Abstract interface for crowd density estimation models (e.g. CSRNet, MCNN)"""
    
    @abstractmethod
    def load_model(self, model_path: str) -> None:
        pass

    @abstractmethod
    def estimate(
        self,
        frame: np.ndarray,
        detections: Optional[List[Detection]] = None,
    ) -> DensityMap:
        pass
