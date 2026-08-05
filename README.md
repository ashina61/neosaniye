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

`npm run assets:placeholder -- --episode=<id>` writes flat colour-box stand-ins
so a new episode can be timed before its real artwork exists.

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
- **`render-episode.yml`** — `workflow_dispatch` with an `episode_id` input:
  installs Chromium, renders, uploads `out/<episode_id>.mp4` as an artifact. The
  episode is a runtime input, so the same commit renders any of them.

## Audio

v1 renders **silent**. `voText` is carried in the config as data so the timing
and the words live together; wiring narration to it later does not change the
schema.
