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
- **CMU mocap fetches work.** `raw.githubusercontent.com` is on the allowlist, so
  `ink-theater/mocap/add-motion.mjs` can pull BVH files from
  `una-dinosauria/cmu-mocap` and the whole clip library can be re-derived
  offline-ish in about a minute. No other media host is reachable.
- **`hyperframes render` can fail its own FFmpeg probe spuriously.** "FFmpeg
  cannot start / Install a working 64-bit FFmpeg build" while `ffmpeg -version`
  runs fine from the shell is a transient spawn failure. Re-run the render before
  believing it.

`hyperframes lint`, `hyperframes validate` and `hyperframes snapshot --at` are
the review loop this repository otherwise lacks. `validate` runs real WCAG
contrast checks in headless Chrome — it is how the errand orange was caught at
2.95:1 against the paper and darkened to pass.

## The Shorts safe frame (1080×1920)

Everything this channel makes is watched inside the YouTube Shorts / Reels /
TikTok chrome, and the chrome covers the picture. Measure against this, not
against the bare frame:

| band | what owns it |
|---|---|
| y > ~1450 | the title, the channel handle, the description, the scrubber |
| x > ~900, y 950–1560 | the like / comment / share button rail |
| **y 200–1400** | **yours** |

House numbers that came out of it:

- **captions 1250–1400**, never lower
- **the ground line at ~1130**, so the caption band is clear page under the figure
- nothing load-bearing in the button rail

`the-second-that-hangs` shipped its first cut with captions at y=1660 and not a
single line of it could be read on the platform it was made for. It cost a full
re-render. `ink-theater/ADEM.md` carries the same table.

## Local text-to-speech: use Kokoro, not Piper

`.voices/kokoro/` holds **Kokoro v1.0** (`kokoro-v1.0.onnx` + `voices-v1.0.bin`,
353 MB) and `kokoro_onnx` + `onnxruntime` are installed. It is local, free, needs
no key, and it is a large step up from Piper — which was the weakest component in
the first five productions.

```python
from kokoro_onnx import Kokoro
k = Kokoro(".voices/kokoro/kokoro-v1.0.onnx", ".voices/kokoro/voices-v1.0.bin")
s, sr = k.create(text, voice="am_michael", speed=1.0, lang="en-us")   # sr = 24000
```

- Loading the model takes about 30 seconds; load it **once** and loop the lines.
- 24 kHz — resample to 48 k (`scipy.signal.resample_poly(s, 48000, 24000)`) before
  it goes anywhere near the mix.
- Voices audited on the same line: `am_michael` 2.90 w/s (calm, measured — the
  channel's default), `bm_george` 2.85, `bm_fable` 3.04, `am_fenrir` 3.20,
  `af_heart` 3.35. Peaks 0.50–0.98, so check headroom per voice.
- Trim the leading and trailing near-silence off each line before timing anything
  against it, or every caption is late by the model's padding.

Piper (`.voices/en-us-ryan-high.onnx`) still works and is what productions 1–5
used. Don't go back to it without a reason.

## Delivery encode: `hyperframes render` output is a master, not a deliverable

`hyperframes render -q high` writes **x264 CRF 15, preset slow**. That is the
right setting for a master and the wrong one to ship: the boil filter puts
per-pixel turbulence on every stroke, which is the most expensive thing there is
to compress, so a dense composition comes out enormous.

`nobody-is-conducting` (120 drawn figures, boil on all of them) rendered to
**50 MB for 58 seconds — 6.9 Mbps.** Re-encoded at CRF 20 it is **9 MB**, at
**SSIM 0.9990** against the master and pixel-indistinguishable on a 2x crop of
the line work.

So: render at `-q high`, then encode the delivery file once, muxing the audio in
the same pass so the picture is only re-encoded once.

```bash
ffmpeg -y -i renders/vN.mp4 -i assets/audio/mix.wav \
  -af "loudnorm=I=-14:TP=-2.0:LRA=11:measured_I=...:linear=true,aresample=48000" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 -ac 2 -movflags +faststart -shortest renders/final.mp4
```

A sparse composition (a room, one figure) compresses to well under a megabyte a
second on its own and does not need this. Check the size before deciding.

## The mix: measure the voice against the bed, do not guess

`nobody-is-conducting` shipped with the narration **+1.4 dB** over the applause
and the user could not hear a word of it. The duck was 0.40 — four and a half
decibels — which is nothing under a broadband bed of 240 claps a second.

Broadcast practice is **dialogue 10–15 dB over the bed**, and under about 8 dB
you start losing words. Measure it rather than listening for it, because an
agent cannot listen:

```python
from scipy.signal import butter, sosfilt
band = butter(4, [300/(SR/2), 4000/(SR/2)], btype="band", output="sos")
speech = key > 0.5                      # the ducking key, i.e. "somebody is talking"
v = sosfilt(band, vox)[speech]
b = sosfilt(band, (mix.mean(1) - vox))[speech]
print(20*np.log10(rms(v)/rms(b)), "dB")
```

Measured on that film: duck 0.40 → **+1.4 dB** · 0.80 → +10.6 · **0.86 → +13.1**
· 0.90 → +14.7. The house setting is **0.86 with narration at 0.93 peak**.

Build the key from the speech envelope and **widen it both ways** (about 300 ms)
before smoothing, so the duck is already open before the first syllable and does
not close in the gaps inside a sentence. A key that tracks the waveform directly
pumps on every word.

## The channel's marks live in `ink-theater/brand.js`

`InkBrand.mark()` (the logo) and `InkBrand.subscribe()` (the one ask). Both are
in the shared module, not in any video, so they cannot drift apart between
productions.

- The logo is two **alpha masks** cut out of the source artwork — the monogram
  and the play triangle — painted rather than drawn, so the monogram is always
  ink and **the triangle takes that film's accent colour.** The mark is the
  channel's, the highlight is the video's, and the brand never fights a
  palette that is rationed to one meaning.
- It goes **outside the camera group**, so it does not zoom with the shot, and
  outside the setups, so it survives every cut. Top left, ~130px, 0.70 opacity.
- The subscribe beat goes **after the last line, never over one.** It needs
  about 3 seconds, so the film is built 3 seconds longer than its script and
  the last shot holds under it. A film that interrupts its own argument to beg
  has lost the argument.


## Building a production: `bin/build-ink.sh <slug>`

The chain used to be ten commands run by hand, which is how four defects
shipped. It is now one:

```
simulation -> mix -> lint -> validate -> render -> delivery encode -> checks -> ship
```

and every step with a number attached to it is **checked**, not remembered:

| gate | why it exists |
|---|---|
| `voice over bed >= +10 dB` | video six shipped at +1.4 and was unhearable |
| captions not below y=1400 | video five shipped at 1660, under the Shorts title |
| 1080×1920 | anything else is not a Shorts upload |
| −14 ±1 LUFS, TP ≤ −1.0 | the house loudness |
| ≤ 12 Mbps | video six's master was 6.9 Mbps and 50 MB; CRF 20 is 20 MB |
| a 1 fps contact sheet | three of the worst defects were invisible in a still |

`.github/workflows/render-production.yml` runs the same script in CI and uploads
the video and the contact sheet.

**What is deliberately NOT automated: the video itself.** The scheduled
generator this repository used to have is retired at the bottom of
`daily-short.yml`, and the reason is written there — a pipeline that invents a
video every day invents the same video every day. Automating the BUILD is free.
Automating the taste is what made them all look alike.

## Publishing on a schedule: `productions/QUEUE.yaml`

One video a week, with nobody in the loop.
`.github/workflows/publish-queue.yml` runs Tuesdays 18:00 Istanbul, takes the
**first** entry whose `state` is `pending`, publishes it exactly as that entry
says, and commits the state back so next week takes the next one.

```
bin/queue.py status        what is where
bin/queue.py next          the next entry, as KEY=VALUE for a workflow
bin/queue.py done <slug>   mark it published
```

The five things that make it safe to leave running are all reactions to how the
retired generator failed:

1. **A master switch.** `enabled: false` and the job does nothing. Merging the
   workflow does not start publishing.
2. **Nothing falls back.** Every entry states its own `upload` and `privacy`,
   and an entry that does not is skipped. A scheduled run carries no inputs, so
   `inputs.x || default` becomes the whole configuration — which is how this
   repository once published everywhere, publicly, twice a day.
3. **No model runs in the job.** The runner holds the upload tokens; the only
   thing it is trusted to do is move a committed file.
4. **The file is proved 1080×1920 with an audio track** before it goes near an
   account.
5. **It publishes one and stops**, and only ticks the entry off if the upload
   actually succeeded. A bad video costs a week, not the queue.

`workflow_dispatch` has `dry_run: true` by default — it says what it would do
and does nothing.

## The daily producer

A Routine fires a **fresh session every day at 09:00 Istanbul** with one
instruction: read `PRODUCE.md` and follow it. It has no memory of the videos
before it — the repository is the memory, which is what `STYLE_LEDGER.md`,
`ADEM.md` and `MANIFESTO.md` are for.

```
Routine   Daily video — Ink Theater
cron      0 6 * * *      (09:00 Europe/Istanbul)
session   a new one each firing
notify    push when it finishes
```

It ends by running `bin/queue.py add <slug> --topic <id>` and pushing.

**The two jobs are deliberately at different speeds.** The producer runs daily
and the publisher runs weekly, so a film made today enters the queue behind
everything already in the line. That gap is the review window. Nothing reaches
the channel that has not sat in `productions/` for at least as many days as
there are films ahead of it, and the queue's `enabled` switch is a second gate
on top of that. `PRODUCE.md` tells the daily session that switch is not its to
touch.

**If the queue gets longer than about six**, the producer is running faster than
the ledger can stay honest — the five fields have to be genuinely new every
time, and there are only so many ways to divide a frame. Slow the cron down
rather than letting it repeat itself.

To change the pace or stop it: the Routine is `trig_01PHEpQNDJXg2BLV7XJT7X6b`,
editable from the Routines list on claude.ai or with `update_trigger`.
