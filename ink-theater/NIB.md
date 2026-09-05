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
| height | 538 units | crown of the drawn head to the sole of the drawn foot |

That last number is the one to use when sizing anything he stands next to. The
joint span is 515 and using it makes everything in the scene 4% too small.

**The face** is two ink eyes and a nose, all on the **+x side** of the head, plus
a two-stroke cowlick at the back. This is not decoration. A symmetrical figure
has no facing, so a turn — flipping him to walk back — is invisible without it.
White-dot eyes are in the style playbook and are wrong here: on an unfilled head
on white paper they disappear.

**Scale on the page.** Whatever `SCALE` the composition puts him at, everything
else in the scene follows from it:

```js
var MM = (SCALE * 538) / 1750;          // he is 1750mm tall
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
InkPuppet.still("walk", 0);                    // register a standing pose
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
  between segments visibly shrinks him. `still("walk", 0)` is the frame where
  both feet are down, the arms hang and the near arm projects at close to its
  full length.
- **Walking speed** is the clip's own stride length over its own cycle time —
  about `104 px/s` at `SCALE 1.95`. The clips are captured on the spot, so a
  planted foot never slides backwards in the data and some foot slide is
  unavoidable whatever the world does. Matching the stride is the least wrong
  speed available; anything else looks like moonwalking.
- **He cannot travel.** `InkPuppet.place()` rewrites his transform every frame,
  so travel is the world sliding past him. That is the side-scroller solution
  and it also puts everything he walks toward under exact timeline control.

---

## How he uses his hands

`fig.carry` is four plain numbers the timeline can tween:

```js
fig.carry = { on: 0, from: "shoulder", dx: 39, dy: 123 };
```

- `on` — 0 is pure mocap, 1 is fully posed to the target. Tween it.
- `from` — `"shoulder"`, `"chest"`, `"head"`, or `"point"`.
- `dx, dy` — the offset, or with `"point"` an absolute position in his own
  coordinates.

The body stays on motion capture; only the near arm is overridden, and only when
the story needs the hand somewhere. This is not hand-authoring character motion
— the rule is about locomotion — it is prop work, and it is necessary: a generic
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

- `ink-theater/tests/nib-door/` — Nib walks to a door, works the lever and pushes
  it open. A rig test: no narration, no music, no captions. Everything on the
  page is a real measurement, and the door is projected in one-point perspective
  rather than squashed, because seen square on an opening door just looks like a
  narrower door.
- `productions/the-doorway-did-it/` — the first video he is in.
