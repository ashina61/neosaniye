"""Narration from Kokoro, an open-weights voice that runs locally and free.

This sits between Gemini and piper. Gemini sounds best but its free tier runs
out; piper never runs out but sounds like what it is. Kokoro is the middle that
was missing: no key, no quota, no network once the model is on disk, and a
voice that does not announce itself as synthetic in the first sentence.

It is the ONNX build rather than the torch one on purpose — the pipeline runs on
a GitHub runner where a torch install is several minutes and a gigabyte, against
about 350MB of model here and no framework at all.

The model files are not in the repo; they are fetched once and cached. If they
are missing and cannot be fetched, this engine simply reports itself
unavailable and the caller drops to piper.
"""
from __future__ import annotations

import os
import subprocess
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = Path(os.environ.get("KOKORO_DIR") or ROOT / ".voices" / "kokoro")
MODEL = MODEL_DIR / "kokoro-v1.0.onnx"
VOICES = MODEL_DIR / "voices-v1.0.bin"
RELEASE = ("https://github.com/thewh1teagle/kokoro-onnx/releases/download/"
           "model-files-v1.0/")

# Measured over twelve beats of real scripts: 117 words in 39.02s. Adam is the
# briskest of the male narrator voices, which matters — a slower voice buys a
# shorter script for the same running time.
VOICE = os.environ.get("KOKORO_VOICE", "am_adam")

_kokoro = None


def available() -> bool:
    if os.environ.get("KOKORO_DISABLE"):
        return False
    try:
        import kokoro_onnx  # noqa: F401
    except Exception:
        return False
    return MODEL.exists() and VOICES.exists()


def fetch() -> bool:
    """Download the model files if they are not already on disk."""
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    for path in (MODEL, VOICES):
        if path.exists() and path.stat().st_size > 1_000_000:
            continue
        url = RELEASE + path.name
        print(f"      fetching {path.name}")
        r = subprocess.run(["curl", "-sSL", "--fail", "-o", str(path), url],
                           capture_output=True, text=True)
        if r.returncode != 0:
            print(f"      could not fetch {path.name}: {r.stderr[-160:].strip()}")
            path.unlink(missing_ok=True)
            return False
    return True


def _engine():
    global _kokoro
    if _kokoro is None:
        from kokoro_onnx import Kokoro
        _kokoro = Kokoro(str(MODEL), str(VOICES))
    return _kokoro


def say(text: str, out: Path, voice: str | None = None) -> None:
    """Synthesize one line to a 24 kHz mono wav."""
    import numpy as np
    samples, rate = _engine().create(text, voice=voice or VOICE,
                                     speed=1.0, lang="en-us")
    out.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(samples, -1.0, 1.0) * 32767).astype("<i2").tobytes()
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
