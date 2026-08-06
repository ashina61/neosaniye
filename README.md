# crime-reels

Vertical crime-documentary reels — **one shared engine, many episodes**.
1080×1920, 30fps, rendered headlessly with Remotion.

Adding an episode is adding a folder. Nothing in `engine/` ever learns a file
name, an episode id, or a story.

```
engine/                     shared code — knows roles and numbers, never assets
  motion.ts                 posterize, boil, drift, pingpong, spring, blur
  FilmLook.tsx              grain · grunge · scanlines · vignette · gate weave · grade
  Plate.tsx                 one flat image layer (full-bleed, or a sized subject)
  OnScreenText.tsx          scene-relative text
  Episode.tsx               the timeline
  Root.tsx                  the composition (size and duration come from config)
  schema.mjs / schema.ts    the contract: one runtime, one set of types
  sceneTypes/               the four shared templates + registry

episodes/<episode-id>/
  scene-config.json         the episode's only source of truth
  assets/                   its images
  scenes/index.tsx          OPTIONAL — templates only this episode uses

scripts/                    render + validate CLIs
test/                       engine-purity guard, schema, registry, episodes
```

## Run it

```bash
npm ci
npm run validate                        # every episode: schema + assets, no render
npm run validate -- --episode=test-episode
npm run render   -- --episode=test-episode      # → out/test-episode.mp4
npm run studio                          # Remotion Studio, live knobs
npm test && npm run typecheck
```

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

`subject` and `object` are drawn on a chroma-green backdrop and keyed out, so
they arrive with **real transparency** and are then trimmed to their own edges —
the trimmed bottom is the subject's feet, which is what `footY` anchors to. A
soft threshold band keeps hair and cloth from becoming a scissor-cut outline,
and a despill pass pulls the green reflection back out of those edge pixels.

Two guards make the step safe to automate: the file name seeds the generator, so
the same name draws the same picture on every run; and a keyed image that comes
back either fully opaque or fully transparent is **rejected rather than
written**, because a subject that keyed away to nothing renders as an empty
scene rather than as an error.

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

## The four templates

Each takes **roles**, not files. The episode decides which image fills a role.

| sceneType | roles | what it does |
|---|---|---|
| `portal-zoom-reveal` | `photo`, `frame?`, `wall?` | pushes into a photograph on a wall; the frame stays **welded** to the photo until `detachFrame`, then flies past camera while the photo settles and blooms into colour |
| `parallax-punch` | `background`, `character` | two flat layers, unequal scale about a **shared floor anchor** — fake depth. The cast shadow is the character's own file, blackened, flipped and skewed |
| `stacked-reveal` | `item1…itemN`, `background?` | items arrive on their own beats from **different directions** and pile up, each on a soft spring |
| `split-shift` | `background`, `character` | the subject slides aside with a motion-blur streak and the space it clears is used for text |

An episode that needs a fifth mechanic exports it from
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

- **`validate-episode.yml`** — on every push and PR: schema, scene types, asset
  existence, engine guards, typecheck. No bundle, no browser, seconds not
  minutes.
- **`generate-assets.yml`** — `workflow_dispatch` with `episode_id`, optional
  `only` and `force`: draws the episode's artwork, validates that every file the
  config names is now on disk, and commits the PNGs to the branch. It goes red
  *before* committing if a draw failed, so a half-drawn episode is never left
  looking finished.
- **`render-episode.yml`** — `workflow_dispatch` with an `episode_id` input:
  installs Chromium, renders, uploads `out/<episode_id>.mp4` as an artifact. The
  episode is a runtime input, so the same commit renders any of them.

## Episodes

| id | scenes | length |
|---|---|---|
| `zodiac-1969` | 10 | 54.0s |
| `test-episode` | 2 | 8.0s — engine smoke test |

## Audio

v1 renders **silent**. `voText` is carried in the config as data so the timing
and the words live together; wiring narration to it later does not change the
schema.
