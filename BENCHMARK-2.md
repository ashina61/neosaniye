# Visual vocabulary expansion — before / after

The first benchmark found the bottleneck: the engine generalised on timing,
editing, temporal consistency and typography, and **not on representation**.
Forty-one of forty-five lines fell to typography because the procedural library
was five diagram types tuned to one episode.

This phase added five first-class representations, put the hard semantic gate
on procedural visuals, and limited the typography fallback. Then the same five
briefs went through the same pipeline again, unchanged.

---

## The headline number

| | Before | After |
|---|---|---|
| Lines resolving to typography | **41 of 45** | **9 of 45** |
| Shots carrying a drawing | 6 of 109 | **78 of 109** |
| Distinct representation kinds used | 1 (`measurement`) | **6** |
| Semantic failures | 1 shipped undetected | **0**, and the gate now catches it |

Nothing was hand-authored. No episode id appears in any selector, and a test
asserts that a subject the repo has never seen — glass-blowing — still resolves
to a process.

---

## Per episode

| Episode | Shots | Typography | Map | Process | Section | Anatomy | Scale | Measure | Hybrid | ASSET_REQ | Semantic fails | Score |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Hormuz** | 22 | 9 → *was 19* | **11** | 0 | 0 | 0 | 0 | 2 | 0 | 9 | 0 | 6.5 → **7.5** |
| **Baalbek** | 20 | 4 → *was 17* | 2 | 0 | 0 | 0 | **14** | 0 | 0 | 9 | 0 | 6.0 → **7.0** |
| **Roman concrete** | 23 | 5 → *was 23* | 4 | 0 | **14** | 0 | 0 | 0 | 0 | 9 | 0 | 5.5 → **7.5** |
| **Medieval sword** | 22 | 6 → *was 22* | 0 | **14** | 0 | 0 | 2 | 0 | 0 | 9 | 0 | 5.5 → **7.5** |
| **Human heart** | 22 | 7 → *was 22* | 0 | 0 | 0 | **15** | 0 | 0 | 0 | 9 | 0 | 5.0 → **7.0** |

`ASSET_REQUIRED` is still 9 per episode: no photographic supply is reachable in
this environment (Commons and the generator both return 403), so every line's
picture request remains outstanding. That is unchanged and is not what this
phase was about.

**The expected mapping emerged from semantics, not from episode ids:**

```
Hormuz          → MAP            "twenty-one miles across", "northern shore, southern"
Baalbek         → SCALE_HAULAGE  "eight hundred tons", "rolled", "a thousand men"
Roman concrete  → CROSS_SECTION  "a crack opens", "water reaches", "seals it shut"
Medieval sword  → PROCESS        "heated", "hammered", "folded", "quenched"
Human heart     → ANATOMY_FLOW   "four chambers", "four valves", "to the lungs"
```

---

## The five questions

**Can it show a process?** Yes. One outline persists across every stage: it
stretches under the hammer, reddens in the fire, shortens when folded, tapers
when ground, goes cold in the quench. The agent is drawn above doing the thing;
the caption names the state *and its cause* — `FOLDED / THE LAYERS DOUBLE`. A
test asserts that every stage has the same point count, so the object tweens
rather than cutting, and that every transformation states what caused it.

**Can it show geography?** Yes. Two coasts, the water between, one lane in and
one out, a dimension across the gap. Built from a sentence that says *twenty-one
miles across* and *northern shore, southern shore*. There is no map of Hormuz in
this repository and there is not going to be — the coasts are generated from the
line's seed, and every frame carries `SCHEMATIC · NOT TO SCALE`.

**Can it show anatomy?** Yes, and this is the episode that once produced a gear
train. Four chambers contracting on their own phases, valves swinging open one
way, particles travelling a circuit that **closes**. The chamber count is read
off the sentence. A test asserts the loop returns to where it started.

**Can it show an internal mechanism?** Yes, and it advances across the reel
rather than restarting: modern concrete cracks → the Roman mix with its lime
lumps already in it → a crack propagates down through the strata → water runs
down the crack it cannot outrun → a lump is consumed → mineral bridges the gap
and the crack closes. Causal ordering is enforced by test, not hoped for.

**Can it show scale?** Yes. The block stands on the ground line, measured
against a human figure drawn at a stated height, on rollers that turn at the
speed it travels, with ropes leaving the frame and a force arrow reading
`NO CRANE`. The size is *derived from the person*, which is the only way a
drawing makes a thousand tons mean anything.

---

## The semantic contract

Every drawn spec now declares `subject`, `claims` and `depicts`. The gate runs
on **PHOTO, PROCEDURAL, DIAGRAM and HYBRID** — before, it guarded photographs
only, which is exactly how a gear train shipped as a schematic reconstruction of
a human heart.

The refusal is a **domain**, read from the sentence, not a list of forbidden
topics:

| representation | may be a picture of |
|---|---|
| `map` | geography |
| `process` | process, material |
| `crossSection` | material, anatomy, process |
| `anatomyFlow` | anatomy |
| `scaleHaulage` | scale, process |
| `gearSystem` | mechanism — **and nothing else** |
| `timeline` | elapsed |
| `measurement` | scale, quantity, geography |
| `typography` | abstract, quantity, elapsed |

All five required rejections pass as tests:

```
humanHeart      → gearSystem      FAIL
swordMaking     → timeline only   FAIL
strait          → typography only FAIL
romanConcrete   → generic form    FAIL
megalith        → a number alone  FAIL
```

A continuation is a *fragment*, and the drawing belongs to the **sentence** — so
the gate checks the declared subject rather than the shot's own three words. The
first version checked the fragment and reported nineteen correct drawings as
wrong across four episodes. A check that cries wolf on the correct case is a
check people switch off.

---

## Bugs found by looking at frames

Six, none of which any automated check would have caught before it was written:

| what shipped | cause | fix |
|---|---|---|
| A giant **X** across the northern landmass | the coast polygon closed backwards and self-intersected | each landmass runs its coast one way and closes along the frame edge |
| The strait labelled **20 MILES** while the narration said twenty-one | `figureIn` read "twenty-one" as two tokens and took the first | hyphenated compounds are one number |
| Water drawn with **no crack to run down**, and the payoff shot — the seal — drawing an empty box | the crack was gated on the word *crack* alone | a channel is a precondition of a fluid and of a seal |
| A thousand-ton block **buried below the road** | `baseY` is the top of the object; the support height was subtracted without its own height | stands on the ground |
| Vessels running **through chambers and through the caption** | paths cut corners across the middle | routed outside the organ, drawn as curves |
| `SURFA` — section labels off the right edge, and the last map marker's label too | the clipping checker knew none of the five new types | bounds added for all five; the checker then caught both |
| The counter reading **576.377 TONS** | a raw float interpolation instead of the repo's shared integer counter | `counterValue`, as law 27 requires everywhere else |

The clipping-bounds fix is worth singling out: adding the five new types to
`boundsOf` immediately surfaced two real defects that had already rendered. A
new primitive is not finished until the checks know its geometry.

---

## What is still open

- **The hard-cut ratio is 1.00 on all five reels.** A drawing-heavy reel where
  most shots share a kind gives the Cut Director no correspondence to rhyme
  against and no plain cut to contrast with. It is the correct answer and it is
  still a flat editorial texture.
- **Nine typography lines remain across the five**, and they are the right nine:
  five are deliberate title slates, four are genuinely abstract claims — *a fifth
  of everything the world burns*, *every fuel price on earth moves*. Words are
  the honest representation for those.
- **`yearsIn` still only recognises four-digit years**, so "40 BC" and "the first
  century" cannot become a timeline. Reported in the first benchmark, still open.
- **Consequence has no representation.** *One grounded tanker closes the strait
  and every price on earth moves* is a dependency propagating out of frame. A map
  can show the blockage; nothing can show the consequence.
- **The moods still fight the subjects.** `gold-heat` gives an anatomy plate a
  mustard ground. That is a brief-level choice, not an engine limit.

## What this does not claim

The scores moved from 5.0–6.5 to 7.0–7.5. That is the difference between *a reel
that tells you* and *a reel that shows you*, and it is not the difference between
that and a finished professional short. These reels have no photography in them
at all, their grounds are gradients, and their camera work is invisible over
flat ground. The representation layer generalised; the picture quality is still
bounded by having no pictures.
