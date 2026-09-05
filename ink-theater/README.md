# Ink Theater

A deterministic, seek-safe engine for hand-drawn **"moving art"** — a minimalist black-ink-on-white world where a deadpan mascot physically *performs* an abstract idea by operating absurd low-tech contraptions. Built for OpenMontage's **atelier** path and rendered through **HyperFrames** (HTML/SVG/CSS + one paused GSAP timeline → MP4).

Inspired by Ian's `小黑 / Xiaohei` illustration skill (MIT — credit Ian for the technique); this is an original, generic, English, motion-first engine, not a copy.

## Why it exists

The illustration style is simple enough that **the illustration IS the animation** — no diffusion model needed. Vector shapes + math give you the whole thing: free, deterministic, infinitely editable, and the character genuinely acts out the concept. This engine turns the research findings (`memory: project_ink_atelier_animation`, deep-research on vector/physics/metaphor foundations) into reusable primitives.

## The five capabilities (`ink-theater.js`, global `InkTheater`)

| Module | What it does | Key API |
|---|---|---|
| **ink strokes** | Confident hand-drawn lines — variable-width brush ribbons + wobbled centerlines | `inkPath(pts, opt)`, `inkRibbon(pts, {width,taper,seed})` |
| **boil** | Seek-safe hand-drawn line "boil" — steps a `feTurbulence` seed off the timeline (~9fps), NOT SMIL | `boil(turbEl, tl, {duration,fps})` |
| **spring physics** | Closed-form damped-spring eases (anticipation/overshoot/settle) — pure functions of progress, seek-safe | `springEase({stiffness,damping,mass})`, `ease.{settle,overshoot,bouncy,soft}` |
| **rig / IK** | 2D FABRIK inverse kinematics + a riggable mascot whose arms reach a target | `fabrik(lengths,origin,target)`, `mascot({x,y,scale})` → `.reachL/.reachR([x,y])` |
| **contraption grammar** | Parametric composable machine parts | `parts.{crank,gauge,hopper,slot,lever,box}` |

## Determinism (HyperFrames render contract)

Every frame must be reproducible from time alone. This engine obeys that:

- **Closed-form springs** — `springEase` evaluates an analytic damped-oscillator step response, so any progress `p` maps deterministically (no numeric integration, no accumulated state).
- **Seek-safe boil** — driven by a GSAP stepped-seed tween on the timeline, never SMIL / render-time clocks.
- **IK-follow via `onUpdate`** — pose the arm from a target whose position is set by the timeline; GSAP fires `onUpdate` on seek, so it's pure-function-of-time.
- Seeded PRNG (`rng`) for all "random-looking" wobble — no runtime `Math.random`.
- No `repeat:-1` (finite counts only), animate only transforms/opacity/attrs.

## ⚠ The font gotcha (the REAL root cause)

Custom handwriting rendered as **serif** in every render for a long time. The cause was **not** SVG-vs-HTML — it was a **font-subset trap**: grabbing one woff2 from the Google Fonts `css2` API (`grep … | head -1`) returns a single *unicode-range subset* (often cyrillic / vietnamese / latin-ext) that is **missing basic-latin (ASCII)**. So every English word silently falls back to serif — while the renderer still logs `Fonts: 1 loaded`. (This means earlier demos whose captions "looked handwritten" were actually serif.)

**Fix (verified):** embed the **full font file** — the TrueType, or a woff2 that actually covers basic-latin:

```html
@font-face { font-family: "InkHand"; src: url("assets/patrickhand.ttf") format("truetype"); font-display: block; }
```

A working Patrick Hand TTF ships at **`ink-theater/assets/patrickhand.ttf`** (SIL Open Font License — the license ships beside it as `assets/OFL.txt`; see `THIRD_PARTY_NOTICES.md`) — copy it into your project's `assets/` and use `font-family: "InkHand"`. It renders real handwriting on normal **HTML overlay `<div>`s** (verified — put caption divs over the SVG scene). Don't hot-link Google Fonts (a render-time network fetch breaks determinism); a local `@font-face` file is auto-inlined by the compiler at build time.

> Note: HyperFrames also pre-bundles ~18 fonts (none are handwriting) — see `hyperframes-creative/references/typography.md`. For handwriting you must embed your own full font as above.

## Usage in a HyperFrames project

1. Copy `ink-theater.js` into the project root; `<script src="ink-theater.js">` after gsap.
2. Build the scene programmatically into a mount `<g>`, keep node refs.
3. Apply `filter="url(#boil)"` to ink groups; call `InkTheater.boil(...)` once.
4. Captions = HTML overlay divs (see gotcha).
5. Register one `gsap.timeline({paused:true})` on `window.__timelines["<id>"]`.

## Ink Puppet — real mocap on a hand-drawn figure (recommended for characters)

The right way to animate a doodle *character* (walk / dance / wave / jump) is **not** hand-tuned math — it is **real motion-capture retargeted onto a stick figure**. An agent should only choose the character and choreograph named moves; it must never hand-tune motion. Two pieces:

- **`mocap/bvh2clip.mjs`** — offline converter: a 3D BVH mocap file → a compact 2D "clip" (per-frame joint tracks, hips-relative pose + root motion, scaled to a fixed figure height). Run once per motion; bundle clips with `clips.js`.
- **`ink-puppet.js`** — runtime: builds the stick figure, plays clips, exposes a **declarative choreography API**:

```js
var p = InkPuppet.create(mount, { cx: 960, ground: 902, boil: "boil" });
p.drawIn(tl, { start: 0.4 });                         // pencil sketches the figure limb-by-limb
InkPuppet.choreograph(tl, p, [                          // then plays named mocap clips — zero hand-tuning
  { clip: "walk" }, { clip: "dance_spin" }, { clip: "kick" }, { clip: "wave" }
], { start: 3.7 });

// speak — comic balloon tethered to the mouth (HTML text = webfont works)
InkTheater.balloon(tl, { into: fxGroup, overlay: htmlOverlay, at: 5, dur: 2, text: "hello!", boil: "boil" });
```

Deterministic + seek-safe (pose is a pure function of each segment's local time).

**The action library (`mocap/catalog.json`)** ships 12 varied moves the agent picks by name — locomotion (`walk`, `run`, `climb`, `march`, `shuffle`), action (`jump`, `kick`), posture (`sit`), gesture (`wave`), dance (`dance_spin`, `dance_glide`, `twist`). Every clip is CMU-sourced (free for any use). **Read the catalog and pick moves that fit the story — don't loop one clip.**

**Extend it in one command** (self-extending, no code changes) — the converter auto-maps fair1 / CMU / Mixamo skeletons:
```
node mocap/add-motion.mjs backflip 05_20 dance "a backflip"   # CMU id, or a URL, or a local .bvh
```
Free **CMU mocap** (`una-dinosauria/cmu-mocap`) has thousands. This is what Meta's *Animated Drawings* does, but here it stays **vector, white-ink, with a draw-on reveal** (AD is raster, humanoid-only, no reveal). Provenance (all clips CMU, free for any use): `mocap/NOTE.md` · `THIRD_PARTY_NOTICES.md`.

## Nib — the recurring character

`InkFigure.attach(pup)` with no options is **Nib**, the one character this
channel repeats. His proportions, palette and line weights are `InkFigure.NIB`
and they do not change between videos. The character sheet — what is fixed, how
to pose him, how to scale a scene off him, and every trap that has cost a render
— is **[`NIB.md`](NIB.md)**. Read it before drawing or posing a character.

Two rig facilities he depends on:

- **`InkPuppet.still(clip, frame)`** registers a one-frame clip so a character
  can stand still mid-shot. Use it instead of `InkPuppet.STAND`, which is
  hand-authored, a different size from the mocap, and visibly shrinks the figure
  when you hold it between segments.
- **Every clip ships with the skeleton's rest pose as its first frame** — arms
  straight out — because that is the first frame of the BVH the converter read.
  `InkPuppet` finds and drops it on first use (measured against each clip's own
  median hand span it stands out by 2x to 11x). Before that fix, a T-pose
  flashed for one frame at the start of every segment: invisible in a snapshot,
  obvious in the render. **Frame indices are numbered on the trimmed clip.**

## Ink Figure — a drawn character on top of the rig (`ink-figure.js`)

InkPuppet gives you motion. What it *draws* from that motion is a wireframe: six
uniform strokes and a circle. That is right for a capability demo and wrong for a
channel, because a wireframe reads as a placeholder however good the motion under
it is. `InkFigure` replaces the drawing and keeps everything else — same rig, same
clips, same seek-safe determinism.

```js
var pup = InkPuppet.create(mount, { cx: 540, ground: 1180, boil: "boil" });
var fig = InkFigure.attach(pup, { headR: 46 });
fig.pencilIn(tl, { start: 0.15, each: 0.34 });   // the rough sketch draws itself
fig.inkIn(tl, { at: 1.95, dur: 0.6 });           // then the ink goes on over it
InkPuppet.choreograph(tl, pup, [ ... ], { start: 6.0 });
```

What it adds: a torso with a silhouette, limbs as tapered brush ribbons (thick at
the shoulder, thin at the wrist), hands and feet that follow the shin, a face on
one side of the head, and a two-stage reveal — pencil under-drawing, then ink.

Five things it gets right that are easy to get wrong:

- **Every part is paper-filled with an ink outline**, like the head. The fill is
  not decoration — it is what lets one limb pass in front of another. Two solid
  shapes overlapping is one black shape, and no amount of motion capture
  survives that.
- **Build the torso along the spine, not through the joints.** A polygon through
  `shL, shR, hipR, hipL` self-intersects the moment the shoulders rotate past
  each other in a walk, and the body pinches into an hourglass. Measuring hip,
  chest and shoulder widths off one axis cannot.
- **The foot takes its angle from the shin and flattens as it plants.** Drawn at
  a fixed angle — the obvious way — the feet skate, and skating feet are the
  loudest tell that a walk is fake.
- **Put the face on one side.** A symmetrical figure has no facing, so flipping
  it to walk back is invisible. The face is the only thing that says which way
  the motion is going.
- **Measure a carry target from the shoulder, not the chest.** See below.

### Carrying something — `fig.carry`

`fig.carry` is four plain numbers the timeline can tween: `on` (0 = pure mocap,
1 = fully posed), `from` (`"shoulder"`, `"chest"` or `"head"`), and `dx, dy`. The
body stays on motion capture; only the near arm is overridden, and only when the
story needs the hand somewhere. This is not hand-authored character motion — the
style rule is about locomotion — it is prop work, and a generic walk cycle swings
an empty arm, so an object riding in that hand reads as swinging loose.

- **Measure from the shoulder.** The twelve clips are not all shot from the same
  angle: `walk` spreads the shoulders 145 units apart, `shuffle` collapses them
  onto the spine. A chest-relative target that is a comfortable bent arm in one
  is past the end of the arm in the other, and FABRIK answers an unreachable
  target by straightening the arm and pointing at it.
- **The clips have mixed handedness.** `shL - shR` averages +145 in `walk`, -27
  in `march`, -105 in `wave`. Whichever chain you nominate as the carrying one,
  check it against the clips you actually sequence.
- **Repose on every carry tween.** A gsap timeline renders its children in
  start-time order, so a per-frame redraw tween at position 0 always draws
  *before* a carry tween at 22.9s has written its values, and the figure comes
  out one render behind its own gesture. Give the carry tweens
  `onUpdate: function () { pup.setPose(fig.pose()); }`.

`InkTheater.inkRibbon` swells in the middle and thins at both ends, which is
right for a drawn line and wrong for a limb. `InkFigure.taper(pts, w0, w1)` is
the one-sided version and is exported for reuse.

### Speech balloons — `InkTheater.balloon(tl, opts)`
Comic balloon that grows from the mouth, with HTML overlay text (so the webfont applies). `opts`: `into` (an SVG `<g>`), `overlay` (an HTML div), `at`, `dur`, `text`, `mouth:[x,y]`, `center:[x,y]`, `w`, `size`, `boil`.

## Demos

- `examples/mocap-figure/` — the pencil figure draws itself, then walks / runs / dances / kicks / sits / waves via **real CMU mocap**. Self-contained and lintable (`npx hyperframes lint ink-theater/examples/mocap-figure`); see `examples/README.md`.
