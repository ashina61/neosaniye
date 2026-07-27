# NeoSaniye Premium Motion Migration

This migration replaces the remaining image/stock/caption-driven production path with a procedural Remotion motion-graphics factory.

## Non-negotiable production rules

- No AI-generated scene images.
- No Pexels, Pixabay, stock video, archive image, or photo montage in the final render.
- No burned subtitles or scrolling caption strip.
- On-screen text is editorial kinetic typography only: hook, names, dates, numbers, evidence, twist.
- Every scene is built from React/SVG shapes, paper collage components, diagrams, maps, documents, silhouettes, charts, route lines, and typography.
- English narration.
- Layered scene-specific SFX and a ducked music bed.
- 1080x1920, 30fps.

## Live pipeline

Topic -> Script -> TTS -> Canonical timeline -> Premium storyboard spec -> Procedural Remotion render -> Technical/editorial QC -> Upload.

## Removed from live production

- generateImages()
- image provider chains
- stock footage selection
- image prompt rendering
- media asset duplication logic
- burned caption layout/integrity gates
- subtitle strip rendering

External platform captions are disabled by default. They can only be reintroduced as a separate opt-in accessibility feature and must never affect the visual render.
