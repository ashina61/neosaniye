"""Bundle a finished video for the platforms this environment cannot reach.

Instagram and Facebook are blocked at this network's egress gateway, so the run
produces a folder that is ready to post by hand: the video, a cover frame, and
the caption text already written per platform.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path


def cover(video: Path, at: float, out: Path) -> Path:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(at), "-i", str(video),
                    "-frames:v", "1", "-q:v", "2", str(out)], check=True)
    return out


def bundle(video: Path, spec: dict, copy: dict, out_dir: Path, cover_at: float = 3.2) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    dest = out_dir / video.name
    if dest.resolve() != video.resolve():
        dest.write_bytes(video.read_bytes())
    cover(video, cover_at, out_dir / "cover.jpg")

    tags = copy.get("hashtags", [])
    tagline = " ".join(f"#{t.lstrip('#')}" for t in tags)
    (out_dir / "instagram.txt").write_text(
        f"{copy['hook']}\n\n{copy['caption']}\n\n{tagline}\n")
    (out_dir / "facebook.txt").write_text(
        f"{copy['hook']}\n\n{copy['caption']}\n")
    (out_dir / "youtube.json").write_text(json.dumps({
        "title": copy["title"], "description": copy["youtube_description"],
        "tags": tags}, indent=1))
    (out_dir / "README.txt").write_text(
        "Ready to post by hand.\n\n"
        f"  {video.name}   1080x1920 vertical, sound on\n"
        "  cover.jpg      suggested thumbnail / first frame\n"
        "  instagram.txt  Reels caption + hashtags\n"
        "  facebook.txt   Facebook caption\n"
        "  youtube.json   title/description/tags (uploaded automatically when\n"
        "                 YOUTUBE_* credentials are present)\n")
    return out_dir
