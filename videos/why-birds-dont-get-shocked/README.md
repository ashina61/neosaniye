# Why Birds Don't Get Shocked — 30s vertical explainer

A 1080×1920 / 30fps faceless explainer built with HyperFrames. Eight narration
beats explain why a bird on a live line is safe (no potential difference between
its feet) and when it stops being safe (bridging two conductors).

Delivered file: `renders/why-birds-dont-get-shocked_1080x1920.mp4`
(H.264 + AAC, 30.00s, −13.5 LUFS, −1.0 dBTP).

## What is source, what is derived

Committed source: `build_composition.py`, `index.html` (its output),
`audio/lines.txt` (the script), `audio/timing.json` (beat map),
`audio/compose_music.py` (the score), `public/fonts/`, and the final MP4.

Ignored because they are regenerable: `snapshots/`, `verify/`,
`renders/silent.mp4`, and the intermediate audio under `audio/`.

## Rebuild

Prerequisites: ffmpeg, Node 18+, and a Chromium binary. HyperFrames finds the
browser via `HYPERFRAMES_BROWSER_PATH` when Chrome Headless Shell is absent.

```bash
npm install                                   # gsap, referenced locally by index.html
python build_composition.py                   # regenerate index.html
npx hyperframes lint && npx hyperframes inspect
npx hyperframes render --output renders/silent.mp4 --fps 30 --quality high
```

Narration is offline piper TTS. Synthesize each line of `audio/lines.txt` into
`audio/lines/NN.wav`, then place them at the offsets in `audio/timing.json`:

```bash
piper -m <voice>.onnx -c <voice>.onnx.json -f audio/lines/01.wav <<< "<line 1>"
python audio/compose_music.py                 # writes audio/music.wav
```

Then build `audio/vo.wav` from the offsets, duck the music under it with
ffmpeg's `sidechaincompress`, and mux onto the silent render.

## Note on assets

Every visual is drawn in the composition — there is no stock footage — and the
score in `audio/compose_music.py` is synthesized from scratch, so no third-party
media is embedded. The two bundled typefaces are the exception: Anton and Inter
are third-party fonts under the SIL Open Font License, vendored here as latin
woff2 subsets so the render does not depend on a font CDN.
