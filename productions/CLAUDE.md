# productions/

Finished videos, produced through OpenMontage's own pipeline and committed here
so `.github/workflows/publish-production.yml` can upload them without a model
running in the runner.

**Before designing a new video, read [`STYLE_LEDGER.md`](STYLE_LEDGER.md).**

It lists what every previous video already did — design read, palette roles,
signature device, layout set, motion character — and those are the things the
next one may not repeat. You have no memory of the earlier videos; that file is
the memory. Skipping it is how five videos end up looking identical.

This directory holds no instructions about *how* to produce. That is
`AGENT_GUIDE.md` at the repository root and the pipeline's own stage directors.

## Layout

```
productions/<slug>/
├── <slug>_1080x1920.mp4     the deliverable
├── spec.yaml                title/hook/caption/description/hashtags for publish.py
└── source/                  composition + every stage artifact, for review and reuse of
                             the reasoning (never of the look)
```

Add a ledger row when a video ships, not when it is planned.
