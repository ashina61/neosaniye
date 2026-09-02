"""Animated mechanism clips, rendered with Manim.

diagram.py draws a mechanism; this runs it. A static shape can show that a
window has three panes, but it cannot show charge moving along a wire, a wave
changing its wavelength, or a beam scattering at a boundary — and those are the
explanations that only land in motion.

The model never supplies code. It picks an archetype and fills in its fields,
exactly as it does for a diagram, and motion_scene.py turns that data into an
animation. Manim is a local code-execution boundary — the repo's own
math_animate tool ships a denylist it openly calls "not a sandbox" — and this
pipeline runs in a runner holding upload tokens, so the boundary is closed by
never letting caller text reach anything but a label.

Manim is optional. If it is missing, or a render fails, the caller falls back to
a static scene: losing an animation is a worse video, losing the run is no video.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

LIB = Path(__file__).resolve().parent
SCENE = LIB / "motion_scene.py"
FONTS_SRC = LIB.parent / "assets" / "fonts"

SHAPES = ("circuit", "wave", "rays", "orbit")

# How long each label may be. Unlike the SVG diagrams, these are character
# counts rather than measured widths: the text goes through Pango at a Manim
# scale factor, and deriving a pixel width through that chain would be a guess
# dressed up as a measurement. They are set from what actually fits at each
# position — `flow_label` is the tight one because the blocked branch drops
# through the middle of the frame beside it. motion_scene.py truncates anything
# longer, and write_spec rejects it before that can happen.
CAPS = {
    "node": 12,        # circuit from/to/perch, orbit center/satellite
    "flow": 22,        # circuit flow_label, beside the branch
    "branch": 24,      # circuit branch label, under the floor
    "label": 14,       # wave and rays labels
    "mark": 10,        # orbit marks, close to the frame edge
    "note": 34,        # the line under a wave or an orbit
}
# Every scene is written to outrun the longest beat, and build.py trims it to
# the beat's exact length. A clip that ends early would show the frame's bare
# background for the remainder, which reads as a bug.
MIN_SECONDS = 5.0


def available() -> bool:
    try:
        import manim  # noqa: F401
    except Exception:
        return False
    return shutil.which("ffmpeg") is not None


def _fonts(work: Path) -> str:
    """Manim's text goes through Pango, which needs TTF; ours ship as woff2.

    Converting is just a container change — same glyphs, same metrics — so it
    is done here rather than committing a second copy of every face.
    """
    out = work / "fonts"
    out.mkdir(parents=True, exist_ok=True)
    try:
        from fontTools.ttLib import TTFont
        for src in sorted(FONTS_SRC.glob("inter-*.woff2")):
            dest = out / (src.stem + ".ttf")
            if not dest.exists():
                f = TTFont(src)
                f.flavor = None
                f.save(dest)
    except Exception as e:
        print(f"    font conversion failed ({e}); manim falls back to a system sans")
    return str(out)


def render(sc: dict, out: Path, work: Path) -> Path | None:
    """Render one motion scene to MP4, or return None if Manim could not."""
    shape = sc.get("shape")
    if shape not in SHAPES:
        raise ValueError(f"unknown motion shape {shape!r}; have {sorted(SHAPES)}")
    if not available():
        print("    manim unavailable — motion scene falls back to a static one")
        return None

    work.mkdir(parents=True, exist_ok=True)
    data = {k: v for k, v in sc.items()
            if k not in ("type", "headline", "stock", "motif", "_has_stock")}
    env = dict(os.environ, MOTION_DATA=json.dumps(data), MOTION_FONTS=_fonts(work),
               MOTION_CAPS=json.dumps(CAPS))
    media = work / "manim"
    try:
        r = subprocess.run(
            [sys.executable, "-m", "manim", "render", "-qh", "--format=mp4",
             "--media_dir", str(media), "--fps", "30", str(SCENE), "Motion"],
            capture_output=True, text=True, env=env, timeout=600)
    except subprocess.TimeoutExpired:
        print("    manim render timed out — falling back to a static scene")
        return None
    made = sorted(media.rglob("Motion.mp4"))
    if r.returncode != 0 or not made:
        print(f"    manim render failed ({r.returncode}): {(r.stderr or '')[-300:].strip()}")
        return None
    out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(made[0], out)
    return out
