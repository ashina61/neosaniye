"""Measure how wide a line will actually render, using the real font metrics.

A character count is what a model can follow, but it is not the constraint —
"CATCHES MISMATCH" and "MMMMMMMMMMMMMMMM" are both sixteen characters and one of
them runs 485px off the frame. Headlines are set `nowrap` in a condensed face,
so an over-wide line is silently cropped by the canvas and no gate below this
one catches it.
"""
from __future__ import annotations

import functools
from pathlib import Path

FONTS = Path(__file__).resolve().parents[1] / "assets" / "fonts"
FRAME = 1080
GUTTER = 78                      # .klines / .stack / .endcard left+right inset
COLUMN = FRAME - GUTTER * 2      # 924px of usable width
LETTER_SPACING = 0.01            # .kh letter-spacing, in em

# font-size of each place a long line can appear, from compose.py's CSS
SIZES = {"kh": 118, "slam": 112, "endcard": 124, "col_big": 104}
COL_BIG_WIDTH = 392              # inside a .compare column, after gap and padding


@functools.lru_cache(maxsize=4)
def _metrics(face: str = "anton-400") -> tuple[dict, float]:
    from fontTools.ttLib import TTFont
    f = TTFont(FONTS / f"{face}.woff2")
    upem = f["head"].unitsPerEm
    hmtx, cmap = f["hmtx"], f.getBestCmap()
    widths = {ch: hmtx[cmap[ord(ch)]][0] / upem
              for ch in map(chr, range(32, 127)) if ord(ch) in cmap}
    return widths, sum(widths.values()) / max(len(widths), 1)


def width_em(text: str, face: str = "anton-400") -> float:
    widths, fallback = _metrics(face)
    return sum(widths.get(c, fallback) + LETTER_SPACING for c in text)


def width_px(text: str, font_px: int, face: str = "anton-400") -> float:
    return width_em(text, face) * font_px


def overflow(text: str, kind: str = "kh") -> float:
    """Pixels by which `text` exceeds its column. <= 0 means it fits."""
    limit = COL_BIG_WIDTH if kind == "col_big" else COLUMN
    return width_px(text, SIZES[kind]) - limit


def check(text: str, kind: str = "kh") -> str | None:
    """A message naming the problem, or None when the line fits."""
    over = overflow(text, kind)
    if over <= 0:
        return None
    limit = COL_BIG_WIDTH if kind == "col_big" else COLUMN
    return (f"{text!r} renders {width_px(text, SIZES[kind]):.0f}px wide, "
            f"{over:.0f}px past the {limit}px column — use shorter or narrower words")
