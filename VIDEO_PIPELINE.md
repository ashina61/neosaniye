# The pipeline

```
SCRIPT → STORYBOARD → SCENE PLAN → ASSETS → MOTION → RENDER → QA → FINAL
```

Every arrow is a command. Every box is a file you can open and read. Nothing in
the chain guesses what an earlier box meant.

---

## 0. New episode

```bash
npm run new -- --id=<id> --title="…" --mood=<mood>
```

Writes `episodes/<id>/` with a brief template, a cut and placeholders. A valid
episode exists from the first second; then you write the six lines and the rest
is derived.

Moods: `gold-heat` · `cold-noir` · `green-rot` · … (see `MOODS` in
`scripts/plan-episode.mjs`). A mood is a set of **bounds**, never a finished
look — a menu of palettes gives ten episodes that are one of five things.

---

## 1. SCRIPT — `episodes/<id>/brief.json`

The only part a person should be writing. Per line:

```jsonc
{
  "slug": "wreck",
  "vo": "In 1901 sponge divers off Antikythera found a wreck full of bronze.",
  "image": "dark green water over a rocky seabed",
  "pieces": ["a diver's lamp", "a bronze arm"],
  "shot": {
    "template": "composite",
    "signature": "the camera sinks — we open on black water and the seabed arrives under us",
    "camera": {"from": 1.5, "to": 1.0, "focus": "hunt"},
    "anchor": [0.5, 0.4],
    "layers": [{"role": "sea", "asset": "seabed.jpg", "depth": 0.16, "kind": "backdrop"}],
    "props":  [{"kind": "plaque", "text": "Antikythera · 1901", "size": 0.4, "x": 0.5, "y": 0.82, "at": 0.45}]
  }
}
```

**Fractions in, pixels out.** A director says "eight tenths of the frame, just
left of centre, a third of the way in"; only the compiler should care that the
frame is 1080×1920.

**What the brief writes is never overruled.** The planner and the director only
fill in what nobody wrote. A written `camera.from`/`camera.to` is the move; the
director still adds the roll, the handheld breath and the impact around it,
because a written push says nothing about those and they were previously set by
nothing at all.

`npm run write -- --episode=<id>` holds the brief to its rules and refuses one
that hands over six photographs and calls it an episode.

---

## 2. STORYBOARD — the voice is the clock

```bash
npm run voice -- --episode=<id> [--measure]
```

**Zeroth law: the audio is the clock.** Scene durations are *measured* from the
line boundaries inside the mp3, never estimated. Speaking and measuring are two
separate steps — speaking belongs to a provider, measuring belongs to
`scripts/lib/measure.mjs` and works on anything.

Writes `audio/vo.{mp3,wav}` and `audio/vo.json`. **Both are committed.** The
render does a fresh checkout and the config names the audio; if the file is not
there, validation fails.

With no `vo.json`, durations are estimated at `words / 2.7 * 30` and the run
says so out loud. A reel cut to an estimate is a draft and must never quietly
look finished.

---

## 2b. THE DECISION LAYER — story, assets, art direction

Between the script and the animation sit four judgements the pipeline used to
skip. They run inside `npm run plan`, before a single coordinate is derived.

**The Story Brain** (`scripts/lib/story.mjs`) reads each line as an editorial
beat — HOOK · CONTEXT · DISCOVERY · EVIDENCE · DETAIL · ESCALATION · REVEAL ·
COMPARISON · MYSTERY · PAYOFF · VERDICT — and writes down the visual idea and
what the viewer must notice. A hook and a verdict are not the same object with
different words in them, and until something says which is which the middle of
every reel is identical.

**The Asset Director** (`scripts/lib/assetdirector.mjs`) scores every picture
against the ROLE it plays, on ten axes. Five are measured from the file
(resolution, exposure, contrast, how much survives a 9:16 crop, whether there is
enough structure to push into); five are semantic and live in a reviewed ledger,
`episodes/<id>/assets.review.json`, because whether a cabinet is a MUSEUM
cabinet is not in the histogram.

**Semantics gate the score.** A beautifully exposed, perfectly croppable
photograph of the wrong thing is not a 7 — it is unusable, and averaging it with
five green technical axes is exactly how a Victorian sideboard shipped as museum
storage. Four verdicts:

| verdict | what happens |
| --- | --- |
| `use` | it goes in |
| `warn` | it goes in and the run says why it is weak, every time |
| *(gate)* | **below 8 on relevance or historical accuracy it is refused outright** — no arrangement of green technical axes carries a picture of the wrong thing into a documentary |
| `recast` | it is moved to the role — or the line — it actually illustrates |
| `reject` | it is removed, and an `ASSET_REQUIRED` brief is written |

A refusal is a **result**. The line becomes a typographic shot on a drawn field
rather than a wrong photograph with motion on it.

```bash
npm run assets:audit -- --episode=<id>              # score everything
npm run assets:audit -- --episode=<id> --template   # write a review skeleton
```

**The Representation Director** (`scripts/lib/representation.mjs`) asks the
question that comes before composition: *what is the most truthful and visually
effective way to show this?* It works down a ladder — the exact real asset, a
high-confidence alternative, a generated visual, a procedural reconstruction, a
diagram, designed typography, an intentional abstract — and returns one of
`PHOTO` · `HYBRID` · `PROCEDURAL` · `DIAGRAM` · `TYPOGRAPHY` with the drawing to
build.

Rungs four and five are **not consolation prizes**. A mechanism with a count
becomes a gear train that actually meshes, because meshing is the claim and no
photograph shows it. A span of empty years becomes a timeline, because a gap is
the one thing a photograph of a cupboard cannot contain.

**The Procedural Visual Library** (`engine/draw/Diagram.tsx`) draws them, from
data rather than markup:

| `diagram.type` | what it draws |
| --- | --- |
| `gearSystem` | a meshing train — each wheel turns because the driven one does, at the inverse of their tooth counts. Optional count that lands on the wheels. |
| `timeline` | dates, and the hatched years between them where nothing happened |
| `measurement` | a bar, a counted figure, and something to measure it against |
| `orbit` | a path clamped inside the frame, a body travelling it, the alignment marked |
| `scan` | a bar travelling down the frame — the act of looking inside |

Three rules keep them from being clipart: they are **engineering drawings**
(line weights derived from the frame, mono annotation, registration ticks, one
accent and one muted tone); they **draw themselves** rather than fading up; and
anything reconstructed **carries a plate saying so** — `SCHEMATIC
RECONSTRUCTION · NOT TO SCALE`. A drawing presented as a record is a worse lie
than a wrong photograph, because it is one the viewer cannot check.

**The Visual Director** (`scripts/lib/visual.mjs`) states PRIMARY / SECONDARY /
BACKGROUND for every shot, picks a framing under a quota so a reel is not twelve
centred medium shots, and holds type to four semantic roles — statement, body,
label, figure.

**The Camera and Transition Directors** (`scripts/lib/director.mjs`) choose from
what the beat is doing and then answer to a quota counted across the whole reel:
no camera family over ~30%, no transition over ~25%, nothing that blanks the
frame on a short shot, and no arrival allowed to eat more than an eighth of the
shot it opens.

Every judgement is written to `episodes/<id>/director-report.json`.

---

## 3. SCENE PLAN — `episodes/<id>/scene-config.json`

```bash
npm run plan -- --episode=<id>
```

Compiles brief + measurement into the episode's single source of truth. Four
things happen, in order:

**A sentence is not a shot.** It is split at its clauses, and a clause with no
comma in it is split anyway — `MAX_SPOKEN` is 2.9 seconds and it is now
*enforced*. It used to be aspirational: a sentence with no comma came through
whole however long it was, so five of six lines became single 4.5-second shots
whose only event was the picture getting 13% bigger.

**A measured window is divided by word weight**, and the remainder goes to the
*last* fragment, so the sum is exactly the window and the reel never drifts out
of sync with its own narration.

**The words decide the shot.** A line with a number becomes a slate with that
number set large; a line listing three things becomes three pieces of paper
landing; a line naming an object becomes a push into it.

**The director schedules it** (`scripts/lib/director.mjs`) — see
[MOTION_SYSTEM.md](MOTION_SYSTEM.md). Event budget, beat times, emphasis word,
camera move, text reveal, and fillers for a shot that would otherwise do
nothing.

The run prints the whole plan: shots per line, templates, durations, motifs, and
which asset files each line still needs.

---

## 4. ASSETS — `episodes/<id>/assets/`

Production is a **separate step** and the render never calls a generator; it
reads a file off disk.

```bash
npm run assets:generate -- --episode=<id>    # draw from episodes/<id>/assets.json
npm run assets:commons  -- --episode=<id>    # fetch from Wikimedia Commons
npm run assets:placeholder -- --episode=<id> # stand-ins, so the reel renders today
npm run assets:review   -- --episode=<id>    # cut-outs on a checkerboard
```

Recipes live in `episodes/<id>/assets.json` — a prompt is the episode's business
exactly as a file name is. Same name, same seed, so re-running brings back the
same picture.

The separation is the point: if a generator breaks, the *generation* step fails
and a finished episode does not silently change.

An asset written `"?character"` is **optional** — used if it is on disk, quietly
dropped if it is not. A scene that wants a figure is worth less without one, but
making the figure mandatory stops the whole reel on the day the artwork is late.

---

## 5. MOTION — `engine/`

Nothing to run. The config is read by `engine/Root.tsx` (which takes fps, size
and duration from it via `calculateMetadata`), laid out by `engine/Episode.tsx`,
and drawn by the seven shared templates.

`engine/` never learns a file name, an episode id, or a story.
`test/enginePurity.test.mjs` fails the build on any of the three.

---

## 6. RENDER

```bash
npm run render -- --episode=<id> [--out=path.mp4] [--crf=18]
```

Remotion's public directory is pointed at the **episode folder**, so
`assets/foo.png` in a config means that episode's file and no asset is ever
copied or renamed to be rendered.

`REMOTION_BROWSER_EXECUTABLE` is honoured — CI images ship their own Chromium
and should not be made to download one.

---

## 7. QA — three checks, three costs

```bash
npm run validate  [-- --episode=<id>] [--strict]         # ~3s
npm test                                                  # ~6s
npm run frames -- --episode=<id> --at=0,0.33,0.66,0.94    # ~1 min
```

**`validate`** answers five different questions.

*Will it render* — schema, scene types, every asset on disk and non-empty, audio
present. This exists to fail in three seconds instead of three minutes.

*Is there anything in it* — `scripts/lib/critique.mjs`. Every reel this pipeline
ever shipped passed the first question: the schema was right, the files were
there, the durations summed, and the video was seven photographs being slowly
scaled. So the second half looks for shots where nothing happens, events
scheduled after the cut, captions outside the safe area, one-layer composites,
emphasis words that are not in their caption, and devices used three shots
running.

*Was anything decided* — `critiqueDirection` and `qualityGates`, reading the
director's log. A picture still in the cut with a failing score, a hook resting
on a weak plate, a verdict split across two shots, a graphic repeating the
narration, a device carrying the reel, two shots of one plate with the same
framing and the same move. It ends in seven scores, and a reel below 7 on any of
them is reported NOT PRODUCTION READY with the failing axis named:

```
gates   assetRelevance 7.6 · visualHierarchy 10 · motionDesign 7.8 ·
        cameraDiversity 8.6 · transitionQuality 9.1 · visualContinuity 10 ·
        professionalism 8.7
```

*Is it coherent at every frame* — `scripts/lib/temporal.mjs`. Everything above
judges a shot as an arrangement; this walks it as a sequence of states and
asserts the ones that can be wrong: a reel showing two values, a counter that
never reaches the figure it claims, wheels that do not touch, a ring around
empty sky, a timeline out of order. The slot reel's double-value frame passed
every other check because every other check looks at a shot once, and a contact
sheet takes four stills out of sixty.

*Is it a reel, or ten shots in a row* — `scripts/lib/editor.mjs`. "Slideshow" is
not a property any shot has; it only exists between shots. Shots are reduced to
a signature and compared; the spread of their lengths is measured; events are
counted per shot rather than averaged, at both ends (a dead shot and a shot
where four things land together are both failures); and a caption is checked
against the time it is actually on screen.

```
edit    rhythm 0.41 (1.13–4.53s) · image changes 33% of cuts ·
        busiest moment 2 event(s)
```

**Errors** fail the run and are things that cannot be intended — a caption at
frame 69 of a 58-frame shot, a four-second shot with no events at all.
**Warnings** print every run and are usually-wrong-occasionally-deliberate — a
held shot, a long closing card. `--strict` promotes warnings to errors — worth
running on a single episode you are finishing (`npm run validate --
--episode=<id> --strict`), and worth putting in CI once the repo has no
warnings left. It is not in CI today: `zodiac-1969` was hand-authored before the
director existed and still carries the holds the director would have broken up,
and `test-episode` is an eight-second fixture rather than a short.

Each run also prints the shape of the reel:

```
motion  33 event(s), 1.26/s, 2.18s per shot
```

**`frames`** is the one that catches what neither of the others can. Every
visual defect this repo has actually shipped — the frame darkened four times
over, glow sliding off the lamp it was lighting, cards burying each other,
"THIRTY GEARS" with its S through the edge of the frame — passed validation,
passed the tests, and was obvious in one still. More than one still per shot is
not optional for anything that moves: a motif that piles up, a route that draws
itself and a count that climbs all look like nothing at all in a single frame.

Sample `--at=0,0.33,0.66,0.94` rather than `--per`. Even spacing never sees
frame zero, and half of what has shipped broken lived exactly there: a
transition opening on black, a caption that has not arrived, a white ball of
light hanging in an empty sky, a mechanism that is still four disconnected arcs
of debris when the cut lands on it. `--keep` leaves the individual stills
behind; the grid is an overview, not an inspection.

---

## 8. FINAL — the loop, not the render

A successful render is not a successful video.

1. `plan` → `validate` → read the warnings
2. `frames --at=0,0.33,0.66,0.94 --keep` → **look at it**
3. fix
4. back to 1
5. `render` only when the contact sheet reads as designed

The bar is not "it renders" and not "it typechecks". It is: *would this look
like a professional motion-design short?* If the answer is "technically correct
but visually basic", it is not finished.

---

## Automation — `.github/workflows/reel.yml`

One workflow, because it is one chain: refreshing the voice changes the cut, and
the cut changes the scene ids the artwork is keyed to.

- **push / PR** → the cheap gate (`check`): typecheck, tests, validate.
- **Run workflow** → the factory (`make`): voice → assets → render, each step
  switchable.
