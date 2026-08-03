# Remotion integration status

The renderer is the production path: every published video is rendered by the
Remotion reel engine.

Architecture in place:

- isolated Remotion package, pinned versions
- voiceover-first beat sheet (`src/story/`) — one spoken line, one rig
- shared motion engine (12fps posterize, boil, drift, pingpong, spring, wag)
- one film-look wrapper every beat inherits
- six rigs, each in its own file, each previewable on its own composition
- reel spec compiler (`src/video/buildReelSpec.js`) writing `production.json`
  plus a human-readable `beat-sheet.md`
- fixture reel with no media assets, proving rigs stand up on coded layers
- deterministic English fixture voice, music and layered SFX generation
- unit tests for rig assignment, verbatim on-screen text, measured placement
  and frame timing
- fixture validation workflow: architecture tests, typecheck, render, MP4
  stream check and black/freeze/silence scan

Publishing remains gated: credentials alone are never permission to upload, and
a technically broken MP4 is never sent to any platform.
