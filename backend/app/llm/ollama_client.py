"""Minimal Ollama HTTP client.

We keep this module dependency-free (urllib) to avoid adding heavy HTTP libs.
The functions are intentionally small and explicit so failure modes are easy to
reason about and test.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Optional


def _join_url(base_url: str, path: str) -> str:
    """Join base URL and path reliably.

    This avoids double slashes and keeps the call sites clean.
    """

    return base_url.rstrip("/") + "/" + path.lstrip("/")


def check_available(base_url: str, timeout_sec: float = 3.0) -> bool:
    """Return True if Ollama responds, False otherwise.

    We probe /api/tags because it is lightweight and always present when
    the server is healthy.
    """

    url = _join_url(base_url, "/api/tags")
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            return 200 <= resp.status < 300
    except Exception:
        return False


def generate(
    *,
    base_url: str,
    model: str,
    prompt: str,
    temperature: float = 0.2,
    top_p: float = 0.9,
    max_tokens: int = 800,
    timeout_sec: float = 90.0,
) -> str:
    """Call Ollama /api/generate and return the response text.

    We force stream=false to get a single JSON payload, which keeps parsing
    simple and avoids streaming edge cases in the backend worker thread.
    """

    url = _join_url(base_url, "/api/generate")
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "top_p": top_p,
            "num_predict": max_tokens,
        },
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={"Content-Type": "application/json"},
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        # Include response body for troubleshooting but keep message compact.
        details = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Ollama HTTP {exc.code}: {details}") from exc
    except Exception as exc:
        raise RuntimeError(f"Ollama request failed: {exc}") from exc

    try:
        parsed = json.loads(body)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Ollama JSON parse failed: {exc}") from exc

    response = parsed.get("response")
    if not isinstance(response, str):
        raise RuntimeError("Ollama response missing 'response' field")

    return response.strip()
