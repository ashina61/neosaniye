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
