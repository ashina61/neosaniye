"""
NOBODY IS CONDUCTING — the soundtrack.

Every clap you hear is one oscillator in kuramoto.py crossing a whole turn, at
the frame it crossed. The picture is drawn from the same array. Nothing is
sequenced by hand and there is no sample library: the applause is synthesised
one clap at a time, put in a seat, and sent through a hall.

The only tonal element is a low pad whose amplitude is the Kuramoto order
parameter r — so the pad is literally the sound of the room agreeing, and it
cannot be heard while the room disagrees. That is the whole score.
"""
import json, os, sys, numpy as np, soundfile as sf
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'ink-theater'))
from sfx import ui_click, place, SUBSCRIBE_TAP
from scipy.signal import fftconvolve, resample_poly, butter, sosfilt

SR   = 48000
SIM  = json.load(open("claps.json"))
FPS  = SIM["fps"]; DUR = SIM["duration"]; N = SIM["n"]
NS   = int(DUR * SR) + SR                       # a second of tail for the hall
rng  = np.random.default_rng(4242)

# ── seats ────────────────────────────────────────────────────────────────
# The same 8x15 house the composition draws. Depth sets level; the seat's
# position across the hall sets the pan.
# Eight rows of fourteen in the stalls, eight more in the balcony: the same
# 120 seats the composition draws, so a clap you hear on the left is a pair of
# hands moving on the left.
ROWS, COLS = 8, 14
row = np.minimum(np.arange(N) // COLS, ROWS)            # 8 = the balcony
col = np.where(np.arange(N) < ROWS*COLS, np.arange(N) % COLS, (np.arange(N)-ROWS*COLS)*13/7)
depth = np.where(np.arange(N) < ROWS*COLS, 1.0 / (1.0 + 0.20 * row), 0.52)
panx  = (col - (COLS - 1) / 2) / ((COLS - 1) / 2) * 0.62 * depth
gain  = depth * (0.72 + 0.56 * rng.random(N))

# ── eight pairs of hands ─────────────────────────────────────────────────
def clap_sample(f0, q, tau, thump):
    n = int(0.14 * SR); t = np.arange(n) / SR
    x = rng.normal(0, 1, n) * np.exp(-t / tau)
    sos = butter(2, [max(200, f0/q)/(SR/2), min(7800, f0*q)/(SR/2)], btype="band", output="sos")
    x = sosfilt(sos, x)
    x += thump * np.sin(2*np.pi*np.linspace(190, 120, n)*t) * np.exp(-t / 0.016)
    x[:12] *= np.linspace(0, 1, 12)                      # no click on the attack
    return (x / (np.abs(x).max() + 1e-9)).astype(np.float32)

TIMBRES = [clap_sample(f0, q, tau, th) for f0, q, tau, th in [
    (1150, 2.6, 0.017, 0.28), (1600, 2.2, 0.013, 0.20), ( 900, 3.0, 0.024, 0.34),
    (2050, 1.9, 0.011, 0.15), (1350, 2.4, 0.020, 0.26), (1800, 2.1, 0.015, 0.18),
    (1000, 2.8, 0.028, 0.31), (2400, 1.8, 0.010, 0.12)]]
who = rng.integers(0, len(TIMBRES), N)

# ── every clap, in its seat ──────────────────────────────────────────────
dry = np.zeros((NS, 2), dtype=np.float32)
nclap = 0
for tsec, i, _al in SIM["exact"]:
        s = TIMBRES[who[i]]
        # the instant the phase crossed, not the frame it was drawn on
        p = int(tsec * SR)
        g = gain[i] * (0.86 + 0.28 * rng.random())
        L = g * np.sqrt(0.5 * (1 - panx[i])); R = g * np.sqrt(0.5 * (1 + panx[i]))
        dry[p:p+len(s), 0] += s * L
        dry[p:p+len(s), 1] += s * R
        nclap += 1

# ── the hall ─────────────────────────────────────────────────────────────
def impulse(tau, seed):
    g = np.random.default_rng(seed)
    n = int(1.7 * SR); t = np.arange(n) / SR
    ir = g.normal(0, 1, n) * np.exp(-t / tau)
    ir[:int(0.010 * SR)] *= 0.05                          # keep the direct sound dry
    for d, a in [(0.017, 0.55), (0.029, 0.40), (0.041, 0.30), (0.067, 0.22)]:
        ir[int(d*SR)] += a                                # early reflections
    sos = butter(2, 5200/(SR/2), btype="low", output="sos")
    return (sosfilt(sos, ir) / np.sqrt((ir**2).sum())).astype(np.float32)

# A long tail is the enemy here: at two claps a second the beat period is 500ms,
# and a 440ms hall fills every gap between beats until the rhythm is inaudible.
# Short room, mostly dry.
wet = np.stack([fftconvolve(dry[:, 0], impulse(0.26, 11))[:NS],
                fftconvolve(dry[:, 1], impulse(0.28, 12))[:NS]], axis=1)
bed = 0.86 * dry + 0.34 * wet

# the room halves its rate, so half as many hands land per second. Real
# rhythmic applause does not get quieter, so give the level back.
rate = np.array(SIM["rate"])
comp = np.interp(np.arange(NS)/SR, np.arange(len(rate))/FPS, np.sqrt(4.0/rate))
env  = np.clip((np.arange(NS)/SR - 0.20) / 1.00, 0, 1)                   # in
env *= np.clip((DUR - np.arange(NS)/SR) / 2.6, 0, 1)                     # out
bed *= (comp * env)[:, None]
bed /= (np.abs(bed).max() + 1e-9)

# ── the pad: amplitude IS the order parameter ────────────────────────────
r  = np.array(SIM["r"])
rr = np.interp(np.arange(NS)/SR, np.arange(len(r))/FPS, r)
rr = np.convolve(rr, np.ones(SR//2)/(SR//2), mode="same")                # no zipper
t  = np.arange(NS) / SR
pad = np.zeros(NS, dtype=np.float32)
for f, a, dt_ in [(55.0, 1.00, 0.0), (82.5, 0.42, 0.11), (110.0, 0.55, -0.07),
                  (164.81, 0.24, 0.05)]:
    pad += a * np.sin(2*np.pi*(f + dt_)*t + f)
pad += 0.10 * np.sin(2*np.pi*440*t) * np.clip(rr, 0, 1)**3               # it opens up
pad *= 0.105 * np.clip(rr, 0, 1)**1.6 * env
mix = bed + np.stack([pad, pad], axis=1)

# A button that does not click has not been pressed. The tap lands
# SUBSCRIBE_TAP seconds after InkBrand.subscribe()'s `at`.
place(bed, SR, ui_click(SR) * 0.5, 58.55 + SUBSCRIBE_TAP)

# ── the voice ────────────────────────────────────────────────────────────
AT = {"s01":2.40,"s02":4.40,"s03":7.60,"s04":11.90,"s05":15.90,"s06":20.55,
      "s07":22.75,"s08":26.20,"s09":30.75,"s10":36.05,"s11":39.30,"s12":45.35,
      "s13":50.35,"s14":54.75}
vox = np.zeros(NS, dtype=np.float32)
for sid, at in AT.items():
    s, sr = sf.read(f"../assets/audio/{sid}.wav", dtype="float32")
    if s.ndim > 1: s = s.mean(1)
    s = resample_poly(s, SR, sr)
    p = int(at * SR); vox[p:p+len(s)] += s
vox *= 0.93 / (np.abs(vox).max() + 1e-9)

# Duck the room under the voice. The first cut used 0.40 — four and a half
# decibels — and the narration was inaudible under two hundred and forty claps
# a second. A dense broadband bed needs FOURTEEN, and it needs to open early
# and close late or the first syllable of every line is eaten.
#
# The gate is built from the speech envelope: fast attack (30ms) so it is
# already down before the word arrives, slow release (400ms) so it never pumps
# between words inside a sentence.
sm = np.convolve(np.abs(vox), np.ones(int(0.02*SR))/int(0.02*SR), mode="same")
key = np.clip(sm / (np.percentile(sm[sm > 1e-4], 70) + 1e-9), 0, 1) ** 0.5
# widen the key both ways so the duck is open before the word and stays open
# across the gaps inside a sentence
wide = np.maximum(np.convolve(key, np.ones(int(0.30*SR)), mode="same"), 0)
key = np.clip(wide / (int(0.30*SR) * 0.22), 0, 1)
key = np.convolve(key, np.ones(int(0.16*SR))/int(0.16*SR), mode="same")
DUCK = 0.86                                               # 17 dB. Measured, not guessed — see the check at the bottom.
mix *= (1.0 - DUCK * key)[:, None]
mix += np.stack([vox, vox], axis=1)

mix = mix[:int(DUR * SR)]
mix *= 0.90 / (np.abs(mix).max() + 1e-9)
sf.write("../assets/audio/mix.wav", mix, SR)

# Is the voice actually above the room? Measure it, in the band the voice lives
# in, over the frames where somebody is speaking. Broadcast practice wants the
# dialogue 10-15 dB over the bed; under about 8 it starts costing you words.
from scipy.signal import sosfilt as _sf, butter as _bt
band = _bt(4, [300/(SR/2), 4000/(SR/2)], btype="band", output="sos")
NT = mix.shape[0]
speech = key[:NT] > 0.5
def rms(x): return float(np.sqrt((x**2).mean()) + 1e-12)
v = _sf(band, vox[:NT])[speech]
b = _sf(band, (mix.mean(1) - vox[:NT]))[speech]
print(f"{nclap} claps · {DUR}s · peak {np.abs(mix).max():.3f} · rms {np.sqrt((mix**2).mean()):.4f}")
print(f"voice over room, 300Hz-4kHz, while speaking: {20*np.log10(rms(v)/rms(b)):+.1f} dB")
