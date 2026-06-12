import os
import tempfile
import unittest
from pathlib import Path

import numpy as np

from system.core.fusion import FusionEngine
from system.core.types import DensityMap, Detection
from system.services.app_service import CrowdMonitoringService
from system.services.db_service import DBService


class DatabaseServiceTests(unittest.TestCase):
    def test_timestamp_index_and_bounded_logs(self):
        with tempfile.TemporaryDirectory() as directory:
            database = DBService(str(Path(directory) / "test.db"))
            for count in range(3):
                database.log_event("SAFE", count, f"event-{count}")

            self.assertEqual(len(database.get_recent_logs(2)), 2)
            self.assertEqual(len(database.get_recent_logs(10_000)), 3)

            with database.engine.connect() as connection:
                indexes = {
                    row[1]
                    for row in connection.exec_driver_sql(
                        "PRAGMA index_list(event_logs)"
                    )
                }
            self.assertIn("ix_event_logs_timestamp", indexes)
            database.dispose()


class FusionTests(unittest.TestCase):
    def test_independent_density_estimate_can_change_yolo_count(self):
        frame = np.zeros((100, 100, 3), dtype=np.uint8)
        detections = [
            Detection(0, 0, 20, 40, 0.9, 0)
            for _ in range(10)
        ]
        density = DensityMap(
            heat_map=np.zeros((12, 12), dtype=np.float32),
            count=30.0,
        )

        result = FusionEngine().fuse(1, frame, detections, density)

        self.assertGreater(result.estimated_count, len(detections))


class ServiceConfigurationTests(unittest.TestCase):
    def test_missing_model_is_reported_without_crashing_startup(self):
        original = os.environ.get("YOLO_MODEL_PATH")
        os.environ["YOLO_MODEL_PATH"] = "/missing/model.pt"
        service = CrowdMonitoringService()
        try:
            service.initialize()
            self.assertIsNone(service.detector)
            self.assertIn("not found", service.model_error or "")
        finally:
            service.shutdown()
            if original is None:
                os.environ.pop("YOLO_MODEL_PATH", None)
            else:
                os.environ["YOLO_MODEL_PATH"] = original


if __name__ == "__main__":
    unittest.main()
