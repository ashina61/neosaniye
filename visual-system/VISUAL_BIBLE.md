# The Visual Bible

**Version 1.0.0** — see `visual-system/VERSION`. The machine-readable form of
everything here is `visual-system/dna.mjs`; this document is why.

> **A new story is not a new visual language.**
> The subject changes. The grammar does not. A heart must not look like a map,
> and both must look like the same studio made them.

Nothing in this document was invented. The channel already had a visual
language — three font families, a four-step stroke scale, four mood registers,
six camera families — expressed across forty files and twelve episodes. This is
that language written down, so the thirteenth episode inherits it instead of
re-deciding it.

---

## Typography

### Three families, and they do not overlap

| family | stack | voice |
|---|---|---|
| serif | Playfair Display / Iowan Old Style / Georgia | **the narrator** — captions, set italic, the register of printed documentary |
| sans | Archivo / Helvetica Neue / Arial | **emphasis and number** — the word the line exists for, and figures |
| mono | Courier New / ui-monospace | **the drawing's own voice** — labels, callouts, disclosure plates, registration marks |

A fourth family would not add a voice; it would blur the three that exist. The
stacks are exported once, from `engine/draw/sheet.tsx`, as `SERIF`, `SANS`,
`MONO`. Writing one inline is a fork of the typography — and the lint reports it
as an error, because two spellings of the mono stack had already shipped.

### Hierarchy

```
TITLE      sans 900      11.5%–23.2% of frame width
CAPTION    serif 900     4.3%–17% of frame width, italic
EMPHASIS   sans 900      the caption's size × 1.16, in the accent
FIGURE     sans 900      tabular numerals, tracked 0.2em
LABEL      mono 400      2.1%, uppercase, tracked 0.14em
DISCLOSURE mono 400      1.85%, uppercase, tracked 0.16em, left rule
```

The caption floor is where type stops being readable on a phone. The ceiling is
where a three-word line runs off both edges. The **emphasis multiplier is
exactly 1.16** and appears in three places — the type layer that draws it, the
sizer that fits the block, and the clipping checker that measures it. They agree
because a block that fits at the nominal size does not fit once one word grows.

### One margin

Captions are set **left**, always. Their left edge is therefore the strongest
alignment in the frame, and the eye reads a shift of three pixels between shots
as a jolt without being able to say why.

`TYPE.margin = 0.0778` — 84px at 1080. It had two values: a literal `84` and
`WIDTH * 0.075` (81), and three episodes shipped with both. **A margin expressed
twice is a margin.**

### Line breaking and safe area

Break around the **emphasis**, never through it: a number split across two lines
cannot be emphasised. Aim for 12 characters a line, never more than 5 lines.
Platform furniture eats the bottom eighth and a strip at the top —
`TYPE.safeArea` is 4% to 90%.

### Maximum complexity

Five things moving at once (`COMPOSITION.maxSimultaneousElements`). Not a budget
to spend — a ceiling that means something has gone wrong.

---

## Colour

### An episode picks a register, not a colour

This is the whole answer to *when subject-specific colour is permitted*. An
episode does **not** invent a hex. It chooses one of four registers the channel
already owns, and its accent from inside that register.

| register | accents | for |
|---|---|---|
| `gold-heat` | `#f2b53a` `#e8a020` `#ffcf3d` `#d99326` | fire, gold, furnace, sunlight on stone |
| `cold-noir` | `#ffcf3d` `#e6e2d6` `#8fb6c8` `#c9a94b` | night, water, evidence, institutions |
| `green-rot` | `#c8d94a` `#9fb83a` `#e0d089` | corrosion, seabed, decay, long burial |
| `ash-grey` | `#e8e2d4` `#b9c3c9` `#d94f3d` | ash, concrete, aftermath, exhaustion |

Accent and grade travel together — `gold-heat` desaturates less and sepias more,
`ash-grey` pulls the colour almost out — which is why they are one table.

**Forbidden:** two accents in one reel, or accents from two registers. That is
not a palette, it is an argument. `COLOUR.maxAccentsPerEpisode = 1`.

### Fixed across the channel

```
neutral   #cfc6ae   labels, construction lines, muted line work
paper     #f6ead0   printed stock
ink       #0b0906   the darkest ground
ground    #16110d #0d0b09 #0c0806
semantic  high #d9534f   low #5b8fa8
```

`high`/`low` are hot and cold, oxygenated and not, above and below. They are
**fixed** so that a viewer who learns them in one episode still knows them in the
next. They are the only colours that mean something rather than decorate.

### Contrast is a floor

Relative luminance — the same measure an accessibility ratio uses, because it is
the same question: can the eye separate these two surfaces. **3:1 minimum** for
a drawing against its ground, 4.5 for comfort. Line work has no mass to carry
itself; put a pale line on a pale ground and the drawing does not lose contrast,
it disappears.

---

## Graphic language

### Four stroke weights, derived from the frame

```
construction  0.0015 × width   pitch circles, centre marks, setting-out
detail        0.0024 × width   the drawing proper
object        0.0042 × width   a thing's own outline
emphasis      0.0062 × width   the one edge that matters
```

A fifth weight would not be a fifth level of importance; it would be a second
opinion about the four. `weights(w)` in `sheet.tsx` is the only source.

### Two registers, and they are not the same hand

The four weights above are **technical** line work — a plate, a section, a gear
train. The second register is **hand marks over photographs**: a route drawn on
a map, a circle round a face, a tally notched into the frame. Those are a marker
pen, not a draughtsman's pen: two to five times heavier, and carrying a dark
backing stroke underneath, because a mark that has to read over an arbitrary
photograph cannot rely on the photograph being dark.

`Motif.tsx` and `Annotation.tsx` are that register. Its widths are currently
literals against a 1080 frame — recorded in the DNA as `KNOWN_DEVIATION`, not
quietly blessed, because enumerating sixteen numbers into the system would turn
drift into "system" by renaming it.

### The annotation vocabulary

| component | for | not for |
|---|---|---|
| `Arrow` | a force, a direction, a pointer; draws along its own length | connecting diagram parts — that is a Callout leader |
| `Callout` | naming a part: leader to the thing, mono label on whichever side has room | |
| `Measurement` | a dimension, compared against something known | |
| `Marker` | dot, ring, hazard | |
| `Label` | mono, uppercase, tracked 0.14em | |
| `Underline` | draws itself, never fades | |
| `Ticks` | registration marks — the corner furniture of a plate | a photographic shot; they say "this is a drawing" |
| `Disclosure` | the plate saying a drawing is a reconstruction | |

**No rounded corners on technical work.** Drawings are drawn, not styled.

### Diagram construction

A technical drawing **sets out before it draws**: pitch circles and centre marks
exist at frame zero, and the mechanism draws itself on top of them. This is why
the frame a cut lands on is never empty — a diagram that begins at nothing
delivers disconnected debris to the cut.

Everything reconstructed says so, in the frame:
`SCHEMATIC RECONSTRUCTION · NOT TO SCALE`. A drawing presented as a record is a
worse lie than a wrong photograph, because the viewer cannot check it.

---

## Image treatment

### The film pass is one place

Grain, grunge, scanlines, vignette, gate weave and grade live in
`engine/FilmLook.tsx`. **No template writes its own.** Two grains do not read as
more film; they read as noise.

```
grain      0.28–0.42      vignette   0.34–0.58
grunge     0.10–0.20      gate weave 4–7px
scanlines  0.06–0.16      posterize  12–15 fps
```

### Grade is part of the sentence

Three registers, not nine. Closing and ash shots pull colour and lift contrast;
gold and splendour warm. A reel graded differently in every scene has no grade,
it has a flicker.

### Plates and parallax

A subject plate **never fills the frame** — a cut-out stretched to 1080×1920
leaves nothing able to move in front of it, and depth dies. A person is sized by
`plateWidth` and stands on their feet.

Depth is not a file property; it is **two plates moving differently against each
other**, scaled about the same ground point. Equal scaling is a zoom.

### Material is a value before it is a finish

Every material declares an **albedo** — the value it has before any light. A
highlight with no body under it is a silhouette; limestone that is only a raking
gradient renders darker than the sky behind it.

---

## Composition

### Four planes, moving at different rates

```
background  0.16    secondary  0.52    primary  1.0    foreground  1.55
```

The difference between the rates is the only reason a flat drawing reads as a
space. A push that scales every plane equally is a zoom.

### A drawing gets less camera than a photograph

A photograph survives any push because there is more picture outside the frame.
A drawing has **exactly the frame it was composed for**. So the planner computes
the largest share each drawing can afford — capped at 1.18 — and writes it into
the scene. A share of a portal is still a portal.

### Typography wins

Nothing is drawn through a sentence. A graphic that has nowhere to stand clear of
the type band is dropped, because a graphic with nowhere to stand is not a
graphic, it is clutter.

### Hierarchy

One primary subject. Secondary elements support it and never compete for the
same instant. Background is a plane, not a subject. **Negative space is
composition, not waste** — and a 9:16 frame with a horizontal subject leaves a
band, which is why the ground and the sky are surfaces rather than void.

---

## What this document is not

It is not a style guide to be applied by hand. Every rule here is either
enforced by `scripts/lib/dna.mjs` (what an episode decided) or
`scripts/dna-lint.mjs` (what the engine can decide), or recorded in the DNA as a
known deviation with a reason and a remedy.

A rule nobody checks is a rule that has already been broken.
