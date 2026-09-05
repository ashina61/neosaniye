# Ink Theater — hand-drawn "moving art" (creative skill)

> Style id: `ink-sketch` · Engine: `ink-theater/ink-theater.js` · Runtime: HyperFrames (atelier)
> Technique credit: inspired by Ian's `小黑/Xiaohei` MIT skill. Generic, English, motion-first.

**What it is:** a minimalist **black-ink-on-white** world where a deadpan mascot *physically performs* an abstract idea by operating an absurd **low-tech contraption**. Not a fixed catalog of scenes — a generic method + a parametric engine. Runs on the `animation` pipeline in atelier mode; it is NOT its own pipeline.

## The generic method (concept → moving scene)

The "unlock" from research + the Xiaohei composition rules is a 3-step metaphor generator — do this in the agent, not in code:

1. **Abstract concept → one physical ACTION** — stuck, leaking, compounding, sorting, fermenting, pushing, sinking, unraveling.
2. **System → one low-tech OBJECT** — press, funnel, well, jar, conveyor, ladder, bridge, cabinet, boulder, gate, scale.
3. **Mascot PERFORMS the action on the object** — it cranks / pushes / pumps / stamps / fishes-out. *If you can delete the mascot and the metaphor survives, it's decoration — redo it.*

Then stage as beats on one continuous white page with a camera (pan / push).

## Mined archetypes (pick one, invent fresh specifics)

| Archetype | Mascot action | Motion recipe |
|---|---|---|
| **Contraption** | operates a machine (crank/lever/pump) | feed in → crank → machine works (steam/gauge) → output pops |
| **Before/after load-shift** | crushed by chaos → relaxed, one key act | left chaos → orange sweep → right structure assembles |
| **Journey / pitfalls** | walks a path; falls in pits or hits nodes | path draws on → walk → pit swallows / node pops → blue return loop |
| **One → many fan** | splits/cuts one source | source splits → arrows draw to N branches → each branch acts |
| **Push / momentum** | shoves a boulder up, it rolls away | slow strained up (power1) → crest → fast roll (power2.in) |
| **Well / extract** | lowers a bucket into noise, scoops the gem | bucket descends → scoop → pull up the one good bit |

## Color grammar (strict)

- **black** = structure & mascot · **orange** = flow / arrows ONLY · **red** = the problem / warning · **blue** = the good end-state.
- Pure white paper, ≥35% negative space, subject ~40–60%. Deadpan, never cute. (The playbook's "white-dot eyes" do not survive an unfilled head on white paper — Nib's eyes are ink, both on one side. See `ink-theater/NIB.md`.)

## Engine cheat-sheet (`InkTheater`)

- Lines: `inkPath(pts)`, `inkRibbon(pts,{width,taper})` (brush). Boil: `boil(turbEl, tl, {duration})`.
- Motion: `ease.{settle,overshoot,bouncy,soft}` (seek-safe springs) — use overshoot for pops, settle for arrivals, bounce for landings.
- Character: `mascot({x,y,scale})` → `.reachL/.reachR([x,y])` (FABRIK). Follow a moving target via GSAP `onUpdate`.
- Machines: `parts.{crank,gauge,hopper,slot,lever,box}` — compose them.
- Full API + determinism rules: `ink-theater/README.md`.

## Characters — Nib, the recurring one

> **Read `ink-theater/NIB.md` before drawing or posing a character. It is the character sheet, and it is binding.**

The channel has one recurring character. He is not redrawn per video: `InkFigure.attach(pup)` with **no options** IS the character. Passing options makes a different character.

```js
var pup = InkPuppet.create(mount, { cx: CX, ground: GROUND, boil: "boil" });
var fig = InkFigure.attach(pup);                 // Nib
InkPuppet.still("shuffle", 34);                  // a standing pose that matches the clips
InkPuppet.choreograph(tl, pup, [{clip:'walk',dur:4},{clip:'still',dur:3},{clip:'walk',dur:4}], {start:3.1});
// never pick a walking speed — slide the world by what the feet actually did
function worldX() { return WORLD0 - pup.travel * SCALE; }
```

**Root motion.** Clips carry `rootX`; `pup.travel` is how far the choreography has walked and `InkPuppet.travel(clip, seconds)` answers the same question ahead of time, so a layout is solved backwards from the acting. Planted-foot slip per frame is 1.2px doing this and 13.0px with any chosen speed. The clips are projected **side on** (onto the direction the motion travels) — they used to be projected onto world X regardless, which gave a 30-unit stride on a 538-unit figure and a walk that could not travel.

**Scale everything else in the scene off him.** He is 538 units crown to sole and 1750mm tall, so `MM = SCALE*538/1750` and then every prop is drawn in real millimetres — a door is 2030x820 with its handle 1050 off the floor. Look the number up; do not eyeball it.

**His hands:** `fig.carry` (near arm) and `fig.hold` (far arm), each `{on, from, dx, dy}`, tweened from the timeline. Two hands, so he can hold a thing and work a handle at the same time. Measure a reach from `"shoulder"`, never the chest — the clips are shot from different angles and a chest-relative target that is a comfortable bent arm in `walk` is off the end of the arm in `shuffle`, where FABRIK straightens it and points. To hold something that moves on its own (a handle, a crank), use `from:"point"` with `InkFigure.toPose()` recomputed every frame.

**Redraw from the tweens that move him.** A gsap timeline renders children in start-time order, so a per-frame redraw tween at position 0 runs *before* a gesture tween further along the timeline has written its values. Give every tween that moves him `onUpdate: () => pup.setPose(fig.pose())`.

**Motion is never hand-authored.** Use the **mocap action library**:

- `InkPuppet.create(mount,{cx,ground,boil})` → `p.drawIn(tl,{start})` (self-drawing reveal) → `InkPuppet.choreograph(tl, p, [{clip:'walk'},{clip:'dance_spin'},{clip:'wave'}], {start})`.
- **Read `ink-theater/mocap/catalog.json` and pick moves that fit each beat — vary them, and NEVER loop one clip** (looping is what makes videos feel repetitive). 12 today (all CMU-sourced): walk, run, climb, march, shuffle, jump, kick, sit, wave, twist, dance_spin, dance_glide.
- **Move not in the catalog?** `node ink-theater/mocap/add-motion.mjs <name> <cmu-id|url|path> <category> "<desc>"` — fetches, converts (auto-maps fair1 / CMU / Mixamo skeletons), rebundles + updates the catalog. Free CMU mocap (`una-dinosauria/cmu-mocap`) has thousands. Then copy `mocap/clips.js` into the project.
- **Speech balloons** (characters "talking"): `InkTheater.balloon(tl, {into, overlay, at, dur, text, mouth:[x,y], center:[x,y], boil})` — HTML text so the webfont applies.

## Draw it right, not just tidy

The bar is "close to real". Two things carry most of it:

- **Real dimensions.** Anything a person uses has a standard size. Derive it in millimetres off the character's height, in the composition, with the millimetre figure in the comment beside it.
- **Cutting.** Land the cut on the action, inside one movement, and do NOT cross the line: if he walks right in scene A he walks right in scene B. Cutting to "the same door from the other side" swaps left and right and turns him round — cut ninety degrees instead, to a different wall, with the door he came through seen edge-on in the corner. Move the camera a few percent as well, or a cut reads as the wall having changed behind a man standing still.
- **Perspective where flat elevation is ambiguous.** Seen exactly square on, a door swinging away is a pure horizontal squash — geometrically right and unreadable, because it just looks like a narrower door. Project it instead: a point `u` from the hinge sits at depth `u*sin(angle)` and scales about the vanishing point by `D/(D + u*sin(angle))`. At angle 0 the scale is 1 everywhere, so the closed state needs no fudge. The vanishing point is the camera's axis and is fixed to the PAGE, so it moves through world coordinates as the world scrolls. Worked example: `ink-theater/tests/nib-door/`.

## ⚠ Non-negotiables

- **Handwriting font: embed the FULL font, not a Google-Fonts subset woff2** (a `css2`-API subset is missing basic-latin → silent serif fallback everywhere). Use the bundled `ink-theater/assets/patrickhand.ttf` (`@font-face … format("truetype")`) on **HTML overlay `<div>`s** for captions/speech-balloons. No Google hot-link (breaks determinism). See `ink-theater/README.md` → "font gotcha".
- Determinism: closed-form springs, seed-stepped boil off the timeline, no `repeat:-1`, seeded PRNG only.
- One paused `gsap.timeline` on `window.__timelines`. Validate with `lint` + `snapshot` (read the contact-sheet) before render.
- **Pipeline-exempt**: this is a style + engine on the `animation` / `character-animation` pipelines — NOT a Rule-Zero pipeline. Don't stall looking for an `.yaml` manifest.

## Reference builds

- `ink-theater/tests/nib-corridor/` — **the rig reference.** Corridor, toolbox, lever, door, cut, room, bench: the walk, root motion, two hands, the cut, real dimensions and the perspective door, all in one 15s build.
- `projects/ink-theater-reel/` — capabilities reel. · `projects/ink-theater-momentum/` — "Momentum" story (handwriting via HTML divs).
