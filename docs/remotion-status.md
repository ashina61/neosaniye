# Remotion integration status

Current branch: `agent/remotion-production-integration`

Implemented in this stage:

- isolated Remotion package
- dynamic collage production schema
- reusable scene templates
- script-to-production-spec compiler
- fixture production plan
- deterministic English fixture voice, music and layered SFX generation
- unit tests for classification and frame timing
- no-upload GitHub Actions validation workflow

Not enabled yet:

- Phase 4 render routing in the live pipeline
- shadow cron
- unlisted or public publishing
- live production SFX manifest

The existing daily publishing workflow remains unchanged until the fixture PR passes.
