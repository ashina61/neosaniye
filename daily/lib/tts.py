"""Narration, from Gemini TTS where a key exists and piper where it does not.

Gemini returns raw little-endian PCM (L16, 24 kHz, mono) inline in the response,
not a container, so the bytes are wrapped in a WAV header here rather than
handed to ffmpeg. Everything downstream measures real durations, so the two
engines are interchangeable even though they speak at different rates.
"""
from __future__ import annotations

import base64
import os
import re
import subprocess
import wave
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
PIPER_VOICE = ROOT / ".voices" / "en-us-ryan-high.onnx"

GEMINI_MODEL = "gemini-2.5-flash-preview-tts"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
# Prebuilt Gemini voices. Charon reads as an informative male narrator, which is
# the register these explainers want.
GEMINI_VOICE = "Charon"
# Steers delivery without ending up in the spoken text.
STYLE = ("Read this line as a confident science documentary narrator: "
         "calm, clear, unhurried, no rising question intonation. Say only the line.\n\n")


def _key() -> str | None:
    return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")


def engine() -> str:
    return "gemini" if _key() else "piper"


def _write_wav(pcm: bytes, path: Path, rate: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)


def _rate_from_mime(mime: str) -> int:
    m = re.search(r"rate=(\d+)", mime or "")
    return int(m.group(1)) if m else 24_000


def _gemini_line(text: str, out: Path, voice: str) -> None:
    r = requests.post(
        GEMINI_URL.format(model=GEMINI_MODEL),
        params={"key": _key()},
        json={"contents": [{"parts": [{"text": STYLE + text}]}],
              "generationConfig": {
                  "responseModalities": ["AUDIO"],
                  "speechConfig": {"voiceConfig": {
                      "prebuiltVoiceConfig": {"voiceName": voice}}}}},
        timeout=180)
    if r.status_code != 200:
        raise RuntimeError(f"Gemini TTS HTTP {r.status_code}: {r.text[:300]}")
    try:
        part = r.json()["candidates"][0]["content"]["parts"][0]["inlineData"]
    except (KeyError, IndexError) as e:
        raise RuntimeError(f"Gemini TTS returned no audio part: {r.text[:300]}") from e
    _write_wav(base64.b64decode(part["data"]), out, _rate_from_mime(part.get("mimeType", "")))


def _piper_line(text: str, out: Path) -> None:
    if not PIPER_VOICE.exists():
        raise FileNotFoundError(f"voice model missing: {PIPER_VOICE} (run daily/bootstrap.sh)")
    out.parent.mkdir(parents=True, exist_ok=True)
    p = subprocess.run(["piper", "-m", str(PIPER_VOICE), "-c", f"{PIPER_VOICE}.json",
                        "-f", str(out)], input=text, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"piper failed: {p.stderr[-300:]}")


def say(text: str, out: Path, voice: str | None = None) -> str:
    """Render one line to `out`. Returns the engine that produced it."""
    if _key():
        _gemini_line(text, out, voice or GEMINI_VOICE)
        return "gemini"
    _piper_line(text, out)
    return "piper"
