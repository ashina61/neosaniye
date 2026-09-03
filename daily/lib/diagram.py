"""Explanatory diagram shapes for compose.py.

The motifs this replaces were decorative: a wave, some rings, a few particles.
They filled the frame but taught nothing, so every video came out as ten
captions over stock footage. These are parametric diagrams instead — the model
supplies the topic's own content and the shape does the explaining, which is the
thing that made the hand-built videos work and the generated ones flat.

A stock library cannot supply a cross-section of an aircraft window; it can only
supply a wing. This can.
"""
from __future__ import annotations

import html

# The art zone, in composition pixels, and the single definition of it: compose
# lays the headline band out below ART_BOTTOM and motion_scene converts these
# same two numbers into Manim units. Three copies of a layout constant is how
# they drift apart.
ART_TOP, ART_BOTTOM = 260, 1000
FRAME_H = 1920
MID_X = 540


def esc(s) -> str:
    return html.escape(str(s), quote=True)


def layers(sid: str, items: list[dict]) -> str:
    """Stacked labelled bands — panes of glass, layers of atmosphere, strata.

    `mark: "hole"` cuts a visible gap in a band, which is exactly the shape a
    bleed-hole explanation needs and no stock clip can provide.
    """
    items = items[:4]
    n = len(items)
    band_h, gap = 160, 44
    total = n * band_h + (n - 1) * gap
    y0 = ART_TOP + (ART_BOTTOM - ART_TOP - total) / 2
    x, w = 96, 888
    out = []
    for i, it in enumerate(items):
        y = y0 + i * (band_h + gap)
        hole = (it.get("mark") or "").lower() == "hole"
        if hole:
            # A narrow notch with square inner edges reads as a hole punched
            # through one band. Two rounded boxes with a ring between them read
            # as two separate objects, which is the wrong idea entirely.
            cut, cw = MID_X + 210, 52
            out.append(f'<path class="dgband" d="M{x+16},{y:.0f} H{cut-cw/2:.0f} V{y+band_h:.0f} '
                       f'H{x+16} A16,16 0 0 1 {x},{y+band_h-16:.0f} V{y+16:.0f} '
                       f'A16,16 0 0 1 {x+16},{y:.0f} Z"/>')
            out.append(f'<path class="dgband" d="M{cut+cw/2:.0f},{y:.0f} H{x+w-16:.0f} '
                       f'A16,16 0 0 1 {x+w},{y+16:.0f} V{y+band_h-16:.0f} '
                       f'A16,16 0 0 1 {x+w-16:.0f},{y+band_h:.0f} H{cut+cw/2:.0f} Z"/>')
            out.append(f'<rect class="dghole" x="{cut-cw/2:.0f}" y="{y:.0f}" width="{cw}" '
                       f'height="{band_h}"/>')
            out.append(f'<text class="dgtag" x="{cut}" y="{y-22:.0f}" text-anchor="middle">'
                       f'{esc(it.get("mark_label", "the hole"))}</text>')
        else:
            out.append(f'<rect class="dgband" x="{x}" y="{y:.0f}" width="{w}" '
                       f'height="{band_h}" rx="16"/>')
        out.append(f'<text class="dglabel" x="{x+36}" y="{y+band_h/2-4:.0f}">'
                   f'{esc(it.get("label",""))}</text>')
        if it.get("note"):
            out.append(f'<text class="dgnote" x="{x+36}" y="{y+band_h/2+42:.0f}">'
                       f'{esc(it["note"])}</text>')
    return f'<g id="{sid}-dg" class="diagram">{"".join(out)}</g>'


def route(sid: str, src: str, dst: str, routes: list[dict]) -> str:
    """Two ways from A to B, one of them blocked — a detour that leads nowhere."""
    routes = routes[:2]
    ax, bx, r = 168, 912, 74
    mid = (ART_TOP + ART_BOTTOM) / 2 - 30
    out = []
    for cx, label in ((ax, src), (bx, dst)):
        out.append(f'<circle class="dgnode" cx="{cx}" cy="{mid:.0f}" r="{r}"/>')
        # under the circle, never inside it: a seven-letter word does not fit a
        # 148px disc and would be clipped without any gate noticing
        out.append(f'<text class="dgnodetext" x="{cx}" y="{mid+r+52:.0f}" '
                   f'text-anchor="middle">{esc(label)}</text>')
    for i, rt in enumerate(routes):
        blocked = (rt.get("state") or "").lower() == "blocked"
        arc = -1 if i == 0 else 1
        cy = mid + arc * 250
        cls = "dgpath dgpath-blocked" if blocked else "dgpath dgpath-open"
        out.append(f'<path id="{sid}-r{i}" class="{cls}" '
                   f'd="M{ax+r+8},{mid:.0f} C{ax+210},{cy:.0f} {bx-210},{cy:.0f} {bx-r-8},{mid:.0f}"/>')
        # the arc peaks near ±187 and a blocked one carries a 40px cross on top
        # of it, so its label has to clear the cross rather than the curve
        ly = mid + arc * (262 if blocked else 205)
        out.append(f'<text class="dgnote" x="{MID_X}" y="{ly:.0f}" '
                   f'text-anchor="middle">{esc(rt.get("label",""))}</text>')
        if blocked:
            k, cyk = 40, mid + arc * 188
            out.append(f'<g id="{sid}-x{i}" class="dgcross">'
                       f'<line x1="{MID_X-k}" y1="{cyk-k:.0f}" x2="{MID_X+k}" y2="{cyk+k:.0f}"/>'
                       f'<line x1="{MID_X+k}" y1="{cyk-k:.0f}" x2="{MID_X-k}" y2="{cyk+k:.0f}"/></g>')
    return f'<g id="{sid}-dg" class="diagram">{"".join(out)}</g>'


def flow(sid: str, nodes: list[str]) -> str:
    """An ordered chain, stacked down the frame because the frame is vertical."""
    nodes = [n for n in nodes if n][:4]
    n = len(nodes)
    box_h, gap = 134, 84
    total = n * box_h + (n - 1) * gap
    y0 = ART_TOP + (ART_BOTTOM - ART_TOP - total) / 2
    x, w = 140, 800
    out = []
    for i, label in enumerate(nodes):
        y = y0 + i * (box_h + gap)
        # the chain ends somewhere, so say so: the last box carries the accent
        cls = "dgbox dgbox-end" if i == n - 1 else "dgbox"
        out.append(f'<rect class="{cls}" x="{x}" y="{y:.0f}" width="{w}" '
                   f'height="{box_h}" rx="20"/>')
        out.append(f'<text class="dglabel" x="{MID_X}" y="{y+box_h/2+16:.0f}" '
                   f'text-anchor="middle">{esc(label)}</text>')
        if i < n - 1:
            ay, by = y + box_h + 12, y + box_h + gap - 12
            out.append(f'<path class="dgarrow" d="M{MID_X},{ay:.0f} L{MID_X},{by:.0f}"/>')
            out.append(f'<path class="dgarrow dgarrow-head" '
                       f'd="M{MID_X-16},{by-18:.0f} L{MID_X},{by:.0f} L{MID_X+16},{by-18:.0f}"/>')
    return f'<g id="{sid}-dg" class="diagram">{"".join(out)}</g>'


SHAPES = {"layers": layers, "route": route, "flow": flow}


def build(sid: str, sc: dict) -> str:
    shape = sc.get("shape", "layers")
    if shape == "layers":
        body = layers(sid, sc.get("layers") or [])
    elif shape == "route":
        body = route(sid, sc.get("from", "A"), sc.get("to", "B"), sc.get("routes") or [])
    elif shape == "flow":
        body = flow(sid, sc.get("nodes") or [])
    else:
        raise ValueError(f"unknown diagram shape {shape!r}; have {sorted(SHAPES)}")
    return ('<svg class="art" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice">'
            + body + "</svg>")
