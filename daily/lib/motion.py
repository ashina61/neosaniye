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

sys.path.insert(0, str(Path(__file__).resolve().parent))
import textfit  # noqa: E402

LIB = Path(__file__).resolve().parent
SCENE = LIB / "motion_scene.py"
FONTS_SRC = LIB.parent / "assets" / "fonts"

SHAPES = ("circuit", "wave", "rays", "orbit")

# How long each label may be, measured rather than guessed. Each entry is the
# room that position actually has in composition pixels and the Manim scale it
# is set at; textfit turns those into a character budget using the real Inter
# metrics, the same way the SVG diagram caps are derived.
#
# The budget is for average glyphs. A line of unusually wide ones still fits
# because the two end labels are anchored to the frame edges rather than
# centred, and motion_scene truncates anything past the cap as a last resort.
_BUDGETS = {
    "node":   (400, 0.50),   # circuit from/to (edge-anchored), orbit center/satellite
    "flow":   (620, 0.50),   # circuit flow_label, clearing the branch at x=2.6
    "branch": (900, 0.50),   # circuit branch label, under the full-width floor
    "label":  (430, 0.56),   # wave and rays labels
    "mark":   (280, 0.44),   # orbit marks, close to the frame edge
    "note":   (900, 0.50),   # the line under a wave or an orbit
}
CAPS = {k: textfit.manim_chars(px, scale) for k, (px, scale) in _BUDGETS.items()}
# the same room, in the frame units motion_scene draws in (120px per unit)
ROOM = {k: px / 120.0 for k, (px, _s) in _BUDGETS.items()}

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
               MOTION_CAPS=json.dumps(CAPS), MOTION_ROOM=json.dumps(ROOM))
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
