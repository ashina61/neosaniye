# The Doorway Did It — art direction

Read `productions/MANIFESTO.md` and `productions/STYLE_LEDGER.md` before this.
This is the fourth production. The ledger's three rows are the list of things it
may not do again, and it says in writing that this one may not use Manim.

## The design read

**A doodle on a sheet of paper is trying to run an errand, and the paper keeps
taking it away.**

The three before this were an oscilloscope in a dark room, a page from a physics
book being corrected, and a machine shop for numbers. All three were
*instruments*. This is the first one that is a *character*, and the register
changes completely: the previous three explained, this one performs.

## The world

**Ink Theater + Ink Puppet**, rendered by **HyperFrames**. Both are untouched by
this channel, and HyperFrames means this is also the first production not
composited in Remotion.

It was chosen for two reasons that point the same way. The ledger required a
world that is not Manim and not Remotion atelier. And the mechanism of this
topic is literally a person carrying something across a threshold — it is a
piece of physical acting, and this is the only world available that acts.

## Motion is not authored

This is the single largest change to the channel's motion language so far.
Every movement the figure makes is **real human motion capture** from the CMU
database, retargeted onto a hand-drawn stick figure. Six named clips:

| Beat | Clip | Why |
|---|---|---|
| 6.00–11.30 | `march` | Marching on the spot is the only clip in the catalog that travels nowhere. It is the joke under "same distance every time". |
| 11.30–22.30 | `walk` | The approach and the crossing. |
| 22.30–26.20 | `shuffle` | A slow sneaking creep — aimless searching of a room it has no reason to be in. |
| 26.20–29.60 | `walk` (mirrored) | Walking back. Separated from the first walk by the shuffle; never the same clip twice running. |
| 29.60–34.00 | `kick` | Played straight. No cartoon reaction, because a real kick at a thing that does not move is funnier. |
| 34.00–40.60 | `sit` | Sits, then stands back up on its own, which is exactly the recovery the last beat needs. `loop: false`, because the clip is 6.00s and the segment is 6.60s — without it, the figure starts sitting down again. |

Hand-authored character motion: **0.0 seconds.** The style forbids it, and it is
forbidden for a good reason — a hand-tuned walk cycle is the tell that separates
a doodle that moves from a doodle that is alive.

## Palette

| Role | Value | Rule |
|---|---|---|
| Paper | `#FCFBF8` | Warm white. Deliberately not the previous grounds: `#080B10`, `#EDE6D6` with grain and a plate border, `#161A26`. |
| Ink | `#333333` | The figure, the doorway, the boxes, the ground. One stroke weight, live boil on every line. |
| Errand | `#D4611B` | **The errand and nothing else.** Darkened from the style's `#E8722C` because that failed WCAG AA against this paper at 2.95:1; this is 3.67:1. |
| Problem | `#C8322B` | **Once**, on the lid seam at 30.15s, on the box that will not open. |
| Resolution | `#2E6E9E` | **Once**, drawn along the line of closed lids from 41.4s. |

## The drawing

The rig plays the motion; **`ink-theater/ink-figure.js`** does the drawing, and it
is in the engine rather than in this file because the character recurs. See
`productions/STYLE_LEDGER.md` — his name is Nib.

Every part is the same construction as the head, the doorway and the boxes: a
paper-filled shape with an ink outline. That is not a taste decision. The fill is
what lets one limb pass in **front** of another; a solid-ink limb crossing a
solid-ink body is one black shape, and no amount of motion capture survives that.
The torso is a closed outline whose width at hips, chest and shoulders is
measured off a single axis — the spine — because a polygon through shL, shR,
hipR, hipL self-intersects the moment the shoulders rotate past each other in a
walk and the torso pinches into an hourglass.

Feet are not drawn at a fixed angle. The ankle takes its angle from the shin and
flattens onto the ground as the foot plants. Feet drawn the obvious way skate,
and skating feet are the loudest tell that a walk is fake.

## Holding things

The body stays on motion capture. **One arm** is overridden, and only when the
story needs the hand somewhere: holding the errand, being robbed of it, looking
at itself empty, and swatting at the errands round its head. A generic walk cycle
swings an empty arm, so a prop riding in that hand reads as swinging loose rather
than carried.

Three things that are not obvious and cost a render each to find:

- The reach is measured from the **shoulder**, never the chest. The clips are not
  all shot from the same angle — a near-profile one collapses both shoulders onto
  the spine — so a chest-relative target that is a comfortable bent arm in `walk`
  is past the end of the arm in `shuffle`, and FABRIK answers an unreachable
  target by straightening the arm and pointing at it.
- The elbow is forced onto the side the motion capture already has it. FABRIK has
  no elbow preference of its own and the joint flips between frames, which reads
  as the arm snapping inside out.
- `march` and `walk` do not agree on which side is which — the twelve CMU clips
  have mixed handedness, and `InkPuppet.STAND` had it backwards from every one of
  them, so the figure carried on the wrong side of the screen until the first
  clip started and then jumped across its own body.

## The signature device

**The doorway is a machine.** A barrier arm hinged on the left upright at exactly
the height the errand is actually carried at, folded flat up the post so it reads
as part of the architecture, cocked past vertical at 13.5s like a trap being set,
dropped to horizontal to sweep the errand out of the figure's hand, and then
folded innocently back up the post.

Every number in that sentence was solved backwards from one thing: the arm lands
on the word **"closes"** — lands, not starts, so the swing begins 0.15s early.
The door's position on the page, the scroll rate of the world (37.6 px/s), the
arm's length (310) and its pivot height (728) are all consequences of that and of
where the hand actually ends up, not choices. `ARM_Y` is not the figure's own
hand height: the actor is scaled 1.5x about the ground, so the screen height and
the rig height are different numbers, and using the rig's one puts the sweep
200px under the errand — which is invisible in a still, because the errand is
swapped for a falling copy two frames later.

## The camera

`InkPuppet.place()` rewrites the figure's transform on every frame, so the figure
**cannot travel**. Travel is expressed by sliding the world past a figure pinned
at x 540 — which is the classic side-scroller solution, and which happens to put
the doorway's arrival under exact timeline control.

The result is that this is **one continuous shot**. One horizontal scroll, one
pull-back at the end, and not a single cut. The three previous productions all
followed the reference video's cut-every-four-to-five-seconds rule; this one
breaks it deliberately. A joke about someone losing something needs continuity —
a cut would let the viewer suspect the errand was taken off-screen, and the whole
point is that it was taken in full view and the character did not notice.

## The face

The style asks for a deadpan mascot with white-dot eyes. On an unfilled head on
white paper, white dots are invisible — so the eyes are ink. Both eyes and a nose
sit on **one side** of the head, and that is not decoration: a symmetrical stick
figure has no facing, so without it the turn at 26.2s is completely invisible.
The face exists to make one flip legible.

## Type

Patrick Hand, embedded as the **full TrueType**. A Google Fonts `css2` subset is
missing basic-latin and falls back to serif silently while the renderer still
reports the font as loaded — the most expensive trap in this style, documented in
`ink-theater/README.md` and now in `productions/ENVIRONMENT.md`.

First handwriting this channel has used. The three before it were Archivo +
JetBrains Mono, Spectral + Caveat, and Space Grotesk + Space Mono.

## Sound

Silence, plus three synthesised sounds and nothing else: a pencil scratch gated
into six bursts under the draw-in, a wooden clack of two decaying partials as the
lid stamps, and a lower, shorter thud on the kick that deliberately goes nowhere.
No music at any point.

## The distinctness test

*Could this be any other video's frame?* No. It is one character, one doorway and
one errand, and all three exist because of this specific finding.

*Does it reuse a look I have made before?* No, on all five ledger fields. Design
read, ground, palette roles, signature device, layout and motion character are
all new, and the motion character is not merely new but a different kind of
thing: the previous three were authored, this one is recorded.
