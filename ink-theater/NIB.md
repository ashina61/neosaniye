# Nib — the character sheet

Nib is the one thing this channel repeats. Everything else rotates by rule —
the world, the palette, the signature device, the layout, the motion character,
all of it is in `productions/STYLE_LEDGER.md` as a list of things that may not
happen twice. Nib is the deliberate exception, and he is exactly one exception.
If a second recurring element appears, the ledger has failed.

**He is not redrawn per video.** He lives in `ink-theater/ink-figure.js`. A
composition attaches him and does not override him:

```js
var pup = InkPuppet.create(mount, { cx: CX, ground: GROUND, boil: "boil" });
var fig = InkFigure.attach(pup);        // no options: this IS the character
```

Passing options to `attach()` makes a different character. Don't, unless the
brief is explicitly "a second character".

---

## What he is

A person, drawn as a doodle: paper-filled shapes with an ink outline, one weight
of line, live boil on everything. Not a stick figure and not a mascot. Deadpan.
Never cute, never mugging, no eyebrows, no mouth.

The proportions are in `InkFigure.NIB` and they are the character. A viewer
recognises a figure by its proportions long before its face.

| | value | what it is |
|---|---|---|
| head | `headR: 46` | radius. He is about 5.4 heads tall — real, not cartoon |
| ink | `#333333` | never pure black |
| paper | `#FCFBF8` | warm white; also the fill inside every part of him |
| pencil | `#BDB7AA` | the under-drawing, rubbed out once the ink is on |
| arm | `30 → 19` | shoulder to wrist |
| leg | `40 → 22` | hip to ankle |
| body line | `7` | torso, neck, head outline |
| limb line | `6` | arms, legs, feet, hands |
| torso | `1.06 / 0.90 / 0.86` | hip / chest / shoulder, × the pose's own spans |
| hand | `12` | a paper circle with an ink outline — a mitten, not fingers |
| depth | `11` | how far behind the near side the far arm and leg are drawn |
| height | 534 units | crown of the drawn head to the sole of the drawn foot |

That last number is the one to use when sizing anything he stands next to. The
joint span is 515 and using it makes everything in the scene 4% too small.

`depth` is not a detail. The clips are side-on, so the two arms project onto
each other almost exactly and read as one thick arm with two hands on the end of
it. Every 2D animator offsets the far limbs backwards a little for exactly this
reason.

**The face** is two ink eyes and a nose, all on the **+x side** of the head, plus
a two-stroke cowlick at the back. This is not decoration. A symmetrical figure
has no facing, so a turn — flipping him to walk back — is invisible without it.
White-dot eyes are in the style playbook and are wrong here: on an unfilled head
on white paper they disappear.

**Scale on the page.** Whatever `SCALE` the composition puts him at, everything
else in the scene follows from it:

```js
var MM = (SCALE * 534) / 1750;          // he is 1750mm tall
function mm(v) { return v * MM; }       // now draw the world in millimetres
```

A door is 2030 × 820, its handle is 1050 off the floor, a skirting board is
100 high. Look the number up; don't eyeball it. This is what "gerçeğe yakın"
actually costs, and it costs nothing.

---

## How he moves

**Never hand-authored.** Every movement is a real motion-capture clip from
`ink-theater/mocap/catalog.json`, retargeted onto the rig. No sine curves, no
hand-posed frames, no tweened limbs. A hand-tuned walk cycle is the tell that
separates a doodle that moves from a doodle that is alive.

```js
InkPuppet.still("shuffle", 34);                // register a standing pose
InkPuppet.choreograph(tl, pup, [
  { clip: "walk",  dur: 4.00 },
  { clip: "still", dur: 3.10 },
  { clip: "walk",  dur: 4.20 }
], { start: 3.10 });
```

- **Never loop one clip through a piece.** Varying the moves is what stops
  character work feeling repetitive.
- **`loop: false`** holds a segment's last frame. Needed whenever a segment is
  longer than its clip.
- **Standing still** is `InkPuppet.still(clip, frame)`, never `InkPuppet.STAND`.
  STAND is hand-authored and a different size from the mocap, so holding it
  between segments visibly shrinks him. `still("shuffle", 34)` is the frame
  where both feet are flat, the arms hang and the arm projects at close to its
  full length — which is what makes a reach possible at all.
- **He cannot travel.** `InkPuppet.place()` rewrites his transform every frame,
  so travel is the world sliding past him.

### Never pick a walking speed

Slide the world by `pup.travel * SCALE` and the question does not arise:

```js
function worldX() { return WORLD0 - pup.travel * SCALE; }
// ...every frame:
world.setAttribute("transform", "translate(" + worldX().toFixed(2) + ",0)");
```

`pup.travel` is how far the choreography has actually walked, taken from the
capture. Planted-foot slip per frame is **1.2px** doing this and **13.0px**
with any chosen speed, because a chosen speed is only right at one instant of
the stride. `InkPuppet.travel(clip, seconds)` answers the same question ahead of
time, so a layout can be solved backwards from the acting — "the handle has to
be under his hand when the walk ends" becomes arithmetic instead of a guess.

Two things this fixed, and they are worth knowing because they were invisible
for four videos:

- **The clips were projected front on.** `bvh2clip.mjs` used to project onto
  world X whatever direction the subject actually walked in. CMU subjects walk
  in whatever direction their capture was set up in, so `walk` came out with the
  shoulders 145 units apart and a **30-unit stride on a 538-unit figure** — a
  man marching on the spot, seen from the front. It now projects onto the
  direction the motion travels, and the stride is 438 units: 0.84 of his own
  height, which is what a stride is.
- **Every clip opened with the skeleton's rest pose.** A T-pose flashed for one
  frame at the start of every segment — six times in the fourth video. One frame
  at 30fps never shows up in a snapshot. `InkPuppet` finds it (frame 0's hand
  span is 2x to 11x the clip's median) and drops it on first use. **Frame
  indices are numbered on the trimmed clip.**

---

## How he uses his hands

`fig.carry` drives the near arm and `fig.hold` the far one. Two hands is not a
luxury: you hold the bag in one and turn the handle with the other, and a
character that has to put its only prop down before it can touch anything is a
character that cannot act. Both are four plain numbers the timeline can tween:

```js
fig.carry = { on: 0, from: "shoulder", dx: 39, dy: 123 };   // near arm
fig.hold  = { on: 0, from: "shoulder", dx: 39, dy: 123 };   // far arm
```

- `on` — 0 is pure mocap, 1 is fully posed to the target. Tween it.
- `from` — `"shoulder"`, `"chest"`, `"head"`, or `"point"`.
- `dx, dy` — the offset, or with `"point"` an absolute position in his own
  coordinates.

The body stays on motion capture; only the arms are overridden, and only when
the story needs a hand somewhere. This is not hand-authoring character motion —
the rule is about locomotion — it is prop work, and it is necessary: a generic
walk cycle swings an empty arm, so an object riding in that hand reads as
swinging loose rather than being carried.

**Holding something that moves on its own** — a door handle, a crank, a rung —
uses `from: "point"` and `InkFigure.toPose()`, per frame:

```js
var p = InkFigure.toPose(pup, handleScreenX, handleScreenY,
                         { scale: SCALE, aboutX: CX, aboutY: GROUND });
fig.carry.from = "point"; fig.carry.dx = p[0]; fig.carry.dy = p[1];
```

`pup.originY` changes every frame — it carries the clip's ground and the pose's
rootY — so this is recomputed per frame, never once.

---

## The traps

Every one of these cost a render to find. None of them is visible in a still.

1. **Measure a reach from the shoulder, not the chest.** The clips are not all
   shot from the same angle: `walk` spreads the shoulders 145 units apart,
   `shuffle` collapses them onto the spine. A chest-relative target that is a
   comfortable bent arm in one is past the end of the arm in the other, and
   FABRIK answers an unreachable target by straightening the arm and pointing
   at it — which is how one video shipped with a black bar laid across the
   character's chest.

2. **The clips have mixed handedness.** `shL - shR` averages +145 in `walk`,
   −27 in `march`, −105 in `wave`. `InkFigure` treats the L chain as the near,
   carrying side. Check it against the clips you actually sequence.

3. **Redraw from the tweens that move the data.** A gsap timeline renders its
   children in start-time order, so a per-frame redraw tween at position 0
   always runs *before* a carry tween at 22.9s has written its values, and the
   figure comes out one render behind its own gesture. Give every tween that
   moves him `onUpdate: function () { pup.setPose(fig.pose()); }`.

4. **`svgOrigin`, not `transformOrigin`.** GSAP needs user units on an SVG `<g>`.
   Getting it wrong throws him off the page and every still still looks fine.

5. **A prop parented to his hand needs `pup.setPose()`, not `fig.redraw()`.**
   `redraw()` only repaints the figure.

6. **The actor is usually inside a scale group.** His own hand height and his
   hand height on the page are different numbers. Anything outside him that has
   to meet his hand — a barrier arm, a handle — must be solved in page
   coordinates, or the two miss each other by 200px and nobody notices because
   the prop is swapped for a falling copy two frames later.

7. **Sample the finished file.** A 1fps strip out of the rendered mp4. The three
   worst defects so far were all invisible in stills.

---

## Cutting

He can be in more than one place. A cut is two world groups and a swap:

- **Land it on the action, inside one movement.** One continuous walk segment
  spanning both scenes, cut mid-stride, so the legs carry through it and the
  audience reads a camera move rather than a jump.
- **Do not cross the line.** If he walks right in scene A he walks right in
  scene B. Cutting to "the same door seen from the other side" swaps left and
  right and turns him round. Cut ninety degrees instead — a different wall of
  the room, with the door he came through seen almost edge-on in the corner.
- **Move the camera as well as the set.** A few percent of scale on the camera
  group says a camera moved. Without it a cut can read as the wall having
  changed behind a man standing still.
- **Give the new place something to say in its first second.** He walks about
  850px a second; two seconds of blank wall between the doorway and the first
  object is two seconds of nothing.

## What may change between videos

The world he is in, what he is doing, what he is holding, the palette around
him, the camera. Not his proportions, not his face, not his line weights, not
where his motion comes from.

If a video needs him to do something he cannot do yet, the answer is a new
capability in `ink-figure.js` or a new clip in the mocap library
(`node ink-theater/mocap/add-motion.mjs <name> <cmu-id> <category> "<desc>"`) —
not a bespoke redraw inside one video's HTML.

---

## Reference builds

- `ink-theater/tests/nib-corridor/` — **the reference build.** Corridor, toolbox,
  lever, door, cut, room, bench. Everything above is demonstrated in it.
- `productions/the-doorway-did-it/` — the first video he is in. Note that it was
  made against the old front-on clips and does not use root motion, so its
  committed mp4 no longer reproduces from its source. Rebuilding it on the
  current rig means re-solving its geometry, because every number in it was
  fitted to shoulders 145 units apart.
