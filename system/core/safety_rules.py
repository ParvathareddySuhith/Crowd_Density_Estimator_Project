from system.core.types import CrowdFrame, RiskLevel

class RiskEngine:
    """
    Evaluates crowd data against safety rules to determine risk levels.
    Implements 'Dynamic Thresholding' (context-aware limits).
    """
    def __init__(self, base_capacity: int = 50):
        self.base_capacity = base_capacity
        self.history = [] # store recent counts for trend analysis
        self.history_window = 10 # frames to keep

    def reset(self):
        self.history.clear()

    def evaluate_risk(self, frame: CrowdFrame) -> CrowdFrame:
        count = frame.estimated_count
        
        # Update headcount history window
        self.history.append(count)
        if len(self.history) > self.history_window:
            self.history.pop(0)
            
        # Dynamic Capacity Auto-Scaling based on Ingress Velocity (Rate of Inflow)
        reduction = 0
        if len(self.history) > 5:
            delta = self.history[-1] - self.history[0]
            if delta > 2: # Inflow detected (increase of >2 people in ~5 seconds)
                # Reduce capacity by 1.5 PAX per unit of positive ingress rate, capped at a maximum of 30% reduction
                reduction = int(min(self.base_capacity * 0.30, delta * 1.5))
                
        dynamic_limit = max(10, self.base_capacity - reduction)
        frame.dynamic_capacity = dynamic_limit
        
        # Calculate dynamic risk thresholds based on the auto-scaled capacity limit
        low_thresh = dynamic_limit * 0.50
        high_thresh = dynamic_limit * 0.85
        
        # Determine Risk Level and Normalized Risk Score
        if count >= high_thresh:
            frame.risk_level = RiskLevel.CRITICAL
            frame.risk_score = 1.0
        elif count >= low_thresh:
            frame.risk_level = RiskLevel.WARNING
            # Linearly scale score between 0.5 and 0.9 depending on closeness to critical threshold
            frame.risk_score = 0.5 + (0.4 * (count - low_thresh) / (high_thresh - low_thresh))
        else:
            frame.risk_level = RiskLevel.SAFE
            frame.risk_score = 0.1
            
        return frame
