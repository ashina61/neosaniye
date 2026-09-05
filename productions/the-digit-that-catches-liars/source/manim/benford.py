"""The Digit That Catches Liars — Manim scenes.

Thirteen silent clips, 1080x1920 at 30fps, that become the footage bed under a
Remotion layer carrying the chip, the captions and the annotations.

Nothing here is a Manim default. The ground, the stroke weights, the typefaces
and the easing are all overridden: the engine is used for its geometry only.

Every horizontal position on the ruler is log10 of the value it stands for. The
nine segment widths are log10(1 + 1/d) and they sum to 1.000. Nothing is nudged
for legibility.

Vertical safety: burned captions sit in y from -1.35 to -2.05, so drawn content
lives in y from -0.95 up to 2.55. That band is the composition, not a
limitation to work around.
"""

import math

from manim import *

config.pixel_width = 1080
config.pixel_height = 1920
config.frame_rate = 30
config.frame_height = 8.0
config.frame_width = 4.5
config.background_color = "#161A26"

# ── palette ──────────────────────────────────────────────────────────────────
SLATE = "#161A26"
BONE = "#F0EAD8"
DIM = "#79809A"          # bone, stepped back — structure that is not the subject
CHART = "#C9E265"        # the accent: whatever is measurably true
MAG = "#E5487B"          # reserved. sc13 only.

SANS = "Space Grotesk"
MONO = "Space Mono"

TOP = 2.55               # below the Remotion chip
FLOOR = -0.95            # above the Remotion caption band

# ── the ruler ────────────────────────────────────────────────────────────────
X0 = -1.92
W = 3.84
RULE_Y = 0.90
BAND_H = 0.46
BAND_TOP = RULE_Y + BAND_H / 2
BAND_BOT = RULE_Y - BAND_H / 2
BEAM_Y = RULE_Y + 1.05

DIGITS = list(range(1, 10))
FREQ = {d: math.log10(1 + 1 / d) for d in DIGITS}          # .301 … .046


def x_of(v: float, decades: float = 1.0) -> float:
    """Position of value v on a ruler covering `decades` powers of ten from 1."""
    return X0 + (math.log10(v) / decades) * W


def seg_span(d: int) -> tuple[float, float]:
    return x_of(d), x_of(d + 1)


def seg_mid(d: int) -> float:
    a, b = seg_span(d)
    return (a + b) / 2


def band() -> Rectangle:
    return Rectangle(
        width=W, height=BAND_H,
        stroke_color=BONE, stroke_width=5,
        fill_color=SLATE, fill_opacity=1.0,
    ).move_to([X0 + W / 2, RULE_Y, 0])


def dividers() -> list[Line]:
    return [
        Line([x_of(d), BAND_BOT, 0], [x_of(d), BAND_TOP, 0],
             stroke_color=BONE, stroke_width=3)
        for d in DIGITS[1:]
    ]


def seg_labels(size: int = 15, color=BONE) -> list[Text]:
    """The digit that names each stretch, sitting under its own stretch."""
    out = []
    for d in DIGITS:
        t = Text(str(d), font=MONO, font_size=size, color=color)
        t.move_to([seg_mid(d), BAND_BOT - 0.26, 0])
        out.append(t)
    return out


def end_labels(decade: int = 0, size: int = 17) -> list[Text]:
    lo = Text(f"{10 ** decade:,}", font=MONO, font_size=size, color=DIM)
    hi = Text(f"{10 ** (decade + 1):,}", font=MONO, font_size=size, color=DIM)
    lo.move_to([X0 + 0.10, BAND_TOP + 0.24, 0]).align_to([X0, 0, 0], LEFT)
    hi.move_to([X0 + W - 0.10, BAND_TOP + 0.24, 0]).align_to([X0 + W, 0, 0], RIGHT)
    return [lo, hi]


def caliper(x_lo: float, x_hi: float, reading: str,
            beam_y: float = BEAM_Y, reading_color=CHART, span_color=CHART,
            fill_span: bool = True) -> VGroup:
    """The signature device: a fixed beam, two sliding jaws, one reading.

    The beam spans the whole ruler and never moves. Only the jaws travel, and
    the reading sits on the instrument rather than over the thing being
    measured — which is what keeps a nearly-shut caliper legible.
    """
    g = VGroup()
    g.add(Line([X0 - 0.12, beam_y, 0], [X0 + W + 0.12, beam_y, 0],
               stroke_color=DIM, stroke_width=5))
    for x in (x_lo, x_hi):
        g.add(Line([x, beam_y, 0], [x, BAND_TOP + 0.02, 0],
                   stroke_color=BONE, stroke_width=6))
        g.add(Line([x - 0.075, BAND_TOP + 0.02, 0], [x + 0.075, BAND_TOP + 0.02, 0],
                   stroke_color=BONE, stroke_width=6))
    body = Rectangle(width=0.34, height=0.15, stroke_color=BONE, stroke_width=4,
                     fill_color=SLATE, fill_opacity=1.0).move_to([x_hi, beam_y, 0])
    g.add(body)
    if fill_span and x_hi - x_lo > 0.004:
        fill = Rectangle(width=x_hi - x_lo, height=BAND_H - 0.10, stroke_width=0,
                         fill_color=span_color, fill_opacity=1.0)
        fill.move_to([(x_lo + x_hi) / 2, RULE_Y, 0])
        g.add(fill)
    g.add(Text(reading, font=MONO, font_size=32, color=reading_color)
          .move_to([0, beam_y + 0.46, 0]))
    return g


class Piece(Scene):
    """Base. Motion here is stepped or constant-rate; sc09 is the exception."""

    DURATION = 0.0

    def step(self, add=(), remove=(), hold: float = 0.0):
        """A cut inside a shot: things change between frames, never across them."""
        for m in remove:
            self.remove(m)
        for m in add:
            self.add(m)
        if hold > 0:
            self.wait(hold)


def lcg(seed: int):
    x = seed
    while True:
        x = (1103515245 * x + 12345) % (2 ** 31)
        yield x / (2 ** 31)


# ── sc01 · the pile ──────────────────────────────────────────────────────────
SCATTER = [
    ("9,430", 34, (-0.78, 2.30)),
    ("47", 27, (1.10, 2.34)),
    ("312", 29, (0.05, 1.78)),
    ("1,904", 32, (-1.02, 1.30)),
    ("8", 26, (1.42, 1.44)),
    ("271", 30, (0.72, 0.86)),
    ("26", 27, (-1.52, 0.44)),
    ("63", 27, (0.02, 0.30)),
    ("12", 26, (1.44, 0.02)),
    ("1,580", 32, (-0.86, -0.28)),
    ("704", 29, (0.86, -0.52)),
    ("27,600", 30, (-0.42, -0.86)),
]


def scatter_mobs() -> list[Text]:
    return [
        Text(s, font=MONO, font_size=size, color=BONE).move_to([x, y, 0])
        for s, size, (x, y) in SCATTER
    ]


class S01Pile(Piece):
    DURATION = 5.21

    # The first frame of a short is the whole game, so it is never empty: four
    # numbers are already on the bench when the video starts and the other eight
    # arrive around them.
    PRESET = 4

    def construct(self):
        mobs = scatter_mobs()
        flying = []
        for i, (m, (_, _, (x, y))) in enumerate(zip(mobs, SCATTER)):
            if i < self.PRESET:
                continue
            if abs(x) / 2.25 > abs(y) / 4.0:
                m.move_to([math.copysign(3.6, x), y, 0])
            else:
                m.move_to([x, math.copysign(5.6, y or 1.0), 0])
            flying.append((m, (x, y)))
        self.add(*mobs)
        self.play(
            LaggedStart(*[
                m.animate(rate_func=linear).move_to([x, y, 0]) for m, (x, y) in flying
            ], lag_ratio=0.24),
            run_time=4.10,
        )
        self.wait(self.DURATION - 4.10)


# ── sc02 · the obvious guess ─────────────────────────────────────────────────
GRID_POS = {
    d: (-1.20 + (i % 3) * 1.20, 2.16 - (i // 3) * 1.03)
    for i, d in enumerate(DIGITS)
}


def grid_boxes() -> VGroup:
    g = VGroup()
    for d in DIGITS:
        x, y = GRID_POS[d]
        g.add(Rectangle(width=1.04, height=0.66, stroke_color=BONE, stroke_width=4,
                        fill_opacity=0).move_to([x, y, 0]))
        g.add(Text(str(d), font=SANS, weight=BOLD, font_size=32, color=BONE)
              .move_to([x, y, 0]))
        g.add(Text("11.1%", font=MONO, font_size=15, color=DIM)
              .move_to([x, y - 0.52, 0]))
    return g


class S02Grid(Piece):
    DURATION = 4.27

    def construct(self):
        scatter = scatter_mobs()
        self.add(*scatter)
        grid = grid_boxes()
        self.wait(0.30)
        for m in scatter:
            m.set_opacity(0.18)          # the pile recedes; the guess comes forward
        self.step(add=[grid], hold=0.25)

        flights = []
        for m, (s, _, _) in zip(scatter, SCATTER):
            gx, gy = GRID_POS[int(s[0])]
            lead = m[0].copy().set_color(CHART).set_opacity(1.0)
            self.add(lead)
            flights.append(lead.animate(rate_func=linear)
                           .move_to([gx, gy, 0]).set_opacity(0.0))
        self.play(LaggedStart(*flights, lag_ratio=0.10), run_time=2.35)
        self.step(remove=scatter, hold=self.DURATION - 0.30 - 0.25 - 2.35)


# ── sc03 · it isn't eleven ───────────────────────────────────────────────────
BAR_X0 = -1.42
BAR_MAX = 2.44
ROW_Y = {d: 2.30 - (d - 1) * 0.405 for d in DIGITS}


def freq_bar(d: int) -> VGroup:
    ln = FREQ[d] / FREQ[1] * BAR_MAX
    r = Rectangle(width=ln, height=0.255, stroke_width=0,
                  fill_color=CHART if d == 1 else BONE, fill_opacity=1.0)
    r.move_to([BAR_X0 + ln / 2, ROW_Y[d], 0])
    lab = Text(str(d), font=SANS, weight=BOLD, font_size=22, color=BONE)
    lab.move_to([BAR_X0 - 0.26, ROW_Y[d], 0])
    pct = Text(f"{FREQ[d]*100:.1f}%", font=MONO, font_size=17,
               color=CHART if d == 1 else DIM)
    pct.next_to(r, RIGHT, buff=0.14)
    return VGroup(r, lab, pct)


class S03Break(Piece):
    DURATION = 5.05

    def construct(self):
        grid = grid_boxes()
        self.add(grid)
        self.wait(0.55)
        bars = {d: freq_bar(d) for d in DIGITS}
        self.step(remove=[grid], add=[bars[1]], hold=0.60)
        self.step(add=[bars[d] for d in (2, 3, 4, 5)], hold=0.45)
        self.step(add=[bars[d] for d in (6, 7, 8, 9)])
        self.wait(self.DURATION - 0.55 - 0.60 - 0.45)


# ── sc04 · the pivot ─────────────────────────────────────────────────────────
class S04Rule(Piece):
    DURATION = 3.00

    def construct(self):
        self.wait(0.70)
        rule = Line([X0, RULE_Y, 0], [X0 + W, RULE_Y, 0],
                    stroke_color=BONE, stroke_width=8)
        self.play(Create(rule), rate_func=linear, run_time=1.05)
        self.wait(self.DURATION - 0.70 - 1.05)


# ── sc05 · building the ruler ────────────────────────────────────────────────
class S05Ticks(Piece):
    DURATION = 3.87

    def construct(self):
        self.add(band(), *end_labels())
        divs, labs = dividers(), seg_labels()
        self.wait(0.28)
        held = 0.28
        for i, lab in enumerate(labs):
            add = [lab] if i == 0 else [divs[i - 1], lab]
            self.step(add=add, hold=0.20)
            held += 0.20
        self.wait(self.DURATION - held)


# ── sc06 · the labels change, the bar does not move ──────────────────────────
class S06Decades(Piece):
    """Scale invariance, shown by not moving anything."""

    DURATION = 3.94

    def construct(self):
        self.add(band(), *dividers())
        a, b = seg_span(1)
        bar = Rectangle(width=b - a, height=BAND_H - 0.10, stroke_width=0,
                        fill_color=CHART, fill_opacity=1.0)
        bar.move_to([(a + b) / 2, RULE_Y, 0])
        self.add(bar)

        def stated(decade: int) -> VGroup:
            lo, hi = 1 * 10 ** decade, 2 * 10 ** decade
            g = VGroup(*end_labels(decade))
            g.add(Text(f"{lo:,} → {hi:,}", font=MONO, font_size=20, color=CHART)
                  .move_to([-1.20, BAND_BOT - 0.36, 0]))
            return g

        held = 0.0
        prev = None
        for decade, hold in ((0, 2.05), (1, 1.00), (2, 0.0)):
            g = stated(decade)
            self.step(remove=[prev] if prev else [], add=[g], hold=hold)
            held += hold
            prev = g
        self.wait(self.DURATION - held)


# ── sc07 · the caliper ───────────────────────────────────────────────────────
class S07Caliper(Piece):
    DURATION = 4.06

    def construct(self):
        self.add(band(), *dividers(), *seg_labels())

        a, b = seg_span(1)
        first = caliper(a, b, ".301")
        keep_1 = Text(".301", font=MONO, font_size=20, color=CHART)
        keep_1.move_to([seg_mid(1), BAND_BOT - 0.68, 0])
        self.wait(0.25)
        self.step(add=[first], hold=1.15)
        self.step(add=[keep_1], hold=0.20)

        held = 1.60
        prev = first
        for d in range(2, 9):
            a, b = seg_span(d)
            nxt = caliper(a, b, f"{FREQ[d]:.3f}"[1:], reading_color=DIM,
                          span_color=DIM)
            self.step(remove=[prev], add=[nxt], hold=0.115)
            held += 0.115
            prev = nxt

        a, b = seg_span(9)
        last = caliper(a, b, ".046")
        keep_9 = Text(".046", font=MONO, font_size=20, color=CHART)
        keep_9.move_to([seg_mid(9), BAND_BOT - 0.68, 0])
        self.step(remove=[prev], add=[last, keep_9])
        self.wait(self.DURATION - held)


# ── sc08 · the drop test ─────────────────────────────────────────────────────
class S08Drops(Piece):
    DURATION = 3.96

    def construct(self):
        self.add(band(), *dividers(), *seg_labels())
        rnd = lcg(20260905)
        counts = {d: 0 for d in DIGITS}
        self.wait(0.20)
        held = 0.20
        for i in range(44):
            u = next(rnd)
            d = min(9, max(1, int(10 ** u)))
            dot = Dot([X0 + u * W, RULE_Y, 0], radius=0.038, color=CHART)
            tick = Rectangle(width=0.12, height=0.048, stroke_width=0,
                             fill_color=CHART, fill_opacity=1.0)
            tick.move_to([seg_mid(d), BAND_TOP + 0.20 + counts[d] * 0.088, 0])
            counts[d] += 1
            hold = 0.115 if i < 12 else (0.055 if i < 26 else 0.022)
            self.step(add=[dot, tick], hold=hold)
            held += hold
        self.wait(max(0.0, self.DURATION - held))


# ── sc09 · the one continuous move ───────────────────────────────────────────
class S09StandUp(Piece):
    DURATION = 3.70

    BASE_Y = -0.90
    BAR_W = 0.30
    GAP = 0.115
    H_MAX = 3.20

    def construct(self):
        ruler = VGroup(band(), *dividers(), *seg_labels())
        self.add(ruler)

        lying, standing = [], []
        total = 9 * self.BAR_W + 8 * self.GAP
        left = -total / 2
        scale = self.H_MAX / (seg_span(1)[1] - seg_span(1)[0])
        for i, d in enumerate(DIGITS):
            a, b = seg_span(d)
            r = Rectangle(width=b - a, height=BAND_H - 0.10, stroke_width=0,
                          fill_color=CHART if d == 1 else BONE, fill_opacity=1.0)
            r.move_to([(a + b) / 2, RULE_Y, 0])
            lying.append(r)
            h = (b - a) * scale
            s = Rectangle(width=self.BAR_W, height=h, stroke_width=0,
                          fill_color=CHART if d == 1 else BONE, fill_opacity=1.0)
            s.move_to([left + i * (self.BAR_W + self.GAP) + self.BAR_W / 2,
                       self.BASE_Y + h / 2, 0])
            standing.append(s)

        self.add(*lying)
        self.wait(0.28)
        self.play(
            LaggedStart(*[Transform(a, b) for a, b in zip(lying, standing)],
                        lag_ratio=0.055),
            ruler.animate.set_opacity(0.10),
            run_time=2.40, rate_func=smooth,
        )
        baseline = Line([left - 0.12, self.BASE_Y, 0],
                        [left + total + 0.12, self.BASE_Y, 0],
                        stroke_color=DIM, stroke_width=3)
        marks = VGroup(*[
            Text(str(d), font=MONO, font_size=17, color=DIM)
            .move_to([left + i * (self.BAR_W + self.GAP) + self.BAR_W / 2,
                      self.BASE_Y - 0.22, 0])
            for i, d in enumerate(DIGITS)
        ])
        self.step(add=[baseline, marks])
        self.wait(self.DURATION - 0.28 - 2.40)


# ── sc10 · too even ──────────────────────────────────────────────────────────
INVENTED = [
    "4,320", "2,780", "6,150",
    "8,940", "3,600", "7,250",
    "5,480", "1,930", "9,120",
    "2,450", "3,870", "1,270",
]


class S10Ledger(Piece):
    DURATION = 5.91

    BASE_Y = -0.90
    BAR_W = 0.30
    GAP = 0.115
    UNIT = 0.32

    def construct(self):
        total = 9 * self.BAR_W + 8 * self.GAP
        left = -total / 2

        self.add(Text("EXPENSES, TYPED FROM MEMORY", font=SANS, weight=MEDIUM,
                      font_size=16, color=DIM).move_to([0, 2.44, 0]))
        self.add(Line([left - 0.12, self.BASE_Y, 0], [left + total + 0.12, self.BASE_Y, 0],
                      stroke_color=DIM, stroke_width=3))
        for i, d in enumerate(DIGITS):
            self.add(Text(str(d), font=MONO, font_size=16, color=DIM)
                     .move_to([left + i * (self.BAR_W + self.GAP) + self.BAR_W / 2,
                               self.BASE_Y - 0.22, 0]))

        counts = {d: 0 for d in DIGITS}
        bars = {d: None for d in DIGITS}
        self.wait(0.25)
        held = 0.25
        for i, s in enumerate(INVENTED):
            col, row = i % 3, i // 3
            t = Text(s, font=MONO, font_size=20, color=BONE)
            t.move_to([-1.34 + col * 1.34, 1.98 - row * 0.34, 0])
            d = int(s[0])
            counts[d] += 1
            h = counts[d] * self.UNIT
            x = left + (d - 1) * (self.BAR_W + self.GAP) + self.BAR_W / 2
            new = Rectangle(width=self.BAR_W, height=h, stroke_color=BONE,
                            stroke_width=3, fill_opacity=0.0)
            new.move_to([x, self.BASE_Y + h / 2, 0])
            rm = [bars[d]] if bars[d] is not None else []
            bars[d] = new
            self.step(add=[t, new], remove=rm, hold=0.275)
            held += 0.275

        self.wait(0.40)
        held += 0.40

        # the real distribution, as a staircase over the flat one
        pts = []
        for i, d in enumerate(DIGITS):
            x = left + i * (self.BAR_W + self.GAP) + self.BAR_W / 2
            h = FREQ[d] * len(INVENTED) * self.UNIT
            pts.append([x - self.BAR_W / 2 - self.GAP / 2, self.BASE_Y + h, 0])
            pts.append([x + self.BAR_W / 2 + self.GAP / 2, self.BASE_Y + h, 0])
        stair = VMobject(stroke_color=CHART, stroke_width=6)
        stair.set_points_as_corners(pts)
        tag = Text("what real numbers do", font=SANS, weight=MEDIUM,
                   font_size=16, color=CHART)
        tag.move_to([0.62, self.BASE_Y + FREQ[1] * len(INVENTED) * self.UNIT + 0.26, 0])
        self.step(add=[stair, tag])
        self.wait(max(0.0, self.DURATION - held))


# ── sc11 · one real case ─────────────────────────────────────────────────────
class S11Greece(Piece):
    DURATION = 4.19

    def construct(self):
        cap = Text("DEFICIT REPORTED", font=SANS, weight=MEDIUM, font_size=18, color=DIM)
        cap.move_to([0, 2.05, 0])
        src = Text("GREECE  ·  2009", font=MONO, font_size=17, color=DIM)
        src.move_to([0, -0.36, 0])
        first = Text("3.7%", font=MONO, font_size=76, color=BONE).move_to([0, 1.02, 0])
        self.add(cap, src, first)
        self.wait(2.90)

        ghost = Text("3.7%", font=MONO, font_size=34, color=BONE).set_opacity(0.26)
        ghost.move_to([0, 1.86, 0])
        strike = Line(ghost.get_left() + LEFT * 0.07, ghost.get_right() + RIGHT * 0.07,
                      stroke_color=BONE, stroke_width=3).set_opacity(0.34)
        second = Text("15.4%", font=MONO, font_size=76, color=BONE).move_to([0, 0.96, 0])
        self.step(remove=[first, cap], add=[ghost, strike, second])
        self.wait(self.DURATION - 2.90)


# ── sc12 / sc13 · the condition ──────────────────────────────────────────────
DECADES = 5.0
DEC_LABELS = ["1", "10", "100", "1k", "10k", "100k"]


def wide_band() -> VGroup:
    g = VGroup(Rectangle(width=W, height=BAND_H, stroke_color=BONE, stroke_width=5,
                         fill_color=SLATE, fill_opacity=1.0)
               .move_to([X0 + W / 2, RULE_Y, 0]))
    for i, lab in enumerate(DEC_LABELS):
        x = X0 + (i / DECADES) * W
        if 0 < i < 5:
            g.add(Line([x, BAND_BOT, 0], [x, BAND_TOP, 0],
                       stroke_color=BONE, stroke_width=3))
        g.add(Text(lab, font=MONO, font_size=16, color=DIM)
              .move_to([x, BAND_BOT - 0.26, 0]))
    return g


def wx(v: float) -> float:
    return X0 + (math.log10(v) / DECADES) * W


def cloud(lo: float, hi: float, n: int, seed: int, color) -> VGroup:
    rnd = lcg(seed)
    llo, lhi = math.log10(lo), math.log10(hi)
    g = VGroup()
    for i in range(n):
        u = next(rnd)
        x = X0 + ((llo + u * (lhi - llo)) / DECADES) * W
        g.add(Dot([x, BAND_TOP + 0.14 + (i % 5) * 0.10, 0], radius=0.036, color=color))
    return g


class S12Span(Piece):
    DURATION = 100 / 30

    def construct(self):
        self.add(wide_band())
        self.wait(0.25)

        c = cloud(1.4, 9000, 42, 424242, CHART)
        lab = Text("INVOICES  ·  1 to 9,000", font=MONO, font_size=16, color=CHART)
        lab.move_to([0, -0.62, 0])
        self.step(add=[c, lab], hold=0.40)

        lo, hi = wx(1.0), wx(9000)
        held = 0.65
        prev = None
        for frac, reading in ((0.25, "1 decade"), (0.55, "2 decades"),
                              (0.80, "3 decades"), (1.0, "4 decades")):
            cal = caliper(lo, lo + (hi - lo) * frac, reading, fill_span=False)
            self.step(remove=[prev] if prev else [], add=[cal], hold=0.30)
            held += 0.30
            prev = cal
        self.wait(self.DURATION - held)


class S13Narrow(Piece):
    """The only magenta in the video, and the last thing in it."""

    DURATION = 183 / 30

    def construct(self):
        self.add(wide_band())

        c1 = cloud(1.4, 2.0, 30, 99001, MAG)
        l1 = Text("ADULT HEIGHTS  ·  1.4 to 2.0 m", font=MONO, font_size=13, color=MAG)
        l1.move_to([0, -0.62, 0])
        cal1 = caliper(wx(1.4), wx(2.0), "0.2 decades", reading_color=MAG,
                       fill_span=False)
        self.step(add=[c1, l1], hold=0.25)
        self.step(add=[cal1], hold=0.70)

        c2 = cloud(200, 900, 30, 77003, MAG)
        l2 = Text("PRECINCT VOTES  ·  200 to 900", font=MONO,
                  font_size=13, color=MAG).move_to([0, -0.62, 0])
        cal2 = caliper(wx(200), wx(900), "0.7 decades", reading_color=MAG,
                       fill_span=False)
        self.step(remove=[c1, l1, cal1], add=[c2, l2, cal2], hold=2.95)

        verdict = Text("NOT ENOUGH RULER", font=SANS, weight=BOLD, font_size=26, color=MAG)
        verdict.move_to([0, -0.94, 0])
        self.step(add=[verdict])
        self.wait(self.DURATION - 0.25 - 0.70 - 2.95)


SHOTS = [
    ("sc01", S01Pile), ("sc02", S02Grid), ("sc03", S03Break), ("sc04", S04Rule),
    ("sc05", S05Ticks), ("sc06", S06Decades), ("sc07", S07Caliper),
    ("sc08", S08Drops), ("sc09", S09StandUp), ("sc10", S10Ledger),
    ("sc11", S11Greece), ("sc12", S12Span), ("sc13", S13Narrow),
]
