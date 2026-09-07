"""
BIRDS AND THE WIRE — the soundtrack.

The film's rule is that its accent does not exist until there is a potential
difference. The soundtrack keeps the same rule, in the one place sound can:
THE WIRE HUMS FROM THE FIRST FRAME AND NOTHING ELSE DOES. Fifty hertz and its
harmonics, quiet, steady, going nowhere — the sound of eleven thousand volts
sitting there with nothing to flow into. It is not a drone under the film, it
is the subject, held.

Then a step appears, and the hum grows a hundred-hertz buzz it did not have.
Nothing is added to the mix at that moment: the same oscillator opens. The
buzz IS the difference, the way the red line is.

Three events on top, all synthesised: two chirps, a ball that accelerates down
a step, and one crackle. Nothing is sampled and nothing is licensed.
"""
import json, os, sys, numpy as np, soundfile as sf
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'ink-theater'))
from sfx import (place, room, reverb, pencil, thud, ui_click, _band,
                 speech_key, voice_over_bed_db, DUCK, VOICE_PEAK, SUBSCRIBE_TAP)
from scipy.signal import resample_poly

SR  = 48000
EV  = json.load(open("events.json"))
DUR = EV["duration"]; E = EV["events"]
NS  = int(DUR * SR) + SR
rng = np.random.default_rng(1149)
t   = np.arange(NS) / SR

# TWO BUSES, DUCKED DIFFERENTLY, and this is the correction the first mix
# needed. `bed` is ambience — the hum and the street — and it takes the full
# house duck, so it breathes in the gaps and never competes with a word. `fx`
# is the events the FILM is making: the arc, the ball, the chirps. Ducking
# those at 0.86 buried the loudest moment in the film under a sentence,
# because the crackle happens while he is still talking. Measured on the first
# pass: voice +29.1 dB, which is not a clear mix, it is a silent one.
bed = np.zeros((NS, 2), dtype=np.float32)
fx  = np.zeros((NS, 2), dtype=np.float32)

# ── the wire ─────────────────────────────────────────────────────────────
# LEVEL, MEASURED RATHER THAN CHOSEN. Nearly pure 50 Hz is felt long before it
# is heard, so the house check — which only looks at 300 Hz to 4 kHz — says
# nothing useful about it. The number that matters is what the bed does BETWEEN
# the lines: at 0.29 it sat at -15.6 dBFS, five decibels ABOVE the narration,
# and the film was a hum with a man talking over it. This sits it about ten
# below instead: it sits 5.4 dB under the narration broadband and 22.4 dB
# under it inside the speech band — present in every gap, never the thing you
# are listening to.
# 50 Hz and harmonics. The buzz partials are there from the first sample at
# zero amplitude and open on `hum_open`: the film does not gain a sound, it
# stops subtracting one.
OPEN = E["hum_open"]
buzz = np.clip((t - OPEN) / 0.55, 0, 1) ** 0.7
hum = np.zeros(NS, dtype=np.float32)
for f, a in [(50.0, 1.00), (100.0, 0.30), (150.0, 0.16), (200.0, 0.07)]:
    hum += a * np.sin(2 * np.pi * f * t + f * 0.13)
for f, a in [(100.0, 0.42), (300.0, 0.30), (500.0, 0.16), (700.0, 0.09)]:
    hum += a * buzz * np.sin(2 * np.pi * f * t + f * 0.07)
# it dies with the film, not on a cut
hum *= 0.082 * np.clip(t / 1.2, 0, 1) * (1 - np.clip((t - (DUR - 1.6)) / 1.6, 0, 1))
bed += np.stack([hum * 0.94, hum], axis=1)

# ── the street ───────────────────────────────────────────────────────────
air = _band(rng.normal(0, 1, NS), SR, 120, 1800) * 0.022
air *= 0.7 + 0.3 * np.sin(2 * np.pi * 0.06 * t)          # it breathes
bed += np.stack([air, np.roll(air, 91)], axis=1)
for at, pan in [(4.6, -0.5), (24.2, 0.6)]:               # two cars, far off
    n = int(3.2 * SR); u = np.arange(n) / SR
    car = _band(rng.normal(0, 1, n), SR, 90, 700) * np.exp(-((u - 1.6) ** 2) / 0.9) * 0.042
    place(bed[:, 0], SR, car * (1 - pan) / 2 * 2, at)
    place(bed[:, 1], SR, car * (1 + pan) / 2 * 2, at)

# ── the bird ─────────────────────────────────────────────────────────────
def chirp(n_blips=3):
    out = np.zeros(int(0.62 * SR), dtype=np.float32)
    for i in range(n_blips):
        d = int(0.075 * SR); u = np.arange(d) / SR
        f = 3100 + 900 * np.sin(2 * np.pi * 9 * u) + i * 260
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-u / 0.020)
        place(out, SR, (s * 0.5).astype(np.float32), 0.14 * i)
    return out
for at in E["chirp"]:
    c = chirp()
    place(fx[:, 0], SR, c * 0.34, at)
    place(fx[:, 1], SR, c * 0.30, at + 0.004)

# ── the page drawing itself ──────────────────────────────────────────────
for i in range(9):
    p = pencil(SR, 0.20 + 0.06 * (i % 3)) * 0.19
    place(fx[:, 0], SR, p, 0.06 + i * 0.115)
    place(fx[:, 1], SR, p * 0.9, 0.06 + i * 0.115 + 0.006)

# ── the ball, which only makes a sound when there is a slope ─────────────
# Its pitch and level follow the same s = f^2 the picture uses, so the sound
# accelerates with the drawing rather than beside it.
R0, RD = E["roll_at"], E["roll_dur"]
n = int(RD * SR); u = np.arange(n) / SR; f = u / RD
roll = _band(rng.normal(0, 1, n), SR, 60, 900) * (f ** 1.4) * 0.30
roll += 0.35 * (f ** 1.6) * np.sin(2 * np.pi * (70 + 120 * f) * u) * 0.30
place(fx[:, 0], SR, roll.astype(np.float32), R0)
place(fx[:, 1], SR, (roll * 0.92).astype(np.float32), R0 + 0.003)
place(fx[:, 0], SR, thud(SR, f0=74, tau=0.16) * 0.30, R0 + RD)
place(fx[:, 1], SR, thud(SR, f0=74, tau=0.16) * 0.28, R0 + RD)

# ── the arc: the one loud thing in the film ──────────────────────────────
A0 = E["arc_at"]
n = int(0.85 * SR); u = np.arange(n) / SR
crack = np.zeros(n, dtype=np.float32)
for k in range(26):                                   # a crackle is many snaps
    at = (k / 26.0) ** 1.5 * 0.62
    d = int(0.03 * SR); v = np.arange(d) / SR
    s = _band(rng.normal(0, 1, d), SR, 900, 9000) * np.exp(-v / 0.004)
    place(crack, SR, (s * (0.9 - 0.55 * (k / 26.0))).astype(np.float32), at)
crack += _band(rng.normal(0, 1, n), SR, 200, 3000) * np.exp(-u / 0.16) * 0.45
place(fx[:, 0], SR, crack * 0.52, A0)
place(fx[:, 1], SR, crack * 0.48, A0 + 0.002)
place(fx[:, 0], SR, thud(SR, f0=58, tau=0.30, bright=0.2) * 0.42, A0)
place(fx[:, 1], SR, thud(SR, f0=58, tau=0.30, bright=0.2) * 0.40, A0)

# a small room, mostly dry: a street is not a hall, and a long tail would
# smear the crackle into the last line
ir = room(SR, decay=0.19, size=0.35)
for ch in (0, 1):
    bed[:, ch] = reverb(bed[:, ch], ir, wet=0.16, dry=0.94)
    fx[:, ch] = reverb(fx[:, ch], ir, wet=0.20, dry=0.94)

mix = bed.copy()

# A button that does not click has not been pressed. Into `mix`, NOT `bed`:
# bed has already been summed here, and adding to it is a silent no-op.
place(fx, SR, np.stack([ui_click(SR)] * 2, axis=1) * 0.5,
      EV["subscribe_at"] + SUBSCRIBE_TAP)

# ── the voice ────────────────────────────────────────────────────────────
vox = np.zeros(NS, dtype=np.float32)
for sid, at in EV["narration"].items():
    s, sr = sf.read(f"../assets/audio/{sid}.wav", dtype="float32")
    if s.ndim > 1: s = s.mean(1)
    s = resample_poly(s, SR, sr)
    p = int(at * SR); vox[p:p + len(s)] += s
vox *= VOICE_PEAK / (np.abs(vox).max() + 1e-9)

key = speech_key(vox, SR)
FX_DUCK = 0.34                       # enough to keep words clear, not enough
                                     # to swallow the one bang in the film
mix *= (1.0 - DUCK * key)[:, None]
mix += fx * (1.0 - FX_DUCK * key)[:, None]
mix += np.stack([vox, vox], axis=1)

mix = mix[:int(DUR * SR)]
mix *= 0.90 / (np.abs(mix).max() + 1e-9)
sf.write("../assets/audio/mix.wav", mix, SR)

db = voice_over_bed_db(mix.mean(1), vox[:len(mix)], key[:len(mix)], SR)
print(f"{DUR:.2f}s · peak {np.abs(mix).max():.3f} · rms {np.sqrt((mix**2).mean()):.4f}")
print(f"voice over street, 300Hz-4kHz, while speaking: {db:+.1f} dB")
# the hum lives under 700 Hz, which the house check does not look at, so the
# wire's own level gets its own number: what the bed does between the lines.
sp = key[:len(mix)] > 0.5
gap = ~sp
bedrms = float(np.sqrt((mix.mean(1)[gap] ** 2).mean()))
voxrms = float(np.sqrt((vox[:len(mix)][sp] ** 2).mean()))
print(f"wire between the lines: {20*np.log10(bedrms + 1e-12):+.1f} dBFS "
      f"· voice {20*np.log10(voxrms + 1e-12):+.1f} dBFS "
      f"· gap {20*np.log10(voxrms / (bedrms + 1e-12)):+.1f} dB")
if not (db >= 10): raise SystemExit("voice is not clear of the bed")
