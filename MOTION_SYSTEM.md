# The motion system

The design language: what moves, why, and where the decision is made.

This document exists because the engine could already do most of it and nothing
was asking. Every device below was written, tested, and wired into zero shots —
so the reels came out as photographs being slowly scaled, and every automated
check passed.

---

## 1. The floor and the events

**A camera push is not an event.** It is the floor — the thing that stops a shot
being a still photograph — and a shot whose only content is its floor has
nothing in it.

An **event** is a discrete thing arriving at a frame you could point to: words
landing, a card dropping onto a desk, a wireframe closing on a subject, a number
starting to climb, a mark drawing itself, the camera taking a hit.

Every shot gets **at least two**, spread across its length, the first one early.
Below `40` frames a shot is a flash and gets one. Above about six seconds it
gets no more than five, because the rule is *animate what matters*, not
*animate everything*.

This is enforced in three places, and it needs all three:

| where | what it does |
| --- | --- |
| `scripts/lib/director.mjs` | budgets and schedules the events when the config is compiled |
| `scripts/lib/critique.mjs` | fails the build if a shot has none, warns if it has one |
| the templates | read the frames out of `params` and draw on them |

---

## 2. Motion primitives — `engine/motion.ts`

Numbers in, numbers out. Nothing here knows what it is animating, which is why
a second episode costs nothing.

**Time**
- `posterizeTime(frame, fps, stepFps)` — snap the playhead to a coarser rate.
  Feed *this* frame into everything, or the scene glides underneath a juddering
  treatment and the two fight.

**Arrival**
- `springEntrance(frame, fps, opts)` — the glide-and-settle of a hand placing
  something down.
- `stagger(index, {from, every, ease})` — when the *n*th thing in a group lands.
- `wipeMask(progress, direction, softness)` — a soft-edged reveal, as a CSS mask.
- `clipReveal(progress, direction)` — a hard edge, for graphics and rules.
- `drawOn(frame, [start, end])` — 0..1 along a stroke, for anything hand-drawn.

**Impact**
- `punch(frame, at, {amount, rise, decay})` — snaps up in two frames, decays
  back. The asymmetry is the whole thing: a symmetric pulse reads as a spinner.
- `shake(frame, at, {amplitude, decay, rate})` — the camera taking a hit. Two
  sines at incommensurable rates so the path never repeats, times a decay so it
  is an event rather than a loop.
- `dampedSwing(frame, opts)` — a pendulum that swings hard and settles.

**Continuous**
- `boil(frame, opts)` — the sub-percent wobble that keeps a still cut-out alive.
- `drift`, `pingpong` — one-way travel and symmetric oscillation.

**Quantity and type**
- `countTo(frame, [start, end], to, from)` — eased out, so it runs fast and
  lands slow. A linear count is a clock, and a clock does not make a figure feel
  large.
- `tracking(frame, [start, end], [from, to])` — letter-spacing settling in.

**Lens**
- `focusHunt(frame, duration, opts)` — an old lens finding its subject. Every
  key is a fraction of the shot, never a fixed frame count.
- `blurBurst(frame, keys, maxPx)` — motion blur peaking at the fastest point.

**Determinism**
- `hash01(seed, salt)` — same input, same frame, every run. There is no
  `Math.random` anywhere in the engine.

---

## 3. The camera — `engine/Camera.ts`

One camera per shot. Every layer takes the fraction of its move that its
**depth** allows:

```
0     the sky.              Infinitely far; the camera moving does not change it.
0.5   the building.         Half of everything.
1     the subject.          All of it.
```

Give two layers their own camera and they stop being one space. Unequal scaling
about a **shared floor point** is the entire depth illusion — miss the shared
anchor and the near layer slides off the far one, which is the single most
common way this effect fails.

```ts
const camera = useCamera(cameraFromParams(scene.params, durationInFrames), durationInFrames);
camera.scaleAt(depth);      // the push, this layer's share
camera.offsetAt(depth);     // pan travel + handheld breath + impact
camera.rotate;              // roll + impact; the camera body, so equal for all
```

Moves, chosen by the director and never repeated three shots running:

| move | what it says |
| --- | --- |
| `push` | *look at this* — toward the subject |
| `pull` | *and here is where it was* — opens out |
| `pan` | travels **past**, so the near layer sweeps and the far one barely shifts |
| `drift` | slow cinematic rise, a degree of roll |
| `hold` | still on purpose, still breathing |

`hold` is a decision, not an absence. Stillness is what gives the movement
around it somewhere to land. A locked-off digital still with grain on it is the
look this whole system exists to get away from, so even a hold keeps its
handheld breath.

A **pan starts oversize** (`pushFrom > 1.05`) or it pans onto the void at the
frame edge. A short shot never pans: a pan nobody has time to see is a plate
vibrating.

---

## 4. Kinetic typography — `engine/draw/Kinetic.tsx`

Words arrive one at a time, and **one word is not like the others**.

```
"The stone weighs 1,000 tons"
                  ^^^^^^^^^^ the reason the sentence exists
```

`emphasisOf()` in the director picks it, in this order:

1. **A figure with the thing it counts** — `1,000 tons`, `fifty years`,
   `fourteen hundred years`. A bare number says nothing: a card reading `TWENTY`
   had thrown away the miles. A run continues only through a *magnitude*
   (`hundred`, `thousand`), so `1956 ten` is never joined into one figure.
2. **A name** — capitalised, and not merely the first word of a sentence.
3. **The longest content word**, which is at least never "the".

The emphasis takes the accent colour, 1.16× the size, uppercase, a punch on
arrival, and a drawn mark. Everything else gets out of its way.

**Reveals** — the entrance for the rest of the line:

| reveal | what it is |
| --- | --- |
| `rise` | the word climbs out from behind a matte. The signature. A fade says the word *became visible*; a rise says it *arrived*. |
| `wipe` | a soft-edged mask travelling up the word |
| `blur` | out of focus and drifting up into place |
| `punch` | scale hit — always used on the emphasis, whatever the line does |
| `char` | typed in letter by letter. Slow, so it is a signature and not a default. |

**Marks**, drawn *behind* the type and wiped on a few frames later, because a
hand marks something it has already read: `highlight`, `underline`, `box`,
`none`. `none` is in the rotation because most lines want it.

**Two guarantees the engine makes, not the config:**

- **The words fit the frame.** The column is bounded and the size comes down
  until the longest line fits at the size the *emphasis* will be set at. The
  same law the title card was fixed under, in the other text component.
- **A stack cannot start leaving before it has finished arriving.** `recedeAt`
  is pushed past the last word's landing frame. On a short shot the caption
  began fading at frame 38 while its second line was still landing at 44.

---

## 5. Line breaking

Captions are broken by a scorer, not by `words.length / lines`:

- balance, measured in **characters** (`of a book` and `Antikythera` are one
  word each and are not the same length on screen)
- a penalty past ~20 characters, where the type has to shrink
- a nudge against ending a line on a preposition or article
- a near-disqualifying penalty for **splitting the emphasis across a break** —
  the type layer sets an emphasis inside one line, so a figure straddling a
  break loses its accent silently

Every arrangement into one to four lines is scored. Ten words at most, so it is
a few hundred candidates — cheaper than one frame of the render it feeds.

---

## 6. Graphics that say something

Law 2 of this repo: **people and places are photographs, everything else is
drawn.** The reference short runs on about twenty assets and only four are
backdrops.

- **Props** (`engine/draw/Props.tsx`) — objects *in the room*: a plaque, a front
  page, an index card, a print, a wireframe, a shaft of light. They take the
  camera push their depth allows, because they are standing in the same space.
- **Motifs** (`engine/draw/Motif.tsx`) — graphics *about the sentence*: coins
  falling and piling, a route drawing itself, a tally being cut, a count
  climbing. Pinned to the frame, taking no part in the push. A photograph says
  who and where; a motif says what happened.
- **Annotations** (`engine/draw/Annotation.tsx`) — an underline, a circled word,
  a bracket, an arrow. They **draw themselves** along their own length and they
  are not straight: a geometrically perfect underline is the tell that a
  computer drew it.

Two rules hold for all three: **it must have something to say**, and **never the
same one twice running**.

---

## 7. Transitions

A transition only ever touches the **incoming** shot. Cross-fading two scenes
means overlapping them on the timeline, and an overlap makes every duration in
the config a lie.

`slam` · `slip` · `flare` · `rack` · `blinds`

Each episode draws four of the five from its seed, so two episodes have
different vocabularies. The sentence can earn a cut (`CUT_WORDS`) and a sentence
that earns one beats the anti-repeat rule — **but never three times running**.
Without that ceiling, every closing line of a war episode matched the same word
list, earned the same cut, and the reel shipped with four consecutive flares.

---

## 8. The guardrails

Stated once in `withoutRepeats()` and reused everywhere:

> **Never the same thing three times running.**

Deliberately not *never twice*. Two of something is a rhyme; forbidding rhymes
makes a reel alternate mechanically, which is its own tell. Applied to
transitions, camera moves, text reveals, emphasis marks, drawn props, motifs and
templates — with one exception: `composite` is the *general case*, not a device,
and a reel that is mostly composites is a reel that is mostly shots.

## 9. The retention curve

`escalation(index, total)` returns 0..1 and drives the camera's reach and how
loud the drawn devices get:

```
opening   0.90    it has to earn the next two seconds or nothing after it is watched
middle    0.42 →  a shallow climb, so shot eight is a little bigger than shot three
close     1.00    the only part anybody quotes
```

Impact shake is only available above 0.8, and even then only sometimes: a reel
where the camera is struck on every cut is not emphatic, it is broken.
