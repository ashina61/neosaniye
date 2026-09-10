"""
WHAT THE SUNSET LEFT — the soundtrack.

The film's claim is subtractive: nothing is added to sunlight on its way to a
sunset, something is taken out of it. So the soundtrack is subtractive too.

THE BED LOSES ITS TOP END AS THE FILM RUNS. It opens as a bright afternoon --
air with some sparkle in it, two birds, and a shimmer of tiny high ticks that
is the scattering itself -- and from 28.6s a low-pass walks down from 13 kHz
to 1.1 kHz, so that by the last two lines there is nothing above about a
kilohertz left in the room. Nothing is faded and nothing is swapped: it is the
same bed with its short wavelengths removed, which is the same sentence the
picture is saying.

The birds stop before it does, because they do.

Everything is synthesised. Nothing here is sampled and nothing is licensed.
"""
import json, os, sys, numpy as np, soundfile as sf
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'ink-theater'))
from sfx import (place, room, reverb, pencil, ui_click, _band,
                 speech_key, voice_over_bed_db, DUCK, VOICE_PEAK, SUBSCRIBE_TAP)
from scipy.signal import resample_poly, butter, sosfilt

SR  = 48000
EV  = json.load(open("events.json"))
DUR = EV["duration"]; E = EV["events"]; CUT = EV["cuts"]
NS  = int(DUR * SR) + SR
rng = np.random.default_rng(9174)
t   = np.arange(NS) / SR

# Two buses, ducked differently: ambience takes the full house duck, the
# film's own events take a third of it. Video 9 learned that the hard way.
bed = np.zeros((NS, 2), dtype=np.float32)
fx  = np.zeros((NS, 2), dtype=np.float32)

# ── outside ──────────────────────────────────────────────────────────────
air = _band(rng.normal(0, 1, NS), SR, 130, 7000) * 0.250
air *= 0.70 + 0.30 * np.sin(2 * np.pi * 0.041 * t + 0.6)      # a breeze that breathes
bed += np.stack([air, np.roll(air, 211)], axis=1)
# one long gust, early, so the outside is a place and not a texture
n = int(4.2 * SR); u = np.arange(n) / SR
gust = _band(rng.normal(0, 1, n), SR, 180, 3200) * np.exp(-((u - 2.1) ** 2) / 1.6) * 0.360
place(bed[:, 0], SR, gust.astype(np.float32), 2.30)
place(bed[:, 1], SR, (gust * 0.86).astype(np.float32), 2.34)

# two birds, and they are done before the light is
def chirp(f0, n_blips):
    out = np.zeros(int(0.7 * SR), dtype=np.float32)
    for i in range(n_blips):
        d = int(0.070 * SR); v = np.arange(d) / SR
        f = f0 + 800 * np.sin(2 * np.pi * 11 * v) + i * 220
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-v / 0.019)
        place(out, SR, (s * 0.5).astype(np.float32), 0.13 * i)
    return out
for at, f0, k, pan in [(3.10, 3200, 3, 0.55), (17.90, 2900, 2, -0.45), (23.10, 3400, 3, 0.30)]:
    c = chirp(f0, k) * 0.92
    place(bed[:, 0], SR, c * (1 - pan) / 1.4, at)
    place(bed[:, 1], SR, c * (1 + pan) / 1.4, at + 0.004)

# ── the page drawing itself ──────────────────────────────────────────────
for i in range(9):
    p = pencil(SR, 0.20 + 0.055 * (i % 3)) * 0.175
    place(fx[:, 0], SR, p, 0.05 + i * 0.060)
    place(fx[:, 1], SR, p * 0.9, 0.05 + i * 0.060 + 0.006)
for at, d in [(CUT["rule"] + 0.10, 0.28), (CUT["rule"] + 0.22, 0.28)]:
    place(fx[:, 0], SR, pencil(SR, d) * 0.17, at)
    place(fx[:, 1], SR, pencil(SR, d) * 0.15, at + 0.005)

# ── THE SCATTERING, as a sound ───────────────────────────────────────────
# One tick per photon that turns out of the beam. They are 6-11 kHz, 4 ms
# long, and there are a few hundred of them: individually inaudible, together
# a shimmer sitting on top of the air. It is the only bright thing in the mix
# and the low-pass below is what happens to it.
def tick():
    d = int(0.006 * SR); v = np.arange(d) / SR
    return (_band(rng.normal(0, 1, d), SR, 6000, 11000) * np.exp(-v / 0.0013)).astype(np.float32)
BEAM_ON = [(E["beam_on"], 20.70), (24.60, 35.90)]     # only while the diagram is up
at = 0.0
while at < DUR:
    at += 0.028 + 0.055 * rng.random()
    if not any(a <= at <= b for a, b in BEAM_ON): continue
    g = 0.105 * (0.5 + rng.random())
    p = rng.random() * 2 - 1
    s = tick()
    place(fx[:, 0], SR, s * g * (1 - p) / 1.5, at)
    place(fx[:, 1], SR, s * g * (1 + p) / 1.5, at + 0.0008)

ir = room(SR, decay=0.22, size=0.55)          # outside: short, wide, almost dry
for ch in (0, 1):
    bed[:, ch] = reverb(bed[:, ch], ir, wet=0.13, dry=0.95)
    fx[:, ch]  = reverb(fx[:, ch],  ir, wet=0.17, dry=0.94)

# ══ THE DRAIN ════════════════════════════════════════════════════════════
# A low-pass that walks from 13 kHz down to 1.1 kHz between 28.6s and 44.0s,
# applied to the bed and the shimmer and to nothing else. Done as a crossfade
# between four fixed-corner copies rather than a swept filter, because a swept
# IIR rings and this has to be inaudible as an effect and obvious as a change.
CORNERS = [13000, 5200, 2400, 1100]
def lp(x, fc):
    sos = butter(4, min(fc, SR * 0.45) / (SR / 2), btype="low", output="sos")
    return sosfilt(sos, x, axis=0).astype(np.float32)
D0, D1 = 28.60, 44.00
w = np.clip((t - D0) / (D1 - D0), 0, 1) ** 0.85          # 0 = bright, 1 = dark
seat = w * (len(CORNERS) - 1)
def drain(buf):
    out = np.zeros_like(buf)
    copies = [lp(buf, f) for f in CORNERS]
    for k in range(len(CORNERS) - 1):
        m = np.clip(1 - np.abs(seat - k), 0, 1)[:, None]
        out += copies[k] * m
    m = np.clip(1 - np.abs(seat - (len(CORNERS) - 1)), 0, 1)[:, None]
    out += copies[-1] * m
    return out
bed = drain(bed)
fx  = drain(fx)

place(fx, SR, np.stack([ui_click(SR)] * 2, axis=1) * 0.5,
      EV["subscribe_at"] + SUBSCRIBE_TAP)

# ── the voice, untouched ─────────────────────────────────────────────────
def rms(x): return float(np.sqrt((x ** 2).mean()) + 1e-12)
vox = np.zeros(NS, dtype=np.float32)
for sid, at in EV["narration"].items():
    s, sr = sf.read(f"../assets/audio/{sid}.wav", dtype="float32")
    if s.ndim > 1: s = s.mean(1)
    s = resample_poly(s, SR, sr).astype(np.float32)
    p = int(at * SR); vox[p:p + len(s)] += s
vox *= VOICE_PEAK / (np.abs(vox).max() + 1e-9)

key = speech_key(vox, SR)
FX_DUCK = 0.34
mix = bed.copy()
mix *= (1.0 - DUCK * key)[:, None]
mix += fx * (1.0 - FX_DUCK * key)[:, None]
mix += np.stack([vox, vox], axis=1)

mix = mix[:int(DUR * SR)]

# ── the delivery peak, which this film got wrong first time ──────────────
# bin/build-ink.sh normalises to -14 LUFS with `linear=true`, so there is no
# limiter downstream: the delivered true peak is decided HERE, by the mix's
# crest factor, and nothing about scaling this file changes it. The first pass
# came out at -0.57 dBTP against a house ceiling of -1.0 and cost a five and a
# half minute render to find out. A shimmer of thousands of 4 ms ticks is a lot
# of isolated transients; softening them costs nothing audible and buys the
# 1.5 dB back.
TH = 0.50
a = np.abs(mix); over = a > TH
mix[over] = np.sign(mix[over]) * (TH + (1 - TH) * np.tanh((a[over] - TH) / (1 - TH)))
mix *= 0.90 / (np.abs(mix).max() + 1e-9)
sf.write("../assets/audio/mix.wav", mix, SR)

db = voice_over_bed_db(mix.mean(1), vox[:len(mix)], key[:len(mix)], SR)
print(f"{DUR:.2f}s · peak {np.abs(mix).max():.3f} · rms {rms(mix):.4f}")
print(f"voice over outside, 300Hz-4kHz, while speaking: {db:+.1f} dB")

# The drain has to be measurable or it is a story I told myself. Compare the
# bed alone (no voice) early against late, above 4 kHz.
def top(b, a0, a1):
    seg = b[int(a0 * SR):int(a1 * SR)].mean(1)
    return 20 * np.log10(rms(_band(seg, SR, 4000, 14000)) / (rms(seg) + 1e-12))
early, late = top(bed, 2.0, 12.0), top(bed, 39.0, 46.0)
print(f"bed above 4kHz · afternoon {early:+.1f} dB · dusk {late:+.1f} dB "
      f"· drained {early-late:+.1f} dB")
# THE DELIVERED TRUE PEAK, measured rather than modelled. bin/build-ink.sh
# normalises to -14 LUFS with `linear=true` and no limiter after it, so the
# peak that ships is decided by this file's crest factor plus whatever the AAC
# encoder overshoots by -- and on a mix full of 4 ms ticks that overshoot was
# 1.4 dB, which is what put the first pass at -0.57 against a ceiling of -1.0.
#
# Modelling it from input_tp is wrong twice over (loudnorm is TP-limited, and
# the codec adds inter-sample peaks the filter never sees), so this runs the
# actual delivery chain on the audio alone. Two seconds here against a five and
# a half minute render.
import subprocess, tempfile
def measure(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af",
                        "loudnorm=I=-14:TP=-2.0:LRA=11:print_format=json",
                        "-f", "null", "-"], capture_output=True, text=True).stderr
    return json.loads(r[r.rindex("{"):r.rindex("}") + 1])
_in = measure("../assets/audio/mix.wav")
_meas = ":".join(f"measured_{k}={_in['input_' + k]}" for k in ("i", "tp", "lra", "thresh")) \
        + f":offset={_in['target_offset']}"
with tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as _f: _tmp = _f.name
subprocess.run(["ffmpeg", "-y", "-hide_banner", "-v", "error", "-i", "../assets/audio/mix.wav",
                "-af", f"loudnorm=I=-14:TP=-2.0:LRA=11:{_meas}:linear=true,aresample=48000",
                "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", _tmp], check=True)
_out = measure(_tmp); os.unlink(_tmp)
_I, _TP = float(_out["input_i"]), float(_out["input_tp"])
print(f"delivered {_I:+.2f} LUFS · {_TP:+.2f} dBTP  (house: -14 +/-1, TP <= -1.0)")

if not (db >= 10): raise SystemExit("voice is not clear of the bed")
if _TP > -1.0: raise SystemExit(
    f"delivered peak {_TP:+.2f} dBTP is over the house ceiling of -1.0 - soften the "
    "transients (a soft knee on the loudest few percent), do not scale the file: "
    "loudnorm undoes any scaling you do")
if not (early - late >= 12): raise SystemExit("the bed did not lose its blue")
