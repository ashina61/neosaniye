# NeoSaniye Remotion Production Integration

## Goal

Integrate the validated collage motion-design engine from `ashina61/neosaniye-remotion-lab` into the existing NeoSaniye production pipeline without replacing topic selection, script generation, TTS, QC, deduplication, metadata, or upload safety.

The integration point is Phase 4 (rendering). Existing FFmpeg rendering remains available as a controlled fallback during rollout.

## Current pipeline retained

1. Topic and script generation
2. Crew planning
3. TTS and canonical word timeline
4. Asset generation
5. Render
6. Technical and editorial QC
7. YouTube / Meta publishing
8. Publication ledger and dedup state

## New render architecture

```text
script + canonicalTimeline + media + editPlan + audio
                         |
                         v
              buildRemotionSpec.js
                         |
                         v
                 production.json
                         |
                         v
            Remotion DynamicShort.tsx
                         |
                         v
                 final 1080x1920 MP4
```

## Files to add

```text
src/remotion/
  index.ts
  Root.tsx
  DynamicShort.tsx
  schema.ts
  design/
    CollageKit.tsx
    FilmTreatment.tsx
    KineticType.tsx
  scenes/
    HookReveal.tsx
    DocumentScene.tsx
    PortraitDossier.tsx
    MapRoute.tsx
    StatSlot.tsx
    ExplainerDiagram.tsx
    TransactionScene.tsx
    ConsequenceScene.tsx
    FinalTwist.tsx

src/video/
  buildRemotionSpec.js
  renderRemotion.js
  renderRouter.js

assets/sfx/
  manifest.json
  owned-or-licensed-files
```

## Production spec

Every run generates `output/<topic>/production.json`.

```json
{
  "version": 1,
  "meta": {
    "topic": "...",
    "title": "...",
    "language": "en",
    "fps": 30,
    "width": 1080,
    "height": 1920,
    "durationSeconds": 44
  },
  "audio": {
    "voicePath": "...",
    "musicPath": "...",
    "ambiencePath": null
  },
  "theme": {
    "family": "neosaniye-collage",
    "accent": "gold",
    "paper": "cream",
    "dark": "navy"
  },
  "scenes": [
    {
      "id": "scene-01",
      "template": "hook-reveal",
      "fromFrame": 0,
      "durationInFrames": 120,
      "narration": "...",
      "headline": "...",
      "emphasis": ["..."],
      "assets": [],
      "transition": "whip-flash",
      "sfx": []
    }
  ]
}
```

## Scene compilation

The renderer must not contain topic-specific hard-coded scenes such as Eiffel Tower or Victor Lustig. `buildRemotionSpec.js` converts the existing script and visual-story data into reusable scene templates.

Initial supported templates:

- `hook-reveal`
- `document`
- `portrait-dossier`
- `map-route`
- `stat-slot`
- `explainer-diagram`
- `transaction`
- `consequence`
- `final-twist`

Unknown or weakly classified scenes use a safe `collage-generic` template rather than failing the whole run.

## Text policy

- No permanently burned subtitle strip.
- Keep SRT generation and YouTube caption upload for accessibility.
- On-screen text is editorial motion design only: hooks, names, statistics, evidence labels, and final reveals.
- Word timings from the existing TTS pipeline trigger kinetic emphasis.

## SFX policy

- Shared SFX library, not one folder per topic.
- Every file requires a manifest entry with source, license, hash, and allowed use.
- Scene boundaries select entrance, long-zoom, quick-pan, shutter, focus-hunt, cash, impact, stamp, paper, tension, and final-boom families.
- Avoid repeating the same cue too frequently.
- Existing final-output SFX verification remains mandatory.
- Reference-practice-kit files are optional development references only until publication rights are confirmed.

## Renderer routing

Environment variables:

```text
RENDER_ENGINE=ffmpeg|remotion
REMOTION_MODE=shadow|unlisted|public
REMOTION_FALLBACK=none|ffmpeg
BURN_CAPTIONS=0
```

Rules:

- Default remains `ffmpeg` until the integration PR passes.
- `shadow`: render and upload artifact only; never publish.
- `unlisted`: upload only after all technical and editorial gates pass.
- `public`: enabled only after the rollout acceptance criteria are met.
- In `public` mode, a Remotion render failure is fail-closed. Do not silently publish a lower-quality fallback.

## Workflow rollout

### Stage 1 — PR validation

- `workflow_dispatch` and `pull_request`
- forced known fixture script
- no upload
- typecheck, unit tests, Remotion render, final MP4 QC

### Stage 2 — Shadow cron

- one run per day
- `RENDER_ENGINE=remotion`
- `REMOTION_MODE=shadow`
- English only
- artifact and production reports retained

### Stage 3 — Unlisted

After at least five consecutive successful shadow runs:

- one run per day
- YouTube privacy `unlisted`
- manual visual review

### Stage 4 — Public

After at least three accepted unlisted videos:

- public upload enabled
- existing publication ledger and dedup remain active
- old three-slot workflow is reduced or retired to avoid duplicate daily publishing

## Acceptance gates

A run can advance only when all are true:

- 1080x1920, 30 FPS, valid H.264/AAC
- voice starts within the configured deadline
- no black/frozen/silent segments beyond current limits
- no subtitle strip in the bottom UI danger zone
- at least 8 meaningful visual events
- at least 3 pattern interrupts
- SFX cues verified from the final MP4
- no repeated hero asset across consecutive scenes
- metadata, captions, publication ledger, and dedup state written successfully

## Cron recommendation

Do not replace the existing three scheduled publishing slots immediately. Add a separate shadow workflow at a non-zero minute to reduce GitHub scheduler congestion. The scheduled workflow must be merged into the repository default branch before it can run.

Suggested first shadow schedule:

```yaml
on:
  schedule:
    - cron: "17 16 * * *"
```

The exact public publishing time will be chosen after shadow-run render duration and audience data are measured.

## Implementation order

1. Add Remotion dependencies and TypeScript config.
2. Port the generic collage design system from the lab.
3. Build `production.json` compiler.
4. Add `renderRouter.js` and wire Phase 4.
5. Preserve SRT caption upload while disabling burned captions.
6. Add licensed SFX manifest and dynamic cue planner.
7. Update QC for subtitle-free Remotion output.
8. Add fixture-based PR workflow.
9. Add shadow cron only after PR render succeeds.
10. Promote through shadow → unlisted → public gates.
