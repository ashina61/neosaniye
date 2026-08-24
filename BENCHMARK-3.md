# Production visual quality — the execution layer

The previous phase answered *what to draw*. Forty-one of forty-five lines had
been falling to typography; five new primitives took that to nine, and the five
episodes moved from 5.0–6.5 to 7.0–7.5.

That report ended with an honest paragraph: *"their grounds are gradients, and
their camera work is invisible over flat ground."* This phase is that paragraph.

**Constraints held throughout:** no new representation primitives, no engine
rebuild, no episode-specific selectors, no metric tuned for its own sake. Every
change is in the execution layer — how an existing drawing is lit, framed,
composed and moved.

## Method

Render a frame, look at it, name the cause, fix the cause, render again. Every
defect below was found by opening a still, not by reading a number — and every
one of them had already passed the schema, the type check, the 274-case test
suite, the clipping checker, the temporal state machine and the reel editor.

That is the recurring lesson of this repository and it held again: **a check
that does not exist cannot fail.** Four of the eight fixes below shipped with a
new check alongside them, and three of those checks found something the moment
they were switched on.

## What looking found

### 1. A material had no body

`engine/draw/material.tsx` was a raking gradient plus a deterministic speckle,
painted over whatever the plate had drawn underneath — a near-black rectangle.
Six per cent of white along the top edge is a *highlight*; a highlight with no
body under it is a silhouette. A thousand-ton block of limestone rendered
**darker than the sky behind it**.

Materials now carry an **albedo** — the value they have before any light —
and `MaterialFace` lays that down first. The hue wash scales with `give`,
because stone and concrete take a cast from the light while flesh and wood
*are* their colour: washing flesh at a fifth of the accent is how four chambers
of a heart came out as grey discs.

### 2. The camera carried the drawing sheet with it

Handing a drawing the whole of the shot's camera fixed fourteen identically
framed haulage shots and broke something worse: the push took the registration
ticks, the disclosure plate and the tonnage readout with it, and a shot at 1.29
delivered `800 TONS` sliced off the top of the frame and `…USTRATIVE
RECONSTRUCTION` running off the left.

A drawing has two layers that are not the same kind of thing. The **world** is
what the camera is looking at; the **sheet** is what it is looking *through*.
Walk past a museum plate and the object shifts; the label screwed to the wall
beside it does not. `worldTransform` is now an SVG transform on the world group
only.

### 3. The shot about scale was drawing the wrong scale

Eight hundred tons was illustrated at three tenths of the frame's width beside a
figure at six per cent of its height — a stone about twice a man's height, which
is a large crate. Understated by roughly a factor of five, in the one shot whose
entire job is to make a size felt.

The proportions now derive from the human reference rather than from a
preference, and the load is the same load in all fourteen shots: the reel's
largest stated figure decides its size once, because a load that shrinks between
two cuts is not the same load.

### 4. The men pulled left and the block went right

Every part of the haulage drawing was built for a load travelling left — haulers
off the left edge leaning into it, ropes leaving the left face, a force arrow
pointing left labelled `PULL`. The position was `startX + moved`. For fourteen
shots, in a drawing about cause and effect, the effect contradicted the cause.

### 5. The ground was a line and the sky was nothing

A hatched line at three fifths of the frame with seven hundred pixels of black
below it. Nothing was wrong with any object in the shot; the shot was a band of
drawing floating in a void, and in 9:16 that void is most of what the viewer
sees. `GroundPlane` and `Sky` add a falloff and a few lines running to a point
on the horizon — about two per cent of ink, after which the lower third is a
floor rather than an absence.

### 6. Line work on a bright ground

Four chambers of a heart against a wash running from bright ochre at the top of
the frame. The brightest thing in a shot about a heart was the empty air beside
it. The planner now pulls the field's palette down behind every drawing rather
than replacing it, so the reel still looks like itself and the values go where a
plate's values belong.

**And the check that would have caught it now exists.** `contrastProblems`
measures relative luminance — the same measure an accessibility contrast ratio
uses, because it is the same question — with 3:1 as the floor. Drawn shots only:
the local luminance behind a stroke laid over a photograph is not knowable from
the config, and a check that guesses is a check people switch off.

### 7. The clipping checker measured the drawing at rest

A magnified cross-section composed to fit the frame exactly was panned 262
pixels and shipped with its right half outside the picture — through the checker
whose entire job is that, because it was measuring where the section would have
been if nothing had moved.

Boxes now go through the same transform the plates do, at the extremes. And the
share is no longer a constant: a fixed small number is too much for a section
spanning three quarters of the width and needlessly little for a gear train with
room on every side, so **the planner computes the largest share each drawing can
afford** and writes it to the scene. Most shots keep the whole of it; the wide
haulage shots drop to 0.80–0.95; the shot that zooms 6.4× *through* a plate
drops to 0.05, because a share of a portal is still a portal.

### 8. Two wrong drawings, and one drawn for nothing

A haulage drawing served the `process` domain, and swordsmithing is `process`
from end to end. *"A sword that is hard the whole way through is a sword that
snaps"* was correctly refused by the process builder, fell through to haulage,
and was delivered as a **stone block on rollers under a plate reading METHOD
UNCERTAIN**. A haulage drawing is about size and only about size; whether a
process is a haulage is a question about the claim, which the builder now
answers — and refuses a line with nothing to move.

And a dashed diamond floated above three lines of type, related to nothing,
placed because a slot was free. A pure graphic exists so an empty shot is not
empty; a shot whose content is a sentence is not empty, because the words are
the subject.

Plus one geometry bug: a coastline wobbles up to a tenth of the frame off its
base and the water was inset two hundredths from the same base, so the strait
had a **black stripe between the sea and the shore** — in the one drawing whose
subject is where one ends and the other begins.

## Scores

Judged on the eight axes the brief asked for, out of 10. The **before** column
is the end of the vocabulary phase; the **after** column is this build.

| | Baalbek | Roman concrete | Hormuz | Human heart | Medieval sword |
|---|---|---|---|---|---|
| Storytelling | 8 → **8** | 8 → **8.5** | 8 → **8** | 7.5 → **7.5** | 8 → **8** |
| Visual hierarchy | 7 → **8** | 7 → **8** | 7.5 → **8.5** | 6.5 → **8** | 7.5 → **8.5** |
| Motion design | 6.5 → **7** | 6.5 → **7.5** | 6.5 → **7.5** | 6.5 → **7.5** | 7 → **7.5** |
| Camera diversity | 5 → **6.5** | 5 → **6.5** | 5.5 → **7** | 5 → **6.5** | 5 → **6.5** |
| Transition quality | 7 → **7** | 7 → **7** | 7.5 → **7.5** | 7 → **7** | 7 → **7** |
| Pacing | 8 → **8** | 8 → **8** | 8 → **8** | 7.5 → **7.5** | 8 → **8** |
| Visual continuity | 7 → **8.5** | 8 → **9** | 8 → **9** | 7.5 → **8.5** | 7.5 → **8.5** |
| Professionalism | 6 → **7** | 6 → **7.5** | 6.5 → **7.5** | 5.5 → **7** | 6 → **7.5** |
| **Overall** | 7.0 → **7.0** | 7.5 → **7.5** | 7.5 → **7.5** | 7.0 → **7.0** | 7.5 → **7.5** |

The overall figure did not move, and that is the honest result. It is dominated
by an axis this phase could not touch: `assetRelevance` is 6.0 in all five
because there is **no photography in any of them**, and no amount of execution
fixes that. What moved is everything execution owns — hierarchy, continuity,
professionalism, camera — by one to one and a half points each.

## Measured

Counted from the config, not judged. None of these is a score.

| | Baalbek | Roman concrete | Hormuz | Human heart | Medieval sword |
|---|---|---|---|---|---|
| Shots · seconds | 20 · 49.1 | 23 · 50.0 | 22 · 49.9 | 22 · 50.7 | 22 · 50.3 |
| Average depth planes | **3.40** | 2.13 | 2.59 | 1.68 | 1.64 |
| Layered drawings | 16 | 18 | 11 | 15 | 14 |
| Materials in use | stone, wood, water | concrete, water, stone | water, stone | flesh | metal |
| Causal animations | 17 | 12 | 9 | **30** | 21 |
| Transformations | 0 | 15 | 0 | 15 | **21** |
| Micro-motion shots | 16 | 18 | 11 | 15 | 14 |
| Meaningful camera moves | 18 | **20** | 17 | 18 | 17 |
| Match cuts | 0 | 0 | 0 | 0 | 1 |
| Hard cuts | 19 | 22 | 21 | 21 | 20 |
| Payoff hold | 1.50 s | **3.63 s** | 1.33 s | 2.27 s | 2.27 s |
| Shot-length variation | 0.28 | 0.28 | 0.23 | 0.28 | 0.29 |
| Temporal errors | 0 | 0 | 0 | 0 | 0 |
| Semantic failures | 0 | 0 | 0 | 0 | 0 |
| `REPRESENTATION_REQUIRED` | 3 | 3 | 3 | 5 | 7 |
| `ASSET_REQUIRED` | 9 | 9 | 9 | 9 | 9 |

Two zeros are correct rather than missing. A load being hauled is **not** a
transformation — it is the same shape somewhere else — and neither is a map.
The metric counts transformation where transformation happens, which after this
phase means process stages, a crack that opens and heals, and a chamber cycle;
it used to count only the first of those and reported four zeros.

## Hard cuts are still 1.00, and that is the answer

The brief was explicit: do not solve this with transition effects, create
meaningful visual relationships between adjacent shots instead. So the seams
stayed plain and the *relationship* was built:

- the load is the **same load** in all fourteen Baalbek shots, sized once from
  the reel's largest stated figure — it used to change size between cuts;
- one blade outline **persists** across every forging stage, stretching,
  reddening, folding and tapering rather than being replaced;
- the section **advances** across the reel — crack, water, consumed lump,
  mineral growth, closure — instead of restarting.

A hard cut between two shots of a continuing object is documentary grammar, not
a missing transition. The one match cut in five reels is earned; six would mean
none, which is what the first version of the cut director produced.

## What is still weak

- **No photographs.** Forty-five `ASSET_REQUIRED` briefs across the five reels,
  nine each, now written for the person doing the sourcing rather than for the
  pipeline: subject, purpose, composition, orientation, historical constraints,
  acceptable substitutes and rejection criteria. Until those are filled the
  ceiling is a well-made animated plate, not a documentary.
- **Twenty-one lines still carry no picture.** `REPRESENTATION_REQUIRED` is
  counted and reported rather than disguised, but it is a hole.
- **One primitive per episode.** Each reel leans on a single drawing kind for
  fourteen to eighteen shots. The variety within them is real — camera, stage,
  material state — but a fifth kind would serve better than a fifteenth
  instance of the first.
- **Vertical space.** A 9:16 frame and a horizontal subject leave a band of
  drawing with air above and floor below. Both now read as surfaces rather than
  void, which is the fix available without inventing content.
- **Moods still fight subjects.** `gold-heat` gives an anatomy plate a mustard
  ground. Brief-level, not engine-level.
