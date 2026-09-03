"""The Manim scene Manim itself executes. Driven entirely by MOTION_DATA.

Kept in its own file rather than embedded in motion.py as a string so it can be
read, linted and edited like ordinary code. It is never imported by the
pipeline — motion.render() hands the path to `manim render`, which imports it in
a subprocess of its own.

Geometry: the frame is 16 units tall by 9 wide, so one unit is 120px. CY is the
centre of the art zone (260-1000px of 1920) and TOP/BOT/L/R are the box a scene
may draw in. Below BOT is the headline band, and nothing here may reach it.
"""
import json
import os

import manimpango
from manim import *

import diagram

DATA = json.loads(os.environ["MOTION_DATA"])
FONTS = os.environ.get("MOTION_FONTS", "")
BG, CYAN, AMBER, RED, TEXT, MUTED = (
    "#080D18", "#46E0FF", "#F5B942", "#FF6161", "#F2F5FA", "#8A96AC")
# The art zone comes from diagram.py, converted here rather than restated: the
# frame is 16 units over 1920px, so one unit is 120px and the centre of the
# frame is 960px.
_PX = diagram.FRAME_H / 16.0
CY = (diagram.FRAME_H / 2 - (diagram.ART_TOP + diagram.ART_BOTTOM) / 2) / _PX
_HALF = (diagram.ART_BOTTOM - diagram.ART_TOP) / 2 / _PX
TOP, BOT = CY + _HALF, CY - _HALF
L, R = -4.0, 4.0

config.pixel_width, config.pixel_height = 1080, 1920
config.frame_height, config.frame_width = 16.0, 9.0
config.frame_rate = 30
config.background_color = BG

# the same faces the rest of the frame is set in, so a clip does not read as a
# different product spliced into the middle of the video
FACE = "sans-serif"
if FONTS and os.path.isdir(FONTS):
    for _f in sorted(os.listdir(FONTS)):
        if _f.endswith(".ttf") and manimpango.register_font(os.path.join(FONTS, _f)):
            FACE = "Inter"


# the same caps write_spec validates against, so a line that passed the
# validator is never truncated here, and the room each position actually has
CAPS = json.loads(os.environ.get("MOTION_CAPS") or "{}")
ROOM = json.loads(os.environ.get("MOTION_ROOM") or "{}")


def cap(s, kind):
    s = str(s or "").strip()
    n = CAPS.get(kind, 30)
    return s if len(s) <= n else s[:n - 1] + "…"


def label(s, kind, size=0.58, color=TEXT, bold=True):
    """Set the line, then shrink it if its glyphs are wider than average.

    The cap is a character budget for average glyphs, so a legal line of
    unusually wide ones still overruns its room. Shrinking it is the same trade
    the headline band makes: smaller type beats type that collides with the
    label opposite it.
    """
    t = Text(cap(s, kind), font=FACE, color=color,
             weight=BOLD if bold else NORMAL).scale(size)
    room = ROOM.get(kind)
    if room and t.width > room:
        t.scale(room / t.width)
    return t


MIN_SECONDS = 5.5


class Motion(Scene):
    def construct(self):
        getattr(self, "shape_" + DATA["shape"])()
        # A clip shorter than its beat would leave the bare background on screen
        # for the remainder, which reads as a bug rather than a pause.
        self.wait(max(0.8, MIN_SECONDS - self.renderer.time))

    # ------------------------------------------------------------- circuit
    def shape_circuit(self):
        """Something flowing from A to B, and a way it does not go."""
        # With a branch the wire sits high to leave the frame below it for the
        # detour. Without one there is nothing to leave room for, and holding
        # the wire up there leaves two thirds of the art zone empty — the frame
        # reads as unfinished rather than spare. So it centres instead.
        branched = bool(DATA.get("branch"))
        wy = TOP - 1.2 if branched else CY
        self.play(Create(Line([L, wy, 0], [R, wy, 0], color=CYAN, stroke_width=13)),
                  FadeIn(VGroup(*[Dot(radius=0.17, color=CYAN).move_to([x, wy, 0])
                                  for x in (L, R)])), run_time=0.6)

        # anchored to the frame edges, not centred on a point: a centred label
        # of unusually wide glyphs runs off the side, and there is nothing out
        # there to notice it
        tags = []
        for k, edge, sign in (("from", L, 1), ("to", R, -1)):
            if not DATA.get(k):
                continue
            t = label(DATA[k], "node", 0.5, CYAN)
            t.move_to([edge + sign * t.width / 2, wy + 0.8, 0])
            tags.append(FadeIn(t, shift=DOWN * 0.15))
        if tags:
            self.play(*tags, run_time=0.4)

        if DATA.get("perch"):
            body = RoundedRectangle(width=1.5, height=0.86, corner_radius=0.4,
                                    color=AMBER, fill_opacity=1, stroke_width=0)
            self.play(FadeIn(body.move_to([0, wy + 0.47, 0]), scale=0.4), run_time=0.4)
            self.play(FadeIn(label(DATA["perch"], "node", 0.54, AMBER).move_to([0, wy + 1.6, 0]),
                             shift=DOWN * 0.2), run_time=0.35)

        dots = VGroup(*[Dot(radius=0.13, color=TEXT).move_to([L, wy, 0]) for _ in range(11)])
        self.add(dots)
        if DATA.get("flow_label"):
            # capped short and centred: the branch drops at x=2.6, and a longer
            # line would run straight through it
            self.play(FadeIn(label(DATA["flow_label"], "flow", 0.5, MUTED, False)
                             .move_to([0, wy - 0.95, 0])), run_time=0.35)
        self.play(*[d.animate.move_to([R, wy, 0]) for d in dots],
                  run_time=2.0, lag_ratio=0.06, rate_func=linear)

        br = DATA.get("branch") or {}
        if branched:
            bx, gy = 2.6, BOT + 1.0
            self.play(Create(DashedVMobject(Line([bx, wy, 0], [bx, gy, 0], color=RED,
                                                 stroke_width=11), num_dashes=10)),
                      Create(Line([L, gy, 0], [R, gy, 0], color=MUTED, stroke_width=9)),
                      run_time=0.7)
            k, cy = 0.44, (wy + gy) / 2
            self.play(Create(VGroup(
                Line([bx - k, cy - k, 0], [bx + k, cy + k, 0], color=RED, stroke_width=14),
                Line([bx + k, cy - k, 0], [bx - k, cy + k, 0], color=RED, stroke_width=14))),
                run_time=0.4)
            if br.get("label"):
                # under the full-width floor, centred: at the branch's own x it
                # would hang off the right edge
                self.play(FadeIn(label(br["label"], "branch", 0.5, RED)
                                 .move_to([0, gy - 0.7, 0])), run_time=0.4)

    # ---------------------------------------------------------------- wave
    def shape_wave(self):
        """One or two travelling waves, spaced so each label owns its own air."""
        rows = (DATA.get("waves") or [])[:2]
        colors = [CYAN, AMBER]
        slots = [CY + 1.6, CY - 1.4] if len(rows) > 1 else [CY + 0.4]
        for i, w in enumerate(rows):
            base = slots[i]
            wl = max(0.7, min(4.0, float(w.get("wavelength", 2.0))))
            amp = max(0.35, min(1.05, float(w.get("amplitude", 0.85))))
            col = colors[i % 2]
            if w.get("label"):
                # both labels sit above their own wave: below the lower one is
                # outside the art zone and lands on the note line
                ly = base + amp + 0.85
                self.play(FadeIn(label(w["label"], "label", 0.56, col).move_to([0, ly, 0])),
                          run_time=0.35)
            t = ValueTracker(0.0)
            self.add(always_redraw(
                lambda base=base, wl=wl, amp=amp, col=col, t=t: FunctionGraph(
                    lambda x, wl=wl, amp=amp, t=t:
                        amp * np.sin(TAU * (x / wl) - t.get_value()),
                    x_range=[L, R, 0.025], color=col, stroke_width=10).shift(UP * base)))
            self.play(t.animate.set_value(TAU * 1.5), run_time=1.5, rate_func=linear)
        if DATA.get("note"):
            self.play(FadeIn(label(DATA["note"], "note", 0.5, MUTED, False)
                             .move_to([0, BOT + 0.3, 0])), run_time=0.4)

    # ---------------------------------------------------------------- rays
    def shape_rays(self):
        """A beam meeting a boundary and leaving it changed."""
        by = CY + 0.3
        self.play(FadeIn(Rectangle(width=8.6, height=1.7, color=MUTED, fill_opacity=0.18,
                                   stroke_width=3).move_to([0, by, 0])), run_time=0.4)
        if DATA.get("medium"):
            self.play(FadeIn(label(DATA["medium"], "label", 0.54, MUTED, False)
                             .move_to([0, by, 0])), run_time=0.35)

        self.play(Create(Line([-3.2, TOP - 0.15, 0], [0, by + 0.85, 0],
                              color=TEXT, stroke_width=11)), run_time=0.6)
        if DATA.get("incoming"):
            self.play(FadeIn(label(DATA["incoming"], "label", 0.5, TEXT)
                             .move_to([1.1, TOP - 0.25, 0])), run_time=0.35)

        outs = (DATA.get("outgoing") or [])[:3]
        colors, rays, tags = [CYAN, AMBER, RED], [], []
        for i, o in enumerate(outs):
            spread = (i - (len(outs) - 1) / 2) * 2.5
            rays.append(Create(Line([0, by - 0.85, 0], [spread, BOT + 0.8, 0],
                                    color=colors[i % 3], stroke_width=10)))
            if o.get("label"):
                tags.append(FadeIn(label(o["label"], "label", 0.48, colors[i % 3])
                                   .move_to([spread, BOT + 0.3, 0])))
        if rays:
            self.play(*rays, run_time=0.9)
        if tags:
            self.play(*tags, run_time=0.45)

    # --------------------------------------------------------------- orbit
    def shape_orbit(self):
        """One body going round another — tides, phases, seasons."""
        rx, ry = 2.7, 2.1
        path = Ellipse(width=rx * 2, height=ry * 2, color=MUTED, stroke_width=5)
        path.set_stroke(opacity=0.55).move_to([0, CY, 0])
        self.play(Create(path), FadeIn(Dot(radius=0.62, color=AMBER)
                                       .move_to([0, CY, 0]), scale=0.5), run_time=0.7)
        if DATA.get("center"):
            self.play(FadeIn(label(DATA["center"], "node", 0.5, AMBER)
                             .move_to([0, CY - 1.2, 0])), run_time=0.35)

        for i, m in enumerate((DATA.get("marks") or [])[:2]):
            side = 1 if i == 0 else -1
            self.play(FadeIn(Dot(radius=0.24, color=CYAN)
                             .move_to([side * (rx + 1.0), CY, 0]), scale=0.4), run_time=0.3)
            if m:
                # below the mark: above it is where the orbiting body's own tag
                # passes, and the two would sit on top of each other
                self.play(FadeIn(label(m, "mark", 0.44, CYAN)
                                 .move_to([side * (rx + 0.6), CY - 1.0, 0])), run_time=0.3)

        sat = Dot(radius=0.3, color=TEXT).move_to([rx, CY, 0])
        self.add(sat)
        if DATA.get("satellite"):
            tag = label(DATA["satellite"], "node", 0.46, TEXT)
            tag.add_updater(lambda m, s=sat: m.next_to(s, UP, buff=0.3))
            self.add(tag)
        self.play(MoveAlongPath(sat, path), run_time=2.4, rate_func=linear)
        if DATA.get("note"):
            self.play(FadeIn(label(DATA["note"], "note", 0.5, MUTED, False)
                             .move_to([0, BOT + 0.2, 0])), run_time=0.4)
