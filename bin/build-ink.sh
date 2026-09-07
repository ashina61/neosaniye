#!/usr/bin/env bash
# Build one Ink Theater production, end to end, with the house standards
# enforced rather than remembered.
#
#   bin/build-ink.sh <slug> [--skip-sim] [--skip-render] [--no-ship]
#
# It runs: simulation -> mix -> lint -> validate -> render -> delivery encode
# -> loudness -> contact sheet -> ship. Every step that has a number attached
# to it is CHECKED, and the script stops on the first one that is out of spec,
# because all four defects this channel has shipped were things a number would
# have caught: captions at y=1660, a voice +1.4 dB over the bed, a 50 MB
# master posted as a deliverable, and a flash rendered invisible.
set -euo pipefail

SLUG="${1:?usage: build-ink.sh <slug> [--skip-sim] [--skip-render] [--no-ship]}"; shift || true
SKIP_SIM=0; SKIP_RENDER=0; SHIP=1
for a in "$@"; do case "$a" in
  --skip-sim) SKIP_SIM=1 ;; --skip-render) SKIP_RENDER=1 ;; --no-ship) SHIP=0 ;;
esac; done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJ="$ROOT/projects/$SLUG"
OUT="$ROOT/productions/$SLUG"
HF="npx hyperframes@0.8.29"
[ -d "$PROJ/hyperframes" ] || { echo "no such project: $PROJ"; exit 1; }
say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

say "$SLUG — simulation and mix"
if [ "$SKIP_SIM" = 0 ] && [ -d "$PROJ/sim" ]; then
  cd "$PROJ/sim"
  [ -f kuramoto.py ] && python3 kuramoto.py
  for f in model.py simulate.py; do [ -f "$f" ] && python3 "$f"; done
  [ -f mix.py ] && python3 mix.py | tee /tmp/ink-mix.log
  # the check that must never regress again
  if grep -q "voice over" /tmp/ink-mix.log; then
    DB=$(grep "voice over" /tmp/ink-mix.log | grep -oE '[-+][0-9.]+ dB' | grep -oE '[-+][0-9.]+')
    awk -v d="$DB" 'BEGIN{ if (d+0 < 10) { print "FAIL: voice is only " d " dB over the bed; the house floor is +10 (target +12..+15)"; exit 1 } else print "  voice over bed: " d " dB  OK" }'
  else
    echo "  (mix.py prints no voice-over-bed check — add one)"
  fi
fi

say "lint and validate"
cd "$PROJ/hyperframes"
$HF lint . 2>&1 | tail -4
$HF lint . 2>&1 | grep -qE '[1-9][0-9]* error' && { echo "FAIL: lint errors"; exit 1; } || true
$HF validate . 2>&1 | tail -3

# the caption band is not negotiable: below 1400 is under the Shorts chrome
if grep -qE '\.cap[^}]*top:\s*(1[5-9][0-9][0-9]|[2-9][0-9]{3})px' index.html; then
  echo "FAIL: captions are below y=1400, inside the Shorts title block"; exit 1
fi
echo "  caption band OK"

DUR=$(grep -oE 'data-duration="[0-9.]+"' index.html | head -1 | grep -oE '[0-9.]+')

# THE HOUSE LENGTH IS 40-50 SECONDS. The runbook once said "~60 seconds of
# film" and three films came out 60-62s: a minute of someone's attention, asked
# for by a channel that has not earned a minute. A Short is allowed to be three
# minutes long; that is not a reason to be one. Cut the third example, never the
# payoff. This is a gate and not a suggestion, because the drift was a sentence
# in a document that nobody was measuring against.
python3 - "$DUR" <<'DURCHECK'
import sys
d = float(sys.argv[1])
if not 40.0 <= d <= 50.0:
    print(f"FAIL: the film is {d:.1f}s — the house range is 40-50s"
          + (" (cut a beat)" if d > 50 else " (it is too thin to land)"))
    sys.exit(1)
print(f"  length {d:.1f}s OK")
DURCHECK

say "render  (${DUR}s)"
if [ "$SKIP_RENDER" = 0 ]; then
  rm -f "$PROJ/renders/master.mp4"
  $HF render . -o "$PROJ/renders/master.mp4" -f 30 -q high 2>&1 | tail -3
fi
MASTER="$PROJ/renders/master.mp4"
[ -s "$MASTER" ] || { echo "FAIL: no master"; exit 1; }

say "delivery encode"
cd "$PROJ"
MEAS=$(ffmpeg -hide_banner -i assets/audio/mix.wav -af loudnorm=I=-14:TP=-2.0:LRA=11:print_format=json -f null - 2>&1 \
  | python3 -c "import sys,json; s=sys.stdin.read(); j=json.loads(s[s.rindex('{'):s.rindex('}')+1]); print(f\"measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}\")")
rm -f renders/final.mp4
# CRF 20, and the audio muxed in the SAME pass so the picture is encoded once
ffmpeg -y -hide_banner -v error -i "$MASTER" -i assets/audio/mix.wav \
  -af "loudnorm=I=-14:TP=-2.0:LRA=11:$MEAS:linear=true,aresample=48000" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 192k -ar 48000 -ac 2 -shortest renders/final.mp4

python3 - "$PROJ" <<'PY'
import json, subprocess, sys, os
p = sys.argv[1] + "/renders/final.mp4"
r = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration,size",
                    "-show_entries","stream=codec_name,width,height","-of","json",p],
                   capture_output=True, text=True)
j = json.loads(r.stdout)
w = int(j["streams"][0]["width"]); h = int(j["streams"][0]["height"])
size = int(j["format"]["size"]); dur = float(j["format"]["duration"])
ln = subprocess.run(["ffmpeg","-hide_banner","-i",p,"-af",
                     "loudnorm=I=-14:TP=-1.5:print_format=json","-f","null","-"],
                    capture_output=True, text=True).stderr
k = json.loads(ln[ln.rindex("{"):ln.rindex("}")+1])
I, TP = float(k["input_i"]), float(k["input_tp"])
mbps = size * 8 / dur / 1e6
bad = []
if (w, h) != (1080, 1920): bad.append(f"not 1080x1920 ({w}x{h})")
if not (-15.0 <= I <= -13.0): bad.append(f"loudness {I} LUFS, want -14 +/-1")
if TP > -1.0: bad.append(f"true peak {TP} dBTP, want <= -1.0")
if mbps > 12: bad.append(f"{mbps:.1f} Mbps — that is a master, not a deliverable")
print(f"  {w}x{h}  {dur:.2f}s  {size/1e6:.1f} MB  {mbps:.1f} Mbps  {I} LUFS  {TP} dBTP")
if bad: print("FAIL: " + "; ".join(bad)); sys.exit(1)
print("  delivery OK")
PY

say "contact sheet"
S="$PROJ/renders/strip"; rm -rf "$S"; mkdir -p "$S"
ffmpeg -y -v error -i renders/final.mp4 -vf "fps=1,scale=216:-1" "$S/f%03d.png"
echo "  $(ls "$S" | wc -l) frames in $S — LOOK AT THEM. Three of the worst"
echo "  defects this channel has shipped were invisible in a still and obvious in a strip."

if [ "$SHIP" = 1 ]; then
  say "ship"
  mkdir -p "$OUT/source/hyperframes" "$OUT/source/artifacts"
  cp renders/final.mp4 "$OUT/${SLUG}_1080x1920.mp4"
  cp hyperframes/index.html "$OUT/source/hyperframes/"
  [ -d sim ] && { mkdir -p "$OUT/source/sim"; cp sim/*.py sim/*.json "$OUT/source/sim/" 2>/dev/null || true; }
  cp source-docs/*.md "$OUT/" 2>/dev/null || cp source-docs/*.md "$OUT/source/" 2>/dev/null || true
  cp artifacts/*.json "$OUT/source/artifacts/" 2>/dev/null || true
  echo "  -> $OUT/${SLUG}_1080x1920.mp4"
fi
say "done"
