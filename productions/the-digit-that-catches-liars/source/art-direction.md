# The Digit That Catches Liars — art direction

Read `productions/MANIFESTO.md` and `productions/STYLE_LEDGER.md` before this file.
This is the third production. The ledger's two existing rows are the list of
things it may not do again.

## The design read

**A machine shop for numbers.** The frame is a slate work surface with a
measuring instrument laid out on it, and the video is that instrument being
read. Not a screen, not a page — a bench.

The two prior productions were *an oscilloscope in a dark room* and *a page from
a physics book being corrected*. This is neither: it is a physical object under
a flat light, with no glow, no grain, no plate border and no paper.

## The world

**Manim CE 0.21.0**, and only Manim, for every pixel of the picture. The ledger
required a world that was not Remotion atelier; of the manifesto's five unused
worlds, Manim is the only one whose native subject is a measured geometric
transformation, which is exactly what this video's argument is.

Remotion is still in the pipeline but it is **glass, not image**: the chip that
names the current idea, the burned captions, and two annotations. Nothing else.
That division is the point — it is the reference video's grammar (annotation
over footage) with drawn footage underneath.

**Manim's factory look is rejected in full**: not its ground colour, not its
stroke weight, not its bundled typeface, not its default smooth easing. The
engine is used for its geometry and for nothing else. If a frame of this video
could be mistaken for a frame of any other maths channel, the art direction has
failed.

## Palette

| Role | Value | Rule |
|---|---|---|
| Ground | `#161A26` slate | Deliberately neither `#080B10` (the oscilloscope piece) nor `#EDE6D6` (the plate piece) |
| Structure and all language | `#F0EAD8` bone | Heavy matte rules, never thin glowing traces |
| Stepped-back structure | `#79809A` | Scaffolding that is not the subject: beams, decade marks, baselines |
| The accent | `#C9E265` chartreuse | Marks whatever is *measurably true* — the measured widths, the real distribution, the readings |
| Reserved | `#E5487B` magenta | **sc13 only.** One appearance, at the turn, on the data the ruler cannot read. If it appears anywhere else in the render, that is a defect. |

Fabricated data is drawn as **hollow bone outline** — empty rather than
coloured — so the real/fake contrast costs nothing from the colour budget. That
is the cheapest good idea in the piece.

## The signature device

**A vernier caliper**: a fixed beam spanning the whole ruler, two sliding jaws,
and a reading that sits *on the instrument* rather than over the thing being
measured. That last detail is what makes a nearly-shut caliper legible — the
first version put the reading between the jaws and a 0.046 measurement became an
unreadable sliver.

It appears twice and does two different jobs:

- **sc07** — it measures the width of a digit's stretch: `.301` against `.046`.
- **sc12–13** — it measures the *span of a dataset* instead: four decades, then
  0.2, then 0.7.

That is the whole argument in one gesture. The instrument that shows why the law
works is the instrument that shows when it cannot be used.

## Motion character

**Mechanical stepping.** The caliper snaps between fixed positions, bars appear
at their new lengths rather than travelling to them, digits fly at constant rate
and stop dead. Nothing eases in, nothing overshoots, nothing decelerates.

**Exactly one exception**: sc09, where the nine stretches detach from the ruler
and stand up into the chart. It is the only eased animation in fifty-six
seconds, and it is the centrepiece precisely because everything around it is
machined. If a second eased move appears, the motion character is broken.

## Type

Space Grotesk 500/700 for language; Space Mono 400 for every measured number.
Neither family has been used by this channel before. Numbers are always mono and
language is never mono — the distinction is load-bearing, because the piece is
about the difference between a quantity and a claim.

## Geometry is not decoration

Every horizontal position on the ruler is `log10` of the value it stands for.
The nine stretch widths are `log10(1 + 1/d)`:

```
.301  .176  .125  .097  .079  .067  .058  .051  .046      sum = 1.000
```

Nothing is nudged for legibility. The bar heights in sc03 and sc09 are those
same nine numbers. Every random position — the drop test in sc08, the sample
clouds in sc12–13 — comes from a seeded LCG, so the piece redraws identically.

This follows the precedent set by the previous production, whose arrow lengths
came from the real inverse-square pull at the Moon's distance. The claim this
video makes is *you can check the measurement*; a picture of an argument would
not survive that claim.

## Layout

Burned captions occupy y −1.35 to −2.05 in Manim units, so the drawing lives in
y −0.95 to 2.55. That band is the composition, not a constraint worked around:
the ruler sits at y 0.90 and every shot is built above and below it inside that
band.

Shot by shot: a 3×3 grid of hollow boxes · a descending bar column · a bare rule
on an empty frame · a segmented ruler with its digits underneath · a chartreuse
span whose labels change decade while it does not move · a caliper above the
ruler · a tally growing above the ruler · nine stretches standing up into a
chart · a ledger over a flat tally · a single typographic figure overwritten in
place · a five-decade ruler with a sample cloud · the same ruler with the jaws
almost shut.

No hero element repeated beat to beat with new text underneath. That is the
scene-level templating trap and it is what the ledger exists to prevent.

## What is taken from the reference, and what is not

Taken (`productions/references/wpmavi-power-lines/`): naming the current idea on
screen persistently; captioning the words with the load-bearing word marked;
annotating what you are looking at; one accent plus one reserved colour used
exactly once; cutting roughly every four to five seconds.

Not taken: their pill, their yellow, their typeface, their layout, and above all
their photograph. An annotation over a photograph can only point at whatever the
photograph happens to contain, and nothing photographable contains 30.1% of a
logarithmic ruler.

## The distinctness test

*Could this be any other video's frame?* No — the whole piece is one instrument
being read, and the instrument is specific to this argument.

*Does it reuse a look I have made before?* No. Neither previous production has a
grid, a caliper, a slate ground, stepped motion, or these two typefaces.

One honest warning for the ledger: the caliper is adjacent to the engineering
dimension line used once in the oscilloscope piece. They are drawn as different
objects — a caliper has a beam, jaws and feet and is present as a tool; a
dimension line is an annotation — and the overlap is part of one field out of
five, which the ledger's own rule treats as a warning rather than a re-design.
