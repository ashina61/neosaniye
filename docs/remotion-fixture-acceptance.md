# Fixture acceptance

The first integration PR is accepted only when:

- spec compiler unit tests pass
- Remotion TypeScript passes
- 1080x1920 H.264 video and audio streams exist
- fixture duration is 24 seconds
- black, freeze and silence scans pass
- artifact upload succeeds
- no publishing credentials or upload commands are used

Only after this gate passes will Phase 4 render routing be connected.
