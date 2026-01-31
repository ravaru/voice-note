import os
import time
from pathlib import Path

# Enable test mode before importing the app so pipeline uses pure Python fallbacks.
os.environ["PLAUD_TEST_MODE"] = "1"

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.util.paths import OUT_DIR  # noqa: E402

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
TEST_MP3 = FIXTURES_DIR / "test.mp3"


def test_smoke_pipeline():
    # Use context manager to ensure startup events run (worker thread starts).
    with TestClient(app) as client:
        # 1) Health check
        resp = client.get("/health")
        assert resp.status_code == 200

        # 2) Upload a tiny mp3
        with TEST_MP3.open("rb") as f:
            resp = client.post("/jobs", files={"file": ("test.mp3", f, "audio/mpeg")})
        assert resp.status_code == 200
        job = resp.json()
        job_id = job["id"]

        # 3) Poll until done (summary should not block even if Ollama is absent)
        deadline = time.time() + 10
        status = None
        while time.time() < deadline:
            r = client.get(f"/jobs/{job_id}")
            assert r.status_code == 200
            payload = r.json()
            status = payload["status"]
            if status == "done":
                break
            if status in ("error", "cancelled"):
                raise AssertionError(f"Job failed with status {status}")
            time.sleep(0.2)

        assert status == "done"
        assert payload.get("summary_status") in ("skipped", "done")

        # 4) Check artifacts (summary.md should always exist, even when skipped)
        job_dir = OUT_DIR / job_id
        assert (job_dir / "segments.json").exists()
        assert (job_dir / "transcript.txt").exists()
        assert (job_dir / "summary.md").exists()

        # md_preview should be generated and non-empty
        md_preview_path = job_dir / "md_preview.md"
        assert md_preview_path.exists()
        assert md_preview_path.read_text(encoding="utf-8").strip()
