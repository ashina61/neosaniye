# Cloud environment — what a production session needs

Written down because every session starts with a clean container and rediscovers
the same walls otherwise. Measured on 2026-09-04 from a session in the
**Neosaniye** environment.

Set both of these at claude.ai/code → environment selector → **Neosaniye** →
*Update cloud environment*. Changes apply to **sessions started afterwards**; a
running session keeps the values it booted with.

## 1. Environment variables

`.env` format, one per line. Only these two are needed for stock media; both keys
are free.

```
PEXELS_API_KEY=...        # pexels.com/api
PIXABAY_API_KEY=...       # pixabay.com/api/docs
```

Optional, in order of how much they'd actually improve a video:

```
ELEVENLABS_API_KEY=...    # or GEMINI_API_KEY — narration is the weakest link
GEMINI_API_KEY=...        # text + TTS; free tier, quota runs out
FREESOUND_API_KEY=...     # sound effects
```

Anyone using the environment can read these values. On Pro/Max, **API
credentials** (below Environment variables in the same dialog) store a key the
agent proxy attaches after the request leaves the container, so the session never
sees it — better for secrets, but it only fits APIs that take a bearer header.

## 2. Network access → Custom

The default **Trusted** level does not reach Pexels or Pixabay. Verified: all
seven hosts below return a proxy denial, not a 404.

```
api.pexels.com
*.pexels.com
player.vimeo.com
pixabay.com
*.pixabay.com
huggingface.co
*.hf.co
remotion.media
```

Keep **"Also include default list of common package managers"** checked.

| Host | Needed for | What happens without it |
|---|---|---|
| `api.pexels.com`, `*.pexels.com` | stock footage and stills | `pexels_video` / `pexels_image` fail even with a key |
| `player.vimeo.com` | Pexels serves some video files from Vimeo's CDN | search works, download fails |
| `pixabay.com`, `*.pixabay.com` | stock footage, stills, **and royalty-free music** | the music bed has to be produced locally |
| `huggingface.co`, `*.hf.co` | Piper and Kokoro voice models | voices must be pulled from GitHub releases instead |
| `remotion.media` | Remotion's headless Chrome download | render fails until an existing Chromium is wired in by hand |

## Workarounds already in place

These make a session survive without the domains above, but they cost time and
they are not a substitute for opening the hosts:

- **Chromium**: Playwright's headless shell at
  `/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/` symlinked into
  `remotion-composer/node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/`.
  Both paths are gitignored, so this is redone per container.
- **Piper voice**: `en_US-ryan-high` from the `rhasspy/piper` v0.0.2 GitHub
  release rather than HuggingFace. Old-format config, works with piper1-gpl.
- **Fonts**: fetched once with `curl` and inlined as base64 data URIs in the
  composition. The render browser does not trust the proxy CA, so a font fetched
  at render time fails with `ERR_CERT_AUTHORITY_INVALID`. Inlining also makes the
  render offline and deterministic — worth keeping even after the domains open.
- **Music**: produced locally when Pixabay is unreachable.

## Fonts

`fonts.googleapis.com` and `fonts.gstatic.com` are reachable with curl, but the
render browser does not trust this environment's proxy CA, so a face fetched at
render time fails inside Remotion. Two workarounds, both needed:

- **For Remotion**: fetch the woff2 once with curl (a modern User-Agent gets
  woff2; an IE6 UA gets EOT, which is useless), base64 it into a `fonts.ts`, and
  declare it in CSS. Never wrap it in `delayRender` — Remotion fakes timers
  during a render, so a `setTimeout` fallback never fires and an uncleared
  `delayRender` aborts the whole render.
- **For Manim**, which uses system fontconfig: fetch the TTF from
  `raw.githubusercontent.com/google/fonts/main/ofl/<family>/…` — GitHub is on the
  allowlist and serves the real TTF, including variable fonts with named
  instances. Drop it in `~/.local/share/fonts/` and run `fc-cache -f`. Google
  Fonts' CSS API will not give you a TTF at any User-Agent worth using.

## Manim

Manim CE 0.21.0 is installed and needs no key and no network. Set
`config.pixel_width/pixel_height/frame_rate` **in the module**, not on the CLI:
module-scope assignment runs after CLI parsing and wins, so `-qh` still produces
1080x1920 at 30fps if the module says so. Note that `self.wait()` quantises down
to whole frames, so a scene built from many short waits comes out a few frames
short of its nominal duration — pad each clip to an exact frame count with
`tpad=stop_mode=clone` rather than trying to make the waits add up.

## HyperFrames and Ink Theater

`npx hyperframes` (0.8.29) works offline and renders about 4 seconds of
1080x1920 per 18 seconds of wall clock — roughly four times faster than Remotion
here. Set the frame size with `data-width` / `data-height` on the composition
wrapper; there is no portrait preset to look for.

Three things that are not obvious and each cost a cycle:

- **`cdn.jsdelivr.net` is denied** by this environment's network policy, so the
  `<script src="https://cdn.jsdelivr.net/npm/gsap@3/...">` in every HyperFrames
  example silently loads nothing. Vendor gsap from `daily/node_modules/gsap/dist/`
  instead. A render-time fetch would break determinism anyway.
- **`transformOrigin` in pixels does not work on an SVG `<g>`.** GSAP needs
  `svgOrigin` in user units. Getting it wrong throws the element off the page,
  and — this is the expensive part — it is invisible in a snapshot of the wrong
  frame. Sample the rendered file.
- **A mocap segment longer than its clip wraps and replays the action.** Clip
  lengths are in `ink-theater/mocap/catalog.json` (most are 6.00s; `walk` is
  2.87s, `run` 1.27s). Pass `loop: false` to hold the last frame.

- **A gsap timeline renders its children in start-time order, not insertion
  order.** A tween at position 0 that redraws something every frame therefore
  always runs *before* a tween at 22.9s that sets what it should be drawing, and
  the drawing lags its own data by one render. Sequentially that is 33ms and easy
  to miss; on a `snapshot --at` seek it is whatever the previous seek left
  behind, which is how it was finally caught. Redraw from the tweens that move
  the data, not only from a global ticker.
- **Every clip in `mocap/clips.js` opens with the skeleton's rest pose.** The
  converter kept the BVH's first frame, so a T-pose flashed for a single frame
  at the start of every choreograph segment — six times in the fourth video.
  One frame at 30fps never appears in a snapshot; it is only visible in the
  render, or by measuring frame 0's hand span against the clip's median (it
  stands out by 2x to 11x). `InkPuppet` now trims it on first use.
- **`hyperframes render` can fail its own FFmpeg probe spuriously.** "FFmpeg
  cannot start / Install a working 64-bit FFmpeg build" while `ffmpeg -version`
  runs fine from the shell is a transient spawn failure. Re-run the render before
  believing it.

`hyperframes lint`, `hyperframes validate` and `hyperframes snapshot --at` are
the review loop this repository otherwise lacks. `validate` runs real WCAG
contrast checks in headless Chrome — it is how the errand orange was caught at
2.95:1 against the paper and darkened to pass.
