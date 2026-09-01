"""One frame per narration beat, tiled — the review surface before publishing.

Sampling at 80% through each beat catches the scene fully revealed rather than
mid-entrance, which is when layout problems are actually visible.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


def build(out_dir: Path, at_fraction: float = 0.80) -> Path:
    timing = json.loads((out_dir / "timing.json").read_text())
    videos = sorted(out_dir.glob("*_1080x1920.mp4"))
    if not videos:
        raise FileNotFoundError(f"no finished video in {out_dir}")
    video = videos[0]
    frames_dir = out_dir / "frames"
    frames_dir.mkdir(exist_ok=True)
    for f in frames_dir.glob("*.jpg"):
        f.unlink()

    shots = []
    for i, b in enumerate(timing["beats"]):
        t = b["start"] + b["dur"] * at_fraction
        dest = frames_dir / f"{i:02d}.jpg"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", str(video),
                        "-frames:v", "1", "-q:v", "3", str(dest)], check=True)
        shots.append(dest)

    n = len(shots)
    cols = 4 if n >= 4 else n
    # `tile` pads a short last row with the chosen colour instead of leaving the
    # undefined cells xstack fills with green.
    chain = ("".join(f"[{i}:v]scale=340:-1[s{i}];" for i in range(n))
             + "".join(f"[s{i}]" for i in range(n))
             + f"concat=n={n}:v=1:a=0[strip];"
             + f"[strip]tile={cols}x{(n + cols - 1) // cols}:color=#0A1122:margin=6:padding=4[o]")
    sheet = out_dir / "contact-sheet.jpg"
    subprocess.run(["ffmpeg", "-v", "error", "-y", *sum([["-i", str(s)] for s in shots], []),
                    "-filter_complex", chain, "-map", "[o]", "-q:v", "3", str(sheet)], check=True)
    return sheet


def main() -> int:
    ap = argparse.ArgumentParser(description="Tile one frame per beat for review.")
    ap.add_argument("out_dir", type=Path)
    a = ap.parse_args()
    print(build(a.out_dir))
    return 0


if __name__ == "__main__":
    sys.exit(main())
