"""Narration, from Gemini TTS where the quota allows it and piper where it does not.

Gemini returns raw little-endian PCM (L16, 24 kHz, mono) inline in the response,
not a container, so the bytes are wrapped in a WAV header here rather than handed
to ffmpeg. Everything downstream measures real durations, so the engines are
interchangeable even though they speak at different rates.

Access to the TTS preview models is not implied by a working API key: listing
models costs nothing and succeeds on any tier, while synthesis can 429 on the
first call. So the engine is decided by actually synthesizing, and a video never
mixes engines — if Gemini runs out partway, the whole narration is redone with
piper rather than changing voice mid-video.
"""
from __future__ import annotations

import base64
import os
import re
import subprocess
import time
import wave
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
PIPER_VOICE = ROOT / ".voices" / "en-us-ryan-high.onnx"

# Tried in order; the first that actually synthesizes is kept for the whole run.
GEMINI_TTS_MODELS = ["gemini-2.5-flash-preview-tts",
                     "gemini-3.1-flash-tts-preview",
                     "gemini-2.5-pro-preview-tts"]
URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
GEMINI_VOICE = "Charon"          # informative male narrator
STYLE = ("Read this line as a confident science documentary narrator: "
         "calm, clear, unhurried, no rising question intonation. Say only the line.\n\n")

_chosen: str | None = None       # model proven to work this process
_dead: set[str] = set()          # models that returned a quota or access error


class QuotaExhausted(RuntimeError):
    """No Gemini TTS model is usable — the caller should fall back to piper."""


def _key() -> str | None:
    return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")


def configured_engine() -> str:
    """`auto` probes Gemini and falls back; `piper` skips Gemini entirely.

    Worth pinning to piper when the key's tier cannot serve TTS: probing costs
    three doomed requests and a confusing 429 in the log on every single run.
    """
    return os.environ.get("TTS_ENGINE", "auto").strip().lower()


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


def _call(model: str, text: str, voice: str, out: Path) -> None:
    """One synthesis. Raises QuotaExhausted for 429/403, RuntimeError otherwise."""
    r = requests.post(
        URL.format(model=model), params={"key": _key()}, timeout=180,
        json={"contents": [{"parts": [{"text": STYLE + text}]}],
              "generationConfig": {
                  "responseModalities": ["AUDIO"],
                  "speechConfig": {"voiceConfig": {
                      "prebuiltVoiceConfig": {"voiceName": voice}}}}})
    if r.status_code in (429, 403):
        raise QuotaExhausted(f"{model}: HTTP {r.status_code} — {r.text[:900]}")
    if r.status_code != 200:
        raise RuntimeError(f"{model}: HTTP {r.status_code} — {r.text[:500]}")
    try:
        part = r.json()["candidates"][0]["content"]["parts"][0]["inlineData"]
    except (KeyError, IndexError) as e:
        raise RuntimeError(f"{model}: no audio in response — {r.text[:400]}") from e
    _write_wav(base64.b64decode(part["data"]), out, _rate_from_mime(part.get("mimeType", "")))


def _gemini_line(text: str, out: Path, voice: str, retries: int = 2) -> str:
    """Synthesize with the first usable model, retrying a rate limit once or twice."""
    global _chosen
    order = ([_chosen] if _chosen else []) + [m for m in GEMINI_TTS_MODELS
                                              if m != _chosen and m not in _dead]
    last = ""
    for model in order:
        for attempt in range(retries + 1):
            try:
                _call(model, text, voice, out)
                _chosen = model
                return model
            except QuotaExhausted as e:
                last = str(e)
                if attempt < retries:
                    time.sleep(6 * (attempt + 1))   # a per-minute limit clears; a daily one won't
                    continue
                _dead.add(model)
                if _chosen == model:
                    _chosen = None
                break
            except RuntimeError as e:
                last = str(e)
                _dead.add(model)
                break
    raise QuotaExhausted(f"no Gemini TTS model was usable — {last}")


def _piper_line(text: str, out: Path) -> None:
    if not PIPER_VOICE.exists():
        raise FileNotFoundError(
            f"voice model missing: {PIPER_VOICE}. Gemini TTS was unavailable and "
            f"there is no local fallback — run daily/bootstrap.sh, or install the "
            f"voice in the workflow.")
    out.parent.mkdir(parents=True, exist_ok=True)
    p = subprocess.run(["piper", "-m", str(PIPER_VOICE), "-c", f"{PIPER_VOICE}.json",
                        "-f", str(out)], input=text, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"piper failed: {p.stderr[-300:]}")


def probe() -> tuple[str, str]:
    """Find out which engine this environment can actually use. (engine, detail)"""
    if configured_engine() == "piper":
        return "piper", "pinned by TTS_ENGINE=piper"
    if not _key():
        return "piper", "no GEMINI_API_KEY"
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        try:
            model = _gemini_line("Testing.", Path(d) / "probe.wav", GEMINI_VOICE, retries=0)
            return "gemini", model
        except QuotaExhausted as e:
            return "piper", str(e)[:300]


def say(text: str, out: Path, voice: str | None = None, engine: str = "auto") -> str:
    """Render one line. `engine` of 'piper' skips Gemini entirely."""
    if engine == "piper" or configured_engine() == "piper" or not _key():
        _piper_line(text, out)
        return "piper"
    _gemini_line(text, out, voice or GEMINI_VOICE)
    return "gemini"


def engine() -> str:
    if configured_engine() == "piper":
        return "piper"
    return "gemini" if _key() else "piper"
