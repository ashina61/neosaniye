# NeoSaniye Remotion engine

This package renders a topic-agnostic `ProductionSpec` into a 1080x1920 collage Short. It is intentionally isolated from the main Node package so the existing FFmpeg pipeline can remain stable during rollout.

Commands from the repository root:

```bash
npm install --prefix remotion
npm run remotion:typecheck
npm run remotion:fixture
```

The renderer does not burn a continuous subtitle strip. Accessibility captions remain the responsibility of the main NeoSaniye pipeline.
