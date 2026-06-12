import tempfile
import unittest
import warnings
from pathlib import Path
from unittest.mock import patch

warnings.filterwarnings(
    "ignore",
    message="Using `httpx` with `starlette.testclient` is deprecated",
)

from fastapi.testclient import TestClient

import main


class ApiWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)

    def test_health_endpoint(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertIn(response.json()["status"], {"ok", "degraded"})

    def test_video_upload_and_listing(self):
        with tempfile.TemporaryDirectory() as directory:
            video_directory = Path(directory)
            mp4 = b"\x00\x00\x00\x18ftypisom" + (b"\x00" * 64)

            with patch.object(main, "VIDEO_DIR", video_directory):
                upload = self.client.post(
                    "/api/videos/upload",
                    files={"file": ("portfolio-demo.mp4", mp4, "video/mp4")},
                )
                self.assertEqual(upload.status_code, 200)
                stored_name = upload.json()["filename"]
                self.assertTrue((video_directory / stored_name).is_file())

                listing = self.client.get("/api/videos")
                self.assertEqual(listing.status_code, 200)
                self.assertIn(stored_name, listing.json()["videos"])

    def test_upload_rejects_path_traversal(self):
        response = self.client.post(
            "/api/videos/upload",
            files={
                "file": (
                    "../outside.mp4",
                    b"\x00\x00\x00\x18ftypisom",
                    "video/mp4",
                )
            },
        )
        self.assertEqual(response.status_code, 400)

    def test_websocket_emits_telemetry(self):
        with self.client.websocket_connect("/ws/stats") as websocket:
            payload = websocket.receive_json()

        self.assertIn("count", payload)
        self.assertIn("risk", payload)
        self.assertIn("logs", payload)


if __name__ == "__main__":
    unittest.main()
