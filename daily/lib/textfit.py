"""Measure how wide a line will actually render, using the real font metrics.

A character count is what a model can follow, but it is not the constraint —
"CATCHES MISMATCH" and "MMMMMMMMMMMMMMMM" are both sixteen characters and one of
them runs 485px off the frame. Headlines are set `nowrap` in a condensed face,
so an over-wide line is silently cropped by the canvas and no gate below this
one catches it.

Diagram text has the same problem in a different face: SVG `<text>` does not
wrap at all, so a long band label runs straight out of the frame. Every place a
line can appear is listed in KINDS with the face, size and column it renders in,
taken from compose.py's CSS and diagram.py's geometry.
"""
from __future__ import annotations

import functools
from pathlib import Path

FONTS = Path(__file__).resolve().parents[1] / "assets" / "fonts"
FRAME = 1080
GUTTER = 78                      # .klines / .stack / .endcard left+right inset
COLUMN = FRAME - GUTTER * 2      # 924px of usable width

# Every line that can overflow: the face it is set in, its font-size, the width
# it has to fit, and its letter-spacing in em.
KINDS = {
    "kh":        {"face": "anton-400", "size": 118, "limit": COLUMN, "track": 0.01},
    "slam":      {"face": "anton-400", "size": 112, "limit": COLUMN, "track": 0.01},
    "endcard":   {"face": "anton-400", "size": 124, "limit": COLUMN, "track": 0.01},
    # inside a .compare column, after gap and padding
    "col_big":   {"face": "anton-400", "size": 104, "limit": 392, "track": 0.01},
    # diagram.py: a band is 888 wide with a 36px inset on each side
    "dg_label":  {"face": "inter-800", "size": 46, "limit": 816, "track": 0.0},
    # a band carrying the hole loses everything right of the notch at x=724
    "dg_hole":   {"face": "inter-800", "size": 46, "limit": 560, "track": 0.0},
    "dg_note":   {"face": "inter-400", "size": 32, "limit": 816, "track": 0.0},
    # a node label is centred on a circle 168px from the frame edge
    "dg_node":   {"face": "inter-800", "size": 38, "limit": 300, "track": 0.0},
    # a flow box is 800 wide, label centred
    "dg_flow":   {"face": "inter-800", "size": 46, "limit": 720, "track": 0.0},
    # a route label is centred on the frame and must clear neither node
    "dg_route":  {"face": "inter-400", "size": 32, "limit": 620, "track": 0.0},
}

# kept so callers can still ask for a size directly
SIZES = {k: v["size"] for k, v in KINDS.items()}
COL_BIG_WIDTH = KINDS["col_big"]["limit"]


@functools.lru_cache(maxsize=8)
def _metrics(face: str = "anton-400") -> tuple[dict, float]:
    from fontTools.ttLib import TTFont
    f = TTFont(FONTS / f"{face}.woff2")
    upem = f["head"].unitsPerEm
    hmtx, cmap = f["hmtx"], f.getBestCmap()
    widths = {ch: hmtx[cmap[ord(ch)]][0] / upem
              for ch in map(chr, range(32, 127)) if ord(ch) in cmap}
    return widths, sum(widths.values()) / max(len(widths), 1)


def width_em(text: str, face: str = "anton-400", track: float = 0.01) -> float:
    widths, fallback = _metrics(face)
    return sum(widths.get(c, fallback) + track for c in text)


def width_px(text: str, font_px: int, face: str = "anton-400",
             track: float = 0.01) -> float:
    return width_em(text, face, track) * font_px


def rendered(text: str, kind: str = "kh") -> float:
    k = KINDS[kind]
    return width_px(text, k["size"], k["face"], k["track"])


def overflow(text: str, kind: str = "kh") -> float:
    """Pixels by which `text` exceeds its column. <= 0 means it fits."""
    return rendered(text, kind) - KINDS[kind]["limit"]


def check(text: str, kind: str = "kh") -> str | None:
    """A message naming the problem, or None when the line fits."""
    over = overflow(text, kind)
    if over <= 0:
        return None
    limit = KINDS[kind]["limit"]
    return (f"{text!r} renders {rendered(text, kind):.0f}px wide, "
            f"{over:.0f}px past the {limit}px column — use shorter or narrower words")


def budget(kind: str) -> int:
    """A character count the model can actually follow, from the measured column.

    The validator measures; this is only the instruction, so it uses the face's
    average advance. A line of average glyphs fits, and a line of unusually wide
    ones is still caught below by `check` rather than reaching the canvas.
    """
    k = KINDS[kind]
    _, avg = _metrics(k["face"])
    return int(k["limit"] / ((avg + k["track"]) * k["size"]))


# How far a line may be shrunk to fit its column before the type stops reading
# as a display headline. Below this it is genuinely too long, not just wide.
MIN_SCALE = 0.76


def fit_size(text: str, kind: str = "kh") -> int | None:
    """The font-size at which `text` fits its column, or None if it cannot.

    Rejecting a whole draft because a headline is 55px too wide was the
    validator enforcing a font-size that this template chose, not a limit the
    frame actually has. A line that overflows is set smaller instead, and only
    a line that would have to shrink past MIN_SCALE is a real problem.
    """
    k = KINDS[kind]
    w = rendered(text, kind)
    if w <= k["limit"]:
        return k["size"]
    size = int(k["size"] * k["limit"] / w)
    return size if size >= int(k["size"] * MIN_SCALE) else None


# Manim sets its text through Pango at its own scale, so a font-size in px is
# not available the way it is for the CSS and SVG above. This is the missing
# constant, measured rather than derived: render a string on an otherwise empty
# 1080x1920 stage, count its ink columns in the PNG, divide by its width in em.
# Ten Inter-800 "M"s at Manim scale 0.5 come out 384px wide, which is this.
# (Measure on a bare stage. Doing it inside a real scene once caught the edge of
# a full-width stroke and gave 220, nearly three times the truth.)
MANIM_PX_PER_EM = 81.4


def manim_px(text: str, scale: float, face: str = "inter-800") -> float:
    """How wide `text` renders in a Manim scene, in composition pixels."""
    return width_em(text, face, 0.0) * scale * MANIM_PX_PER_EM


def manim_chars(px_limit: float, scale: float, face: str = "inter-800") -> int:
    """A character budget for a Manim label with `px_limit` of room.

    Average advance, like `budget` above: a line of average glyphs fits, and
    motion_scene truncates the rare line of unusually wide ones.
    """
    _, avg = _metrics(face)
    return max(4, int(px_limit / (avg * scale * MANIM_PX_PER_EM)))
