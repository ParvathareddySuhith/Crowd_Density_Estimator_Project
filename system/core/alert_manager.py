import time
from typing import Dict, Optional
from system.core.types import RiskLevel, CrowdFrame

class AlertManager:
    """
    Manages system alerts, ensuring we don't spam the user (cooldowns).
    """
    def __init__(self, cooldown_seconds: int = 10):
        self.cooldown_seconds = cooldown_seconds
        self.last_alert_time: Dict[RiskLevel, float] = {}
        self.active_alert: Optional[RiskLevel] = None

    def reset(self):
        self.last_alert_time.clear()
        self.active_alert = None

    def check_alert(self, frame: CrowdFrame) -> Optional[str]:
        current_risk = frame.risk_level
        now = time.time()

        # Logic: Always alert on status CHANGE
        # If status is SAME, only alert if cooldown passed
        
        has_changed = (current_risk != self.active_alert)
        
        should_alert = False
        message = ""

        if has_changed:
            should_alert = True
            # Update active state
            self.active_alert = current_risk
            # Message
            if current_risk == RiskLevel.CRITICAL:
                message = f"🚨 CRITICAL ALERT: Crowd density exceeded safe limits! Count: {frame.estimated_count}"
            elif current_risk == RiskLevel.WARNING:
                message = f"⚠️ WARNING: Crowd density is high. Count: {frame.estimated_count}"
            else:
                message = f"✅ INFO: Crowd levels normalized. Count: {frame.estimated_count}"
                
        elif current_risk != RiskLevel.SAFE:
            # Repeated warning logic
            last_time = self.last_alert_time.get(current_risk, 0)
            if (now - last_time) > self.cooldown_seconds:
                should_alert = True
                message = f"Reminder: System still in {current_risk.name} state. Count: {frame.estimated_count}"

        if should_alert:
            self.last_alert_time[current_risk] = now
            return message
        
        return None
