# The Motion Bible

**Version 1.0.0** — machine-readable form in `visual-system/dna.mjs`.

> **Motion must have a reason.**
> Every movement in a shot belongs to one of six families, and a family is not a
> category of effect — it is a category of *why*. A motion that cannot name its
> family is decoration, and decoration is the thing this pipeline has spent four
> phases removing.

---

## The six families

### ENTRANCE — *something arrives that was not there*

`rise` · `wipe` · `punch` · `blur` · `draw-on` · `clip-reveal` · `stagger` · `spring`

**8–26 frames · `out(cubic)`**

The channel's default entrance for anything drawn is **`draw-on`**: a stroke
arriving along its own length. A diagram that fades up is an overlay; one that
draws is a hand explaining something, and that is the whole documentary register
being aimed at.

Words arrive one at a time (`stagger`), not as a block. A line that arrives is a
line; a line that lands has one word arriving differently from the rest.

### EMPHASIS — *one thing matters more than the rest of the frame*

`punch` · `highlight` · `underline` · `box` · `flicker` · `recolour` · `shake`

**4–18 frames · `out(back)`**

One word a line. A line where every word is emphasised has no emphasis, it has
shouting.

`flicker` is **HOLD keyframes, never a ramp** — a fluorescent tube striking, not
a dissolve. Put an easing curve on it and it stops being a strike.

Emphasis marks *draw themselves*. `Mark` never fades in.

### TRANSFORMATION — *the same object is different at the end than at the start*

`morph` · `deform` · `state-change` · `material-change` · `growth` · `contraction`

**18–60 frames · `inOut(cubic)`**

The rule that separates this from ENTRANCE: **the same object continues.** Four
cards showing four stages is four illustrations. One outline that stretches under
the hammer, reddens in the fire, shortens when folded and tapers as it is ground
is a *process*.

And transformation obeys the material: metal does not appear or vanish under a
hammer, it **moves**. Drawing a bar out makes it longer and thinner; folding it
makes it shorter and thicker. Volume is conserved because volume is conserved.

### CAUSAL — *B happens because A happened, and the frame shows the because*

`force-transfer` · `propagation` · `flow` · `chain` · `mesh` · `squeeze`

**12–90 frames · physical models**

The most important family, and the one that separates motion design from
animation.

```
A moves, B moves, C moves            → decoration
A turns → B turns BECAUSE A turns
       → the counter reaches thirty
       → every wheel lights           → motion design
```

Never animate every object independently. In a gear train the ratio is
**physical** — the inverse of the tooth counts — so the meshing is not faked. A
load moves and the rollers turn *at the speed it travels*; if it stops they stop.

**The silent-viewer test:** with the narration muted, the visual sequence should
still communicate the physical relationship whenever the subject allows one.

| story | wrong | right |
|---|---|---|
| "pressure opens the valve" | animate the valve | pressure rises → valve begins opening → flow begins → camera follows the flow |
| "water entered the crack" | fade in some water | crack exists → water reaches it → water follows it down → material reacts |
| "the hammer changes the metal" | swap the shape | hammer approaches → impact → deformation → heat response → next state |

This does **not** mean every abstract statement needs a diagram. "Every fuel
price moved" is carried by typography and that is correct. "Water entered the
crack and reacted with lime" is not.

### CAMERA — *the frame itself is answering the shot*

`push` · `pull` · `pan` · `tilt` · `drift` · `hold`

**30–180 frames · `out(cubic)`**

**A camera move is chosen by the beat, not by a die.**

```
reveal → push        verdict → hold        aftermath → pull
context → pan        escalation → push     hook → push
```

No family may carry more than ~30% of a reel's shots. Ten moves of which eight
are pulls is not a camera style, it is a tic, and it reads as one.

**The push is the floor, not the event.** A shot whose entire content is "a
photograph and a 1.46× push" has one thing happening in four and a half seconds:
the picture got 13% bigger. Two frames taken a third and two thirds of the way
through are indistinguishable.

A drawing gets a fraction of the shot's camera and never more than **1.18×**,
because a drawing has only the frame it was composed for.

### EXIT — *something leaves, and leaving is an event*

`recede` · `dissolve` · `move-through` · `hard-cut`

**6–24 frames · `in(quad)`**

An element that stops being drawn has either *exited* — which is an event, and
events are stated — or it has been forgotten. The viewer cannot tell those apart.

---

## Easing

The channel uses nine curves and no others. A tenth is a new language.

```
out(cubic)   out(quad)   inOut(cubic)   inOut(quad)
in(cubic)    in(quad)    out(back)      linear      physical
```

### Physical easing is not a curve, it is a model

A thousand-ton block does not ease like a menu. `engine/motion.ts`:

| model | what it is |
|---|---|
| `heavy` | mass — most of the shot spent starting, most of the rest failing to stop |
| `tension` | a rope taking up its slack, overshooting once, settling |
| `rigid` | flat, step, flat — something that yields all at once |
| `impact` | displacement and one bounce |
| `flow` | continuous, never arrives |
| `cyclic` | fast stroke, slow return — a pump, a bellows, a heart |
| `angular` | exactly linear, because a wheel does not ease |
| `settle` | a small give at the end |

### One clock

Everything steps at **12 fps posterized time**. Everything steps together or
nothing does — a shot where the type is on the grid and the drawing is not reads
as two shots playing at once.

---

## Motion composition

A shot must not be *"show something + zoom"* unless the brief calls for a static
hold. Prefer a chain:

```
EVENT → RESPONSE → CONSEQUENCE → CAMERA RESPONSE → PAYOFF
```

For a haulage shot:

```
the capstans take up   → the rope loses its sag   → the load begins to move
→ the rollers turn at the load's speed  → the camera holds  → the tonnage lands
```

**An event is an arrival you can point at a frame of**: words landing, a card
hitting a table, a wire closing on a subject, a number starting to climb, a mark
drawing itself, the camera taking an impact.

Every shot gets **at least two**, spread across its length, the first early. A
shot under 40 frames is a flash and gets one. A shot over six seconds gets no
more than five — the law is *animate what matters*, not *animate everything*.

## Motion density follows information density

Never animate everything at once to look busy.

| shot | events | what it does |
|---|---|---|
| low information | 1–2 | controlled movement, or a hold |
| high information | 3–5 | coordinated, and **ordered as a chain** |
| payoff | 2–4 | strong motion, then a hold long enough to read |

A payoff must be allowed to land: **1.2 seconds minimum** of hold after the
claim arrives. Below that it is a flash, and a flash is not a conclusion.

---

## Transitions

**The default is a hard cut, and that is not a limitation.** The grammar of
documentary editing is the hard cut. Most cuts being plain is what allows the
three that are not to mean something. A reel that decorates every seam has no
punctuation left.

A non-hard cut must carry a reason:

| device | motivated by |
|---|---|
| `MATCH_CUT` | the two shots genuinely rhyme — circle onto circle, rule onto rule |
| `OBJECT_WIPE` | an object in the outgoing shot carries the incoming one on |
| `MASK` | the incoming shot is revealed *through* something in the outgoing one |
| `MORPH` | the same object continues and changes |
| `DIRECTIONAL` | space continues across the cut |
| `FADE` | time passes |
| `FLASH` | an impact lands on the cut |

**A shared accent colour is not a rhyme.** The first cut director thought it was
and gave six of nine seams a match cut — and six match cuts is no match cuts.

**And when two shots genuinely rhyme, the seam stays hard.** The strongest
transition is made of nothing; putting a wipe over a real rhyme erases the thing
that made it work.

Safety, not taste: no device may carry more than 25% of a reel's seams; a
darkening arrival (`blinds`, `flare`, `rack`) never runs on a shot under 60
frames; no arrival eats more than an eighth of its shot.

---

## Remotion is the execution engine

The architecture makes this explicit:

```
DIRECTOR         decides WHAT and WHY
REPRESENTATION   decides HOW the idea is represented
REMOTION         executes the representation IN TIME
```

Remotion owns frame-level animation, interpolation, easing, camera movement,
compositing, masks, transforms, morphing, particles, drawing, kinetic
typography, counters, parallax, temporal choreography and final composition.

Those responsibilities do **not** move into static configuration. A config says
*a counter climbs to 800 over 26 frames*; it does not say what the counter reads
at frame 14. That is Remotion's job, and `state.mjs` is how the checker asks the
same function the renderer draws with.
