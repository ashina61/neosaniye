# Adem — the character sheet

Adem is the one thing this channel repeats. Everything else rotates by rule —
the world, the palette, the signature device, the layout, the motion character,
all of it is in `productions/STYLE_LEDGER.md` as a list of things that may not
happen twice. Adem is the deliberate exception, and he is exactly one exception.
If a second recurring element appears, the ledger has failed.

**He is not redrawn per video.** He lives in `ink-theater/ink-figure.js`. A
composition attaches him and does not override him:

```js
var pup = InkPuppet.create(mount, { cx: CX, ground: GROUND, boil: "boil" });
var fig = InkFigure.attach(pup, { unit: SCALE });   // this IS the character
```

Passing options to `attach()` makes a different character. Don't, unless the
brief is explicitly "a second character".

---

## What he is

A young man in a plain t-shirt and straight trousers, drawn as clean line art:
paper-filled shapes with an ink outline, one weight of line, live boil on
everything. Real proportions — about **6.7 heads**, not a cartoon five — and
**exactly one solid mass on the whole figure: his hair.** Everything else is
line. A drawing with one dark shape in it has a place for the eye to land, and
that shape is what you recognise from across a room.

The numbers are in `InkFigure.ADEM` and they are the character. A viewer
recognises a figure by its proportions long before its face.

| | value | what it is |
|---|---|---|
| head | `headR: 40` | radius |
| height | **534 units** | crown of the drawn head to the sole of the drawn shoe |
| ink | `#333333` | never pure black |
| paper | `#FCFBF8` | warm white; also the fill inside every part of him |
| arm | `27 → 17` | shoulder to wrist |
| leg | `38 → 21` | hip to ankle |
| body / limb / seam / face | `5.4 / 4.4 / 3.6 / 3.8` | **page pixels** — see below |
| torso | floors `98 / 116 / 106` | hip / chest / shoulder |
| hand | `11` | a paper circle with an ink outline |
| depth | `10` | how far behind the near side the far arm and leg are drawn |

`height` is the number to use when sizing anything he stands next to. The joint
span is 515 and using it makes everything in the scene 4% too small.

`depth` is not a detail. The clips are side-on, so the two arms project onto
each other almost exactly and read as one thick arm with two hands on the end of
it. Every 2D animator offsets the far limbs backwards a little for this reason.

### Line weight — pass `unit`

```js
var fig = InkFigure.attach(pup, { unit: SCALE });   // the only option you pass
```

Weights are in **page pixels**. He lives inside a scale group — the mocap
skeleton is about 490 units tall and a portrait frame wants more — so without
`unit` every line on him renders at SCALE times the weight of the set he is
standing in, and he looks pasted on. This is the one option that is not a
different character.

---

## The look

| | what it is | why |
|---|---|---|
| **hair** | a solid ink band over the skull: a fringe swept up at the front, tapering to nothing at the nape | the silhouette, and the only filled shape on him |
| **t-shirt** | crew neck, two sleeve hems across the upper arms, a hem at the hip | five strokes and the body stops being a shape |
| **trousers** | straight, one pocket line on the near hip | |
| **sneakers** | a low upper with a midsole line under it | |
| **face** | two eyes, two brows, a small nose, a small mouth — all on the **+x side**, all **inside** the head | a symmetrical figure has no facing; without it a turn is invisible |

**No colour.** The palette carries meaning — orange is flow, red is the problem,
blue is the resolution — and a character wearing one of those would be lying.
His identity is shape, which is also what survives at thumbnail size.

`fig.face.brow` tilts the brows a few units. Flat at 0. It is the only thing on
him that moves.

### Two ways the drawing came out wrong

Both were rendered before they were right, and both are the same mistake —
describing a shape as a formula instead of stating the shape:

1. **A single outline that goes out along a shape and comes back.** Catmull-Rom
   through a direction reversal loops. An earlier design's cap peak came out as
   a thin hook four separate times. The hair works because it is a **band** —
   an outer edge and an inner edge — which cannot self-intersect.
2. **Face offsets left over from a bigger head.** They were written for a 46
   radius; at 40 the nose and mouth hang off the side of his face like whiskers.
   Anything positioned on the head has to be re-checked against `headR`.

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

**Give him something to hold.** A character standing with both arms hanging is
a character doing nothing, and "the motion character is stillness" does not
license it — stillness means a body that does not travel, not a man who never
moves. In `the-second-that-hangs` he waits in a queue holding his paper number,
and the near arm picks it up and reads it three times across the film. One prop
and three reaches turned forty-eight seconds of standing into a performance,
and the prop also explains why he keeps looking at the clock.

A prop lives in **pose units** inside `pup.ink`, appended *after* the figure
group so it paints on top, and is hung off `fig.hand()` from `sync()`:

```js
var cardG = document.createElementNS(NS, "g");
pup.ink.appendChild(cardG);                 // after fig's group = in front
function paintCard() {
  var h = fig.hand();
  cardG.setAttribute("transform", "translate(" + h[0] + "," + (h[1] + card.lift) +
                                  ") rotate(" + card.tilt + ")");
}
```

Its stroke widths divide by `SCALE` exactly like the figure's, and it is inside
the flip group, so a turn takes the prop with it. `card.lift` and `card.tilt`
are plain numbers the timeline tweens alongside `fig.carry`, which is what makes
a hand *pick something up* rather than teleport it.

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

## The frame he is standing in

He is only ever seen on Shorts / Reels / TikTok, and those interfaces eat the
picture. On a 1080×1920 frame:

| band | what owns it |
|---|---|
| y > ~1450 | the title, the handle, the description, the scrubber |
| x > ~900, y 950–1560 | the like / comment / share rail |
| y 200–1400 | **yours** |

`the-second-that-hangs` shipped its first cut with the captions at **y=1660**
and not one line of the film could be read. The rule that came out of it:

- **caption band 1250–1400**, and never below 1400
- **his feet on the floor at about y=1130**, which leaves the caption band clear
  page under him
- at `SCALE ≈ 1.42` he is 758px tall, which is 39% of the frame — a full figure
  with a room around him, and still readable at thumbnail size
- nothing that carries meaning goes into the button rail

Work the scale backwards from the caption band, not from how big he looks.

## Dressing a place

"A room" is not a floor line and one object. The first cut of
`the-second-that-hangs` had a ground line, a skirting, a chair and the clock,
and the note that came back was *arkaplan sahneler hiç bişey yok* — and it was
right. **About ten objects**, and because `mm()` exists they cost nothing but
the looking-up:

> a window 860 × 1400 with its sill at 900 and a roller blind a third down · a
> linked bench of three 420 seats at 450 · a newspaper somebody left on it · a
> bin · a notice nobody reads · a pendant lamp on a cord from the top edge · a
> 300 clock at 1900 · a 100 skirting · the corner where the room turns, just
> inside the frame · two joints in the floor

Three things that go wrong, all of them invisible until it is rendered:

1. **Aligned edges fuse.** A bench's back rail landed at the window sill's
   height and the two became one continuous counter — which turned the bench
   under it into base units, and the waiting room into a kitchen. A dado rail
   at exactly the sill height did the same thing. Offset the heights, offset
   the ends, and if two horizontals want the same y, delete one.
2. **A filled panel between two rails is a cupboard door.** Bench backs are
   **open slats on posts**; you should see the wall through the furniture.
3. **Put the lamp over his head, not next to the clock.** One object directly
   above him anchors the composition and stops the wall being a field of
   scattered things.

Draw the whole set in about 1.4 seconds with a stagger —
`SET.forEach(function (e, i) { drawOn(e, 0.05 + i * 0.052, 0.34); })` — then the
hero object, then him. The page building itself fast is half the charm.

## Big close-ups of him

He has a face, and at 40px of head radius nobody can see it. A **macro of his
eyes** is a legitimate third setup and it is often the shot the film actually
needs — `the-second-that-hangs` spent six seconds on a clock face under the
sentence *your eyes do not glide, they jump*, which is describing the subject
over a picture of something else.

Build it from his own vocabulary, at about 8× :

- **the fringe** — a filled ink band across the top with a swept lower edge, and
  two or three strands hanging. This is what makes the crop read as *him*.
  **Keep it shallow** (bottom edge around y 150–260 on a 1920 frame): at half
  the frame it stops being a silhouette and becomes a black bar, and every
  camera push crops it into a stripe.
- **flat brows.** A brow that rises toward the nose is a scowl. His are flat.
- **almond eyes**, paper fill and ink outline, with an upper-lid crease and a
  DIM under-eye line — without the under-eye line the features float and it
  reads as a mask rather than a face.
- **a nose that ends.** Two bridge lines that run off the bottom of the crop are
  a beard; give it a tip curve and two nostril dashes.
- **both irises in one group.** Eyes move together, always.

And when they move, **`tl.set`, never a tween** — a saccade is ballistic, and a
tweened eye is the one thing the shot exists to disprove.

## Mist, and revealing a place

A door you have not walked through yet is the whole point of a door. So what is
behind it is **not drawn**: a soft pale suggestion — a window's worth of light,
something hanging, an edge — under a constant `feGaussianBlur`, blurred past
reading, and it never resolves. Then the cut, and the new room comes out of the
haze around him.

Three layers, and the order matters:

```
<g id="worldA" filter="url(#boil)"/>                     the place he is leaving
<g filter="url(#hazeNear)"><g id="worldB" filter="url(#boil)"/></g>
<rect id="veil" fill="paper" opacity="0"/>               over the world
<g id="actorScale">…</g>                                 HE IS ALWAYS SHARP
<g id="mist" filter="url(#wisp)"/>                       a few wisps in front
```

- The veil and the blur are **under the actor**, so the man is in focus and the
  place he has walked into has not decided what it is yet. That is the shot.
- Blur is animated by writing `stdDeviation` from a tween's `onUpdate` — a
  proxy number, so it stays deterministic and seek-safe.
- The veil goes 0.92 → 0 over about 1.7s and the blur 15 → 0 over 1.9s, both
  `power2.out`. It takes about as long as his eyes would.
- The wisps are the only things in the piece that are not a line: pale, wide,
  blurred, drifting the way he is walking, and gone in two seconds.
- Keep the boil filter on the world underneath the haze wrapper. Replacing it
  loses the hand-drawn wobble on the whole room.

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
- **Hide the cut inside the device.** If the piece has a moment where the page
  is already empty — a blank, a flash, a wipe — put the cut there. Six of
  `the-second-that-hangs`'s eleven cuts land inside a two-frame blank, so the
  audience reads a look rather than an edit, and the film's own idea is doing
  the editing.
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

- `ink-theater/tests/adem-corridor/` — **the reference build.** Corridor, a case,
  lever, door, cut, room, bench. Everything above is demonstrated in it.
- `productions/the-doorway-did-it/` — the first video he is in. Note that it was
  made against the old front-on clips and does not use root motion, so its
  committed mp4 no longer reproduces from its source. Rebuilding it on the
  current rig means re-solving its geometry, because every number in it was
  fitted to shoulders 145 units apart.
