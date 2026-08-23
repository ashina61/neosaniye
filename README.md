# crime-reels

Vertical crime-documentary reels — **one shared engine, many episodes**.
1080×1920, 30fps, rendered headlessly with Remotion.

Adding an episode is adding a folder. Nothing in `engine/` ever learns a file
name, an episode id, or a story.

```
engine/                     shared code — knows roles and numbers, never assets
  motion.ts                 posterize · boil · spring · punch · shake · wipe · count
  Camera.ts                 one virtual camera per shot; layers take their share by depth
  FilmLook.tsx              grain · grunge · scanlines · vignette · gate weave · grade
  Plate.tsx                 one flat image layer (full-bleed, or a sized subject)
  OnScreenText.tsx          scene-relative text
  Episode.tsx               the timeline
  Root.tsx                  the composition (size and duration come from config)
  schema.mjs / schema.ts    the contract: one runtime, one set of types
  draw/                     drawn graphics: light, paper, marks, motifs, overlays
    Kinetic.tsx             word-level reveals, the emphasis word, the counter
  sceneTypes/               the seven shared templates + registry

episodes/<episode-id>/
  scene-config.json         the episode's only source of truth
  assets/                   its images
  scenes/index.tsx          OPTIONAL — templates only this episode uses

scripts/
  plan-episode.mjs          brief → scene-config
  lib/story.mjs             WHAT each line is: beat, visual idea, rhythm, ending
  lib/assetdirector.mjs     WHETHER a picture may be used — score, recast, refuse
  lib/visual.mjs            hierarchy, framing, one type system
  lib/director.mjs          WHEN things happen: beats, camera, transitions, quotas
  lib/critique.mjs          the checks that can see a boring reel
test/                       engine-purity guard, schema, registry, episodes, director

MOTION_SYSTEM.md            the design language — what moves and why
VIDEO_PIPELINE.md           script → storyboard → plan → assets → render → QA
```

## The planner

A reel laid out by hand is ten shots that each work and do not add up, because
nothing decided the rhythm — and every episode inherits whatever the last one
looked like, so "a different look every video" never happens while a person is
picking each knob.

So write only the storyboard — `episodes/<id>/brief.json`: the voiceover, and
one phrase per line saying what we are looking at. Then:

```bash
npm run plan -- --episode=mansa-musa
```

which writes `scene-config.json` and `assets.json`. Four things are derived:

**The words decide the shot.** A line with a number becomes a slate with that
number set large; a line listing three things becomes three pieces of paper
landing; a line naming an object becomes a push into it. What the brief states
outright (`title`, `items`, `artefact`, `pieces`) always beats what the planner
would have guessed.

**The words decide the length.** A scene runs as long as its line takes to speak
at a documentary rate. Nothing is padded to a round number — and nothing is
allowed to run long either: past 2.9 spoken seconds a sentence is cut again,
with or without a comma to cut at. A shot that runs four and a half seconds on
one camera move is the slideshow this whole engine exists to stop making.

**The asset director decides what may be shown.** Every picture is scored
against the role it plays; semantics gate the score, so a sharp, well-exposed
photograph of the wrong thing is refused rather than animated. A refusal writes
an `ASSET_REQUIRED` brief and the line becomes a typographic shot on a drawn
field. See [VIDEO_PIPELINE.md](VIDEO_PIPELINE.md).

**The director decides what happens inside the shot.** Every shot gets at least
two events, spread across its length, the first one early: the words landing,
a card dropping, a wireframe closing, the camera taking a hit. A camera push is
the floor, not an event. See [MOTION_SYSTEM.md](MOTION_SYSTEM.md).

**The episode decides its own look.** Grade, accent, drawn field, mark style,
caption face and a three-of-five transition vocabulary are drawn from a seed
made of the episode id, inside the bounds of its declared `mood`. Moods are
BOUNDS, never finished palettes — a menu would give ten episodes that are one of
five things; bounds give a family. Same brief, two moods:

```
gold-heat  accent #f2b53a · field sunburst · typed   · cuts slam, flare, rack
ash-grey   accent #e8e2d4 · field wash     · sticker · cuts flare, slip, rack
```

Rhythm is guarded by one rule, stated once and reused: **never the same thing
three shots running** — transitions, camera moves, text reveals, emphasis marks,
drawn props, motifs. Deliberately not "never twice": two of a kind is a rhyme,
and forbidding rhymes makes a reel alternate mechanically, which is its own tell.

## Run it

```bash
npm ci
npm run validate                        # schema + assets + IS THERE ANYTHING IN IT
npm run validate -- --strict            # warnings become failures
npm run plan     -- --episode=antikythera
npm run frames   -- --episode=antikythera --per=2   # contact sheet — LOOK AT IT
npm run render   -- --episode=antikythera           # → out/antikythera.mp4
npm run studio                          # Remotion Studio, live knobs
npm test && npm run typecheck
```

`npm run validate` prints the shape of each reel — `motion  33 event(s), 1.26/s,
2.18s per shot` — and names every shot that will read as a still. A config can
be perfectly well formed, name files that all exist, and describe seven
photographs being slowly scaled; the schema check cannot see that and
`scripts/lib/critique.mjs` can.

`npm run assets:placeholder -- --episode=<id>` writes labelled stand-ins — one
per file the config references, at the size its recipe asks for — so an episode
can be cut and timed before its artwork exists.

## Where the artwork comes from

Assets are **files in the episode folder**. The render opens them; it never
calls a generator. Drawing them is a separate step that writes into
`episodes/<id>/assets/` and commits the result:

```bash
node scripts/generate-assets.mjs --episode=zodiac-1969 --dry-run  # what would be drawn
node scripts/generate-assets.mjs --episode=zodiac-1969            # holes and stand-ins
node scripts/generate-assets.mjs --episode=zodiac-1969 --force    # redraw everything
node scripts/generate-assets.mjs --episode=zodiac-1969 --only=editor.png,detective.png
```

**The ledger decides what to draw, not the file system.** An episode is
scaffolded with stand-ins and those stand-ins are committed, so by the time the
generator first runs, every asset already exists as a file. Skipping on
existence alone would draw nothing, exit green, commit nothing, and leave a reel
of grey boxes behind a row of green ticks. A name in `.placeholders.json` is a
hole with a PNG in it, and gets drawn over.

Prompts live in `episodes/<id>/assets.json`, next to the config — a prompt is
the episode's business in exactly the way a file name is. Each asset declares a
`kind`, and the kind decides the size and whether it gets an alpha channel:

| kind | size | alpha | for |
|---|---|---|---|
| `backdrop` | 1080×1920 | — | walls, streets, rooms |
| `photo` | 900×1170 | — | what a portal flies into |
| `subject` | 820×1400 | yes | people |
| `object` | 820×1060 | yes | papers, evidence, frames |

`subject` and `object` get their backdrop keyed out, so they arrive with **real
transparency** and are then trimmed to their own edges — the trimmed bottom is
the subject's feet, which is what `footY` anchors to.

The keying **assumes nothing about the backdrop's colour.** An earlier version
measured greenness, which quietly made the whole step depend on a diffusion
model obeying an instruction to paint a chroma screen. It does not: asked for a
1969 documentary photograph of a man it draws a room, because that is the
stronger instruction — and every keyed asset came back fully opaque. So instead
a region is grown inward from the **frame edges**, which is the one thing that
is reliably backdrop, under two tolerances: a pixel must resemble the neighbour
it spread from (so a soft studio gradient is followed all the way in) and still
resemble the border it started from (so the region cannot creep through that
gradient into the subject). Spreading only from the edges is also what keeps a
white shirt on a white backdrop: a colour **enclosed** by the subject is never
reached. `"keyHoles": true` opts an asset out of that, for the one shape that
needs it — an empty picture frame, whose window is backdrop walled off by the
frame, and which would otherwise cover whatever it is framing.

Cut-outs deliberately do **not** get the episode's film-look `style`. Grain and
1969 available light describe a room, and a room has no backdrop to key; the
period treatment is applied to the whole frame at render time by `FilmLook`
anyway. They get `styleAlpha` instead.

Three guards make the step safe to automate: the file name seeds the generator,
so the same name draws the same picture on every run; a keyed image that comes
back fully opaque or fully transparent is **rejected rather than written**,
because a subject that keyed away to nothing renders as an empty scene rather
than as an error; and a rejected draw is re-rolled twice on derived seeds, since
that outcome is a roll of the dice rather than a broken prompt.

Filling in artwork never touches the config. The files are replaced by name.

A stand-in and a finished drawing are both just a PNG, so nothing downstream can
tell them apart on its own — which is how an episode of labelled grey boxes
renders and uploads without anyone noticing. `assets/.placeholders.json` is the
difference: the placeholder script adds names to it, the generator removes each
one as it draws it for real, and `npm run validate` prints how many are left.

```
✓ zodiac-1969 — 10 scene(s), 1620 frames (54.00s @ 30fps, 1080x1920)
  ⚠ 25 of these assets are still stand-ins: boot-print.png, car-exterior.png, …
```

## The seven templates

Each takes **roles**, not files. The episode decides which image fills a role.

| sceneType | roles | what it does |
|---|---|---|
| `portal-zoom-reveal` | `photo`, `frame?`, `wall?` | pushes into a photograph on a wall; the frame stays **welded** to the photo until `detachFrame`, then flies past camera while the photo settles and blooms into colour |
| `parallax-punch` | `background`, `character` | two flat layers, unequal scale about a **shared floor anchor** — fake depth. The cast shadow is the character's own file, blackened, flipped and skewed |
| `stacked-reveal` | `item1…itemN`, `background?` | items arrive on their own beats from **different directions** and pile up, each on a soft spring |
| `split-shift` | `background`, `character` | the subject slides aside with a motion-blur streak and the space it clears is used for text |
| `title-slate` | `background?` | a statement carried by type on a drawn field — needs no photograph, so it cannot fail on a missing asset |
| `evidence-board` | `background?` | drawn newspapers, index cards and prints landing one at a time |
| `composite` | any | **the general case the others are special cases of** — an arbitrary layer stack, see below |

## A shot is a stack, not a photograph

The reference kit settles it: the opening frame of a reel like this is a sky,
two cut-out clouds drifting at different speeds, a cut-out building, a figure, a
frame and a paper texture. Seven files, and not one of them is a whole picture —
even the background is assembled from pieces.

`composite` takes as many layers as a scene declares, and everything follows
from **one number per layer**:

```jsonc
"layers": [
  {"role": "wall",     "depth": 0.00, "anchor": "fill"},
  {"role": "cloud2",   "depth": 0.08, "anchor": "center", "x": 760, "y": 560, "width": 640, "drift": -320},
  {"role": "cloud1",   "depth": 0.14, "anchor": "center", "x": 300, "y": 430, "width": 860, "drift": -540},
  {"role": "building", "depth": 0.42, "anchor": "bottom", "x": 560, "y": 1290, "width": 1000},
  {"role": "man",      "depth": 1.00, "anchor": "bottom", "x": 540, "y": 1560, "height": 760, "shadow": true}
]
```

**`depth`** is how much of the camera's push a layer takes. The sky at 0 does not
move; the subject at 1 takes all of it; the building at 0.5 takes half. Parallax,
the sense of a real space, the reason a flat plate stops looking flat — all of it
falls out of that. Every layer scales about the **same anchor**; give each its own
centre and they slide against one another instead of holding together as a room.

`anchor` is `fill` (covers the frame), `bottom` (stands on x, y) or `center`.
`drift` is sideways travel across the whole scene — what clouds live on.
`shadow: true` casts a shadow made from that layer's own artwork.

## Optional roles

A role written **`?character`** means *use this if it is on disk*: the validator
does not fail on it and the template never receives it. This exists because of
one repeated dead end — a scene that wants a figure is worthless without one, but
making the figure required means the day the generator returns an empty room the
whole reel stops rendering. The scene degrades instead: with the cut-out it is a
parallax punch, without it a slow push on a plate.

```
✓ zodiac-1969 — 10 scene(s), 1640 frames (54.67s @ 30fps, 1080x1920)
  · 3 optional asset(s) absent: s04-berryessa.character, s06-stine.character, s06-stine.haze
```

An episode that needs a further mechanic exports it from
`episodes/<id>/scenes/index.tsx`; the renderer wires it in without touching the
shared set.

## scene-config.json

```jsonc
{
  "id": "test-episode",          // must match the folder name
  "fps": 30, "width": 1080, "height": 1920,
  "look": {
    "posterizeFps": 12,          // 12 reads stop-motion, 30 reads digital
    "grade": {"saturate": 0.78, "contrast": 1.12, "sepia": 0.1, "brightness": 0.95},
    "film": {
      "grain": true, "grunge": true, "scanlines": true,
      "vignette": true, "gateWeave": true,
      "grainOpacity": 0.5, "vignetteStrength": 0.52, "weavePx": 4
    }
  },
  "scenes": [
    {
      "id": "s2-punch",
      "sceneType": "parallax-punch",
      "voText": "The man in the frame was never questioned.",  // data only — v1 renders silent
      "durationInFrames": 120,
      "assets": {                                   // ROLE → episode-relative file
        "background": "assets/background-2.png",
        "character": "assets/character-1.png"
      },
      "params": {                                   // template knobs, all frames scene-relative
        "groundX": 560, "groundY": 1690,
        "bgScale": 1.12, "charWidth": 660, "charScale": 1.7,
        "shadowSkew": -53, "punchEndFrame": 86
      },
      "gradeOverride": {"saturate": 0.6},           // merged over the episode grade
      "onScreenText": [
        {"text": "never questioned", "atFrame": 14, "durationInFrames": 56,
         "style": "sticker", "position": "top"}
      ]
    }
  ]
}
```

Scene start frames are **accumulated**, never written down: scene two begins
where scene one ends. Every frame number inside a scene — `atFrame`, every
`params` frame — counts from **that scene's own zero**.

Asset paths are episode-relative on purpose. The renderer points Remotion's
public directory at `episodes/<id>/`, so `"assets/character-1.png"` means *that
episode's* file. Nothing is copied, and an absolute or `..` path is rejected by
the validator rather than allowed to break the isolation.

## Isolation is enforced, not documented

`test/enginePurity.test.mjs` fails CI if any file under `engine/` contains an
asset file name, an `episodes/` path, or a shipped episode id. That guard is the
reason a second episode stays a folder — the leak that turns it back into a code
change is always a one-line "just for now" default, and a rule in a README does
not catch those.

## CI

One workflow, `reel.yml`, and which job runs depends on why it started.

- **push / pull request → `check`**: schema, scene types, asset existence,
  engine guards, typecheck. No bundle, no browser — seconds, not minutes.
- **Run workflow → `make`**: the factory, in order.

  1. **Voice** — speaks the script, measures the pauses, re-cuts every scene to
     them. `piper` is the default and needs no key at all; `elevenlabs` and
     `openai` are there for a better voice, and `measure-only` reads a file you
     recorded yourself.
  2. **Artwork** — fetches what has a name from Wikimedia Commons, draws the
     rest, and lays the cut-outs on a checkerboard so a bad key is one glance
     rather than thirty files.
  3. **Render** — Chromium, mp4, plus a contact sheet of stills.

  The narration, the cut and the artwork are committed as ONE state: the config
  is cut to a voiceover, so committing them apart leaves a window where the
  reel's timings refer to a file that is not in the repo.

  Each stage is a toggle rather than its own workflow because they are one chain
  with real dependencies — re-voicing means re-cutting, and re-cutting means the
  artwork has to match the new scene ids. Running them out of order is the
  mistake this layout makes impossible.

## Episodes

| id | scenes | length |
|---|---|---|
| `zodiac-1969` | 10 | 54.0s |
| `test-episode` | 2 | 8.0s — engine smoke test |

## Audio

v1 renders **silent**. `voText` is carried in the config as data so the timing
and the words live together; wiring narration to it later does not change the
schema.
