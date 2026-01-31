"""Voice Activity Detection (VAD) using silero-vad.

We add padding and merge short gaps to produce longer, stable chunks for transcription.
"""

from __future__ import annotations

import array
import os
import wave
from pathlib import Path
from typing import List, Tuple

# Constants for chunking, pulled up to avoid magic numbers.
DEFAULT_PAD_SEC = 0.2
DEFAULT_MERGE_GAP_SEC = 0.6
DEFAULT_MAX_CHUNK_SEC = 35.0
SAMPLE_RATE = 16000


def _wav_duration_seconds(wav_path: Path) -> float:
    with wave.open(str(wav_path), "rb") as wf:
        frames = wf.getnframes()
        rate = wf.getframerate()
        return frames / float(rate)


def _read_wav_mono_float32(wav_path: Path) -> "torch.Tensor":
    """Load a WAV as mono float32 tensor in [-1, 1]."""

    with wave.open(str(wav_path), "rb") as wf:
        channels = wf.getnchannels()
        sample_width = wf.getsampwidth()
        rate = wf.getframerate()
        frames = wf.readframes(wf.getnframes())

    if rate != SAMPLE_RATE:
        raise RuntimeError(f"Unsupported sample rate {rate}, expected {SAMPLE_RATE}")
    if sample_width != 2:
        raise RuntimeError(f"Unsupported sample width {sample_width}, expected 2")

    data = array.array("h")
    data.frombytes(frames)
    if channels > 1:
        data = data[0::channels]

    import torch  # type: ignore

    return torch.tensor(data, dtype=torch.float32) / 32768.0


def _merge_and_pad(
    segments: List[Tuple[float, float]],
    pad_sec: float,
    merge_gap_sec: float,
    max_chunk_sec: float,
    total_duration: float,
) -> List[Tuple[float, float]]:
    """Pad, merge close segments, and split long segments."""

    if not segments:
        return [(0.0, min(total_duration, max_chunk_sec))]

    # Apply padding and clamp to file duration.
    padded = []
    for start, end in segments:
        s = max(0.0, start - pad_sec)
        e = min(total_duration, end + pad_sec)
        if e > s:
            padded.append((s, e))

    # Sort by start time to ensure stable merge.
    padded.sort(key=lambda x: x[0])

    merged: List[Tuple[float, float]] = []
    for s, e in padded:
        if not merged:
            merged.append((s, e))
            continue
        last_s, last_e = merged[-1]
        if s - last_e <= merge_gap_sec:
            merged[-1] = (last_s, max(last_e, e))
        else:
            merged.append((s, e))

    # Split long chunks to cap processing time per chunk.
    final: List[Tuple[float, float]] = []
    for s, e in merged:
        cur = s
        while cur < e:
            nxt = min(cur + max_chunk_sec, e)
            final.append((cur, nxt))
            cur = nxt

    return final


def run_vad(
    wav_path: Path,
    log_fn,
    cancel_check,
    pad_sec: float = DEFAULT_PAD_SEC,
    merge_gap_sec: float = DEFAULT_MERGE_GAP_SEC,
    max_chunk_sec: float = DEFAULT_MAX_CHUNK_SEC,
) -> List[Tuple[float, float]]:
    """Run VAD and return list of (start, end) segments.

    If silero-vad or torch is unavailable (or test mode is enabled), fallback to
    a single chunk covering the whole file. This keeps tests pure Python.
    """

    if cancel_check():
        raise RuntimeError("cancelled")

    total_duration = _wav_duration_seconds(wav_path)

    # In tests we explicitly skip heavy models.
    if os.getenv("PLAUD_TEST_MODE") == "1":
        log_fn("VAD skipped (test mode). Using full-duration chunk.")
        return _merge_and_pad([(0.0, total_duration)], pad_sec, merge_gap_sec, max_chunk_sec, total_duration)

    try:
        import torch  # type: ignore
        # Use torch.hub to load silero model + utils. This may download on first run.
        # Some torch versions don't support trust_repo; try with it, then fallback.
        try:
            model, utils = torch.hub.load(
                repo_or_dir="snakers4/silero-vad",
                model="silero_vad",
                trust_repo=True,
            )
        except TypeError:
            model, utils = torch.hub.load(
                repo_or_dir="snakers4/silero-vad",
                model="silero_vad",
            )
        (get_speech_timestamps, _, read_audio, _, _) = utils

        try:
            wav = read_audio(str(wav_path), sampling_rate=SAMPLE_RATE)
        except Exception as exc:
            if os.getenv("PLAUD_DEBUG") == "1":
                log_fn(f"VAD read_audio unavailable; using wave fallback. Details: {exc}")
            else:
                log_fn("VAD read_audio unavailable; using wave fallback.")
            wav = _read_wav_mono_float32(wav_path)
        timestamps = get_speech_timestamps(wav, model, sampling_rate=SAMPLE_RATE)
        raw_segments = [(ts["start"] / SAMPLE_RATE, ts["end"] / SAMPLE_RATE) for ts in timestamps]

        log_fn(f"VAD produced {len(raw_segments)} raw segments")
        return _merge_and_pad(raw_segments, pad_sec, merge_gap_sec, max_chunk_sec, total_duration)

    except Exception as exc:
        # Fallback to full chunk if VAD fails for any reason.
        log_fn(f"VAD failed, fallback to full chunk: {exc}")
        return _merge_and_pad([(0.0, total_duration)], pad_sec, merge_gap_sec, max_chunk_sec, total_duration)
