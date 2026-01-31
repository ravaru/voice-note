"""Simple job logger.

We intentionally keep logs in memory (per job) to avoid extra I/O.
"""

from __future__ import annotations

from datetime import datetime, timezone


def log_line(message: str) -> str:
    """Create a timestamped log line.

    Using UTC keeps logs stable regardless of local timezone changes.
    """

    ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return f"[{ts}] {message}"
