"""Cut one continuous narration take into per-beat clips.

Gemini's TTS quota is charged per request, so ten short calls cost ten times
what one call for the whole script costs. Asking once and cutting locally is the
difference between a free tier that cannot serve a single video and one that can
serve two a day.

The cut is only trustworthy if it can be checked, so it is: the split has to
produce exactly one segment per beat, none of them implausibly short, and each
roughly the share of the total that its word count predicts. A take that fails
any of those is rejected rather than guessed at, and the caller falls back to
the local voice.
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

NOISE_DB = -38          # anything quieter counts as silence
MIN_SILENCE = 0.22      # shorter than this is a breath, not a beat boundary
MIN_SEGMENT = 0.55      # no real narration beat is briefer than this
MAX_SHARE_ERROR = 0.55  # a segment may be this far off its word-count share


def duration(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    return float(out.stdout.strip())


def silences(path: Path) -> list[tuple[float, float]]:
    r = subprocess.run(["ffmpeg", "-v", "info", "-i", str(path), "-af",
                        f"silencedetect=noise={NOISE_DB}dB:d={MIN_SILENCE}", "-f", "null", "-"],
                       capture_output=True, text=True)
    log = r.stderr
    starts = [float(m) for m in re.findall(r"silence_start:\s*(-?[\d.]+)", log)]
    ends = [float(m) for m in re.findall(r"silence_end:\s*([\d.]+)", log)]
    return [(s, e) for s, e in zip(starts, ends) if e > s]


def _gaps(path: Path, n: int) -> list[tuple[float, float]] | None:
    """The n-1 gaps most likely to be beat boundaries, longest first then sorted.

    Taking the longest gaps rather than every gap over a threshold is what makes
    this robust: a comma inside a sentence pauses too, but never for as long as
    the break between two beats.
    """
    total = duration(path)
    inner = [(s, e) for s, e in silences(path) if s > 0.30 and e < total - 0.20]
    if len(inner) < n - 1:
        return None
    longest = sorted(inner, key=lambda se: se[1] - se[0], reverse=True)[: n - 1]
    return sorted(longest)


def split(wav: Path, lines: list[str], out_dir: Path) -> list[tuple[float, float]] | None:
    """Cut `wav` into one clip per line. None when the cut cannot be trusted."""
    n = len(lines)
    gaps = _gaps(wav, n)
    if gaps is None:
        return None
    total = duration(wav)

    # Cut at the edges of each gap, not its middle: a segment padded with half a
    # pause would be measured as speech and inflate the beat it belongs to.
    lead = next((e for s, e in silences(wav) if s <= 0.05), 0.0)
    tail = next((s for s, e in reversed(silences(wav)) if e >= total - 0.05), total)
    spans = []
    start = lead
    for gs, ge in gaps:
        spans.append((start, gs))
        start = ge
    spans.append((start, tail))

    if any(e - s < MIN_SEGMENT for s, e in spans):
        return None
    words = [max(len(l.split()), 1) for l in lines]
    share = [w / sum(words) for w in words]
    for (s, e), sh in zip(spans, share):
        got = (e - s) / total
        if abs(got - sh) / sh > MAX_SHARE_ERROR:
            return None

    out_dir.mkdir(parents=True, exist_ok=True)
    for i, (s, e) in enumerate(spans, 1):
        r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(wav),
                            "-ss", f"{s:.3f}", "-to", f"{e:.3f}",
                            "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le",
                            str(out_dir / f"{i:02d}.wav")], capture_output=True, text=True)
        if r.returncode != 0:
            return None
    return spans
