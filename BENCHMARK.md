# Generalisation benchmark — five new briefs, one engine

The motion-design engine was built against a single episode. This asks whether it
generalises: five 45–50 second documentary Shorts on unrelated subjects, put
through the normal pipeline with no per-episode hand-tuning.

```
SCRIPT → STORY → ASSET DIRECTOR → REPRESENTATION → VISUAL → MOTION
      → CUT → EDITOR → TEMPORAL QA → RENDER → INSPECTION → REPAIR
```

Every reel was rendered and every shot inspected at **0% / 33% / 66% / 94%** —
eighty to ninety-two stills per episode. The scores below come from that
inspection, not from the gates.

---

## The supply constraint, stated first

**No photographic supply was reachable.** Wikimedia Commons returns HTTP 403
through this environment's proxy, and the image generator returns 403 as well.
Rungs 1–3 of law 23's ladder — the right asset, a confident alternative, a
generated image — were all unavailable.

That leaves rungs 4–7: procedural reconstruction, diagram, designed typography,
deliberate abstraction. Every line therefore declares `graphicsOnly`, which is
the supported way to say "there is no photograph for this line", and the
`imageCommons` searches stay in each brief as the standing request.

The five grey placeholder backdrops `npm run new` generates were **deleted**
rather than shipped. Law 21 is explicit that a wrong picture is worse than no
picture, and a grey box presented as evidence is the purest form of one.

This makes the benchmark a hard test of the engine's lower rungs — which is a
legitimate test, and the one it turned out to need.

---

## Comparison

| Episode | Professionalism | Storytelling | Visual hierarchy | Motion | Assets | Editorial | Main failure |
|---|---|---|---|---|---|---|---|
| **Hormuz** | **6.5** | 8 | 8.5 | 6.5 | 3 | 7.5 | REPRESENTATION — a geography film with no geography |
| **Baalbek** | **6.0** | 8 | 8 | 6 | 3 | 7 | REPRESENTATION — no form for haulage, rollers, a slope |
| **Roman concrete** | **5.5** | 8.5 | 8 | 6 | 2 | 7 | REPRESENTATION — the self-healing mechanism is never drawn |
| **Medieval sword** | **5.5** | 8 | 8 | 6 | 2 | 7 | REPRESENTATION — a process film with no process in it |
| **Human heart** | **5.0** | 7.5 | 7.5 | 5.5 | 2 | 7 | REPRESENTATION — the whole claim is a two-stage cycle |
| *Antikythera (reference)* | *8.8* | *8* | *10* | *9.6* | *7.9* | *8.9* | *asset supply* |

Full per-episode numbers are in `episodes/<id>/benchmark-report.json`; the
inspection notes behind the judged scores are in `benchmark-notes.json` beside
them.

### What the measurements say

| | Baalbek | Roman concrete | Hormuz | Human heart | Medieval sword |
|---|---|---|---|---|---|
| Shots / seconds | 20 / 49.1 | 23 / 50.0 | 22 / 49.9 | 22 / 50.7 | 22 / 50.3 |
| Average shot | 2.46s | 2.17s | 2.27s | 2.30s | 2.29s |
| Representation | 3 proc · 17 type | 23 type | 3 proc · 19 type | 22 type | 22 type |
| Procedural / hybrid | 3 / 0 | 0 / 0 | 3 / 0 | 0 / 0 | 0 / 0 |
| Assets requested / shown | 9 / 0 | 9 / 0 | 9 / 0 | 9 / 0 | 9 / 0 |
| Hard-cut ratio | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| Transition ratio | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| Motion density | 1.04/s | 1.10/s | 1.08/s | 1.01/s | 1.07/s |
| Information density | 1.9 w/s | 1.9 w/s | 1.8 w/s | 1.9 w/s | 1.9 w/s |
| Rhythm (CoV) | 0.28 | 0.28 | 0.23 | 0.28 | 0.29 |
| Image kind changes | 21% | 0% | 19% | 0% | 0% |
| Temporal errors | 0 | 0 | 0 | 0 | 0 |

**41 of 45 lines resolved to TYPOGRAPHY.** Four got a `measurement` bar. That
one number is the benchmark's result.

---

## The headline finding

> The engine generalises on **timing, editing, temporal consistency and
> typography**. It does not generalise on **representation**.

Everything that operates on a shot once it has been decided — pacing, event
budgets, cut decisions, frame-by-frame state, kinetic type, safe areas,
collision — worked on all five subjects with no adjustment. Zero temporal
errors across 109 shots. Rhythm in range on every reel. No caption unreadable,
no geometry clipped, no double-value state.

What did not generalise is the step that decides *what the viewer looks at*.
The procedural vocabulary is five diagram types — `gearSystem`, `timeline`,
`measurement`, `orbit`, `scan` — matched by keyword regexes written against a
Greek astronomical calculator. Hormuz scored highest purely because its subject
happens to be made of measurements.

The consequence is visible in one row of the table: **the hard-cut ratio is
1.00 on all five reels.** That is the Cut Director behaving correctly — twenty
shots that look alike offer nothing to rhyme against and nothing to punctuate —
and it is a symptom, not an achievement. When representation collapses, the
editorial layer collapses with it.

---

## Systemic engine weaknesses (3+ unrelated episodes)

### W1 — the procedural vocabulary does not generalise · 5/5 · **not fixed**

41 of 45 lines fell to typography. Roman concrete, the human heart and the
medieval sword got **zero** diagrams in fifty seconds each, and all three are
*process* stories: a crack sealing itself, a two-stage cardiac cycle, a forging
sequence. There is no representation for a process, a map, a cross-section, a
flow, or a comparison.

Reported rather than fixed: adding diagram types is new engine capability, and
the benchmark's job was to find out whether it was needed. It is. The three
worth building first, in order of how many of these five they would have
rescued: **process/sequence** (3 episodes), **map/territory** (1, but it is the
commonest documentary graphic there is), **cross-section** (1).

Two narrower misses in the same family, both one-line matcher gaps:
`MAGNITUDE` does not know `degrees`, so "twelve hundred degrees" — the sword's
only drawable figure — fell to type; and `yearsIn` only recognises four-digit
years, so "40 BC" and "the first century" were invisible to the timeline that
would have fitted Roman concrete perfectly.

### W2 — a procedural visual is never semantically checked · 1/5 · **severe**

The heart's line *"Four chambers, four valves, and every valve in the mechanism
opens one way only"* matched `MECHANISM` plus the figure 4, and the engine drew
**a train of meshing gears as a schematic reconstruction of a human heart** —
labelled `SCHEMATIC RECONSTRUCTION · NOT TO SCALE`, which is the repo's own
definition of a worse lie than a wrong photograph.

The hard semantic gate guards **photographs only**. A procedural visual goes
from keyword match to screen with nothing asking whether it depicts the
subject.

Only one episode, so per the benchmark's rule it was fixed at the episode level
(the line was reworded). **The hole in the engine is still open**, and it is the
highest-priority latent defect found: it produces confidently wrong evidence
rather than a visible glitch, and it would not have been caught by any gate.

### W3 — the anti-repeat rule substituted a template the content could not fill · 5/5 · **fixed**

`composite → title-slate` on a repeat, without asking whether the line had a
title. On reels where most shots are composites — i.e. any reel without
photographs — it fired constantly. Two symptoms, one cause: **blank title cards**
(three unrelated episodes shipped a card with empty kicker, title and footer)
and a **title-slate flood** (7–8 cards per reel; now 3–5).

### W4 — a light beam with no light source · 4/5 · **fixed**

The event filler already refused a beam in a shot with no lamp; `planProps` did
not, and could not — the atmosphere is decided later. The rule lived in one of
the two places that put beams in shots, which is the same as not existing.

### W5 — an evidence board with nothing to put on it · 4/5 · **fixed**

The `list` beat was chosen by counting commas. "Hammer, fold, hammer again"
became a board with zero cards and zero caption: an entirely empty shot.

### W6 — the slot reel never landed · 2/5, 3 shots · **fixed**

`spinFrames` was derived from the shot's length while `titleFrame` came from
the beat schedule, so on a 45-frame shot the reel was still rattling at frame
56. Identical in class to the counter bug fixed in the previous stage; the fix
had been applied to `countWindow` and never to the spin.

### W7 — typography was composed as a caption over a photograph that wasn't there · 5/5 · **fixed**

The worst of the visual failures, and invisible to every gate. On the last rung
of the ladder the engine produced an 84px caption in the top-left corner of an
otherwise black frame: type occupying about **8% of the picture**, and blurred,
because the focus hunt was being applied to a shot with nothing photographic in
it to hunt for.

Three repairs, all inside the existing Visual Director:

- when the shot has no plate and no diagram, the words take the column, the
  optical centre, and statement scale (84 → 104–184px), sized by the same
  arithmetic the clipping checker measures with;
- the fragment is **re-wrapped** for that shape — a caption's 20-character
  lines pin the type to ~70px, so the same sentence is broken into up to five
  short lines and set three times larger;
- no focus hunt where there is no photograph.

### W8 — law 30 had never been applied to type · 5/5 · **fixed**

*"The frame the cut lands on cannot be empty"* was written for diagrams and for
light. A shot whose only content is type is, until its first word lands, a shot
with nothing in it at all — about four tenths of a second of black at every
cut, roughly **eight seconds of a fifty-second reel**. The stack now starts
before the cut: the first line is already set when we arrive and the rest land
onto it. On Baalbek this took the cuts landing on a readable frame from **0 of
20 to 13 of 20** (the remainder are title slates and a counter starting at zero,
both correct).

### W9 — the gates scored an axis that did not exist · 5/5 · **fixed**

`assetRelevance` defaulted to **8.0** for a reel containing no pictures at all.
The number meant to catch "you are showing the wrong thing" was quietly
certifying "you are showing nothing", and all five reels passed the gate at
professionalism 8.9–9.3 while being, at that moment, unusable. The axis is now
dropped rather than defaulted, the average is reweighted over the axes that
exist, and a reel with no photograph anywhere is reported NOT PRODUCTION READY
as a fact rather than a score.

This is the single most important fix in the benchmark, because it is the one
that was hiding the others.

### W10 — the brief validator hard-codes 30 seconds · 5/5 · **reported only**

Every episode was told "9 lines, must be exactly 6" and "129 words — thirty
seconds of narration is about 80". The length target is a constant, not a
parameter, so a 45–50 second brief cannot be written without twelve spurious
warnings. Warnings only; nothing was blocked.

---

## Failure classification, by episode

| Episode | STORY | ASSET | REPRESENTATION | COMPOSITION | MOTION | EDITORIAL | ENGINE | QA |
|---|---|---|---|---|---|---|---|---|
| Baalbek | — | supply | **primary** | dark ground, dead camera | — | 100% plain cuts | — | — |
| Roman concrete | — | supply | **primary** | shot 0 collision | — | — | — | — |
| Hormuz | — | supply | **primary** | prop overlap | — | — | — | — |
| Human heart | mood choice | supply | **primary** | flat mustard field | low density | — | **wrong gear train** | — |
| Medieval sword | — | supply | **primary** | shot 0 collision | 3× push run | — | — | — |

Every episode's main failure is the same one. That is what makes it systemic
rather than five separate problems.

---

## What worked

- **Temporal consistency: 0 errors across 109 shots.** Every counter lands on
  its figure, every reel shows one value, nothing is scheduled after a cut.
- **Pacing generalised without adjustment.** 2.17–2.46s average, rhythm 0.23–0.29
  on all five, no unreadable caption, no dead shot in the final cut.
- **The Cut Director made honest decisions.** Every seam carries a kind and a
  stated reason; it declined to decorate 109 seams because there was nothing to
  decorate, which is the correct answer and the one the previous layer could not
  give.
- **Typography, after the repair, is genuinely good.** *"Iron / with too /
  LITTLE / carbon / bends"* at 170px across five lines is a composition, not a
  caption.
- **The refusal path held.** Forty-five lines asked for a picture, none was
  obtainable, and not one wrong or placeholder image reached the screen.
- **The checks caught my own repairs.** The clipping check rejected two of my
  three attempts at the typographic sizing before a frame was rendered.

## What failed

The engine can compose, time, cut and typeset a documentary short on any
subject. It can only *illustrate* one that happens to be a mechanism with a
count, a span of years, a magnitude in a known unit, an orbit, or a scan.

Five out of five briefs proved that. Three of the five would have been
substantially rescued by a single new representation — a **process**: an ordered
sequence of stages, drawn, where each stage causes the next. That is the one
recommendation this benchmark makes.
