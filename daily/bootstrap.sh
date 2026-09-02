#!/usr/bin/env bash
# Prepare a fresh container to build and publish a video.
# Idempotent: safe to re-run, skips whatever is already in place.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"

log() { printf '\n==> %s\n' "$*"; }

log "system packages"
if ! command -v ffmpeg >/dev/null; then
  apt-get update -qq && apt-get install -y -qq ffmpeg
fi
ffmpeg -version | head -1

log "python environment"
if [ ! -x .venv/bin/python ]; then
  if command -v uv >/dev/null; then uv venv --python 3.10 .venv; else python3 -m venv .venv; fi
fi
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install -q --upgrade pip >/dev/null 2>&1 || true
python -m pip install -q -r requirements.txt
 python -m pip install -q fonttools brotli
python -m pip install -q piper-tts
python -c "import yaml, numpy, google.auth, requests; print('python deps ok')"

log "piper voice models"
# HuggingFace is not reachable from this environment; these GitHub release
# tarballs are the working mirror for the classic piper voices.
mkdir -p .voices
if [ ! -f .voices/en-us-ryan-high.onnx ]; then
  curl -sL --max-time 600 -o /tmp/ryan.tar.gz \
    "https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-us-ryan-high.tar.gz"
  tar xzf /tmp/ryan.tar.gz -C .voices && rm -f /tmp/ryan.tar.gz
fi
ls -1 .voices/*.onnx

log "browser for the renderer"
BROWSER=""
for c in /opt/pw-browsers/chromium-*/chrome-linux/chrome /usr/bin/chromium /usr/bin/google-chrome; do
  [ -x "$c" ] && BROWSER="$c" && break
done
if [ -z "$BROWSER" ]; then
  echo "ERROR: no Chromium found; hyperframes cannot render." >&2; exit 1
fi
echo "$BROWSER"
{ echo "export HYPERFRAMES_BROWSER_PATH=$BROWSER"; echo "export HYPERFRAMES_SKIP_SKILLS=1"; } > .render-env

log "node packages + hyperframes runtime"
( cd daily && npm install --no-audit --no-fund --silent )
npx --yes hyperframes --version >/dev/null

log "fonts"
python daily/lib/fetch_fonts.py

log "bootstrap complete"
