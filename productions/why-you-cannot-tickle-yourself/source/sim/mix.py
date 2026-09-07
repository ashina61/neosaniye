"""
WHY YOU CANNOT TICKLE YOURSELF — the soundtrack.

The film's argument is a subtraction, so the soundtrack performs one.

Every touch is a synthesised brush of noise. Every prediction is THE SAME
WAVEFORM, INVERTED, placed at the instant the forward model says the touch will
land. The mix adds them together and lets the arithmetic happen:

    self touch      prediction at t, touch at t          -> they cancel; 12% left
    somebody else   no prediction at all                 -> the whole brush
    delayed touch   prediction at t, touch at t + 200ms  -> two separate events

Nothing here is mixed to taste. The reason you can hear the delayed strokes and
not the self strokes is that one pair sums to nearly zero and the other does
not, which is the claim the narration is making.
"""
import json, os, sys, numpy as np, soundfile as sf
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'ink-theater'))
from sfx import ui_click, place, SUBSCRIBE_TAP
from scipy.signal import butter, sosfilt, resample_poly, fftconvolve

SR  = 48000
EV  = json.load(open("events.json"))
DUR = EV["duration"]; NS = int(DUR * SR) + SR
rng = np.random.default_rng(31415)

def brush(dur, seed, bright=1.0):
    """A fingertip dragged across skin: filtered noise with a slow swell."""
    g = np.random.default_rng(seed)
    n = int(dur * SR); t = np.linspace(0, 1, n)
    x = g.normal(0, 1, n)
    sos = butter(2, [420 * bright / (SR/2), 5200 * bright / (SR/2)], btype="band", output="sos")
    x = sosfilt(sos, x)
    x *= np.sin(np.pi * t) ** 1.4                      # in and out, no clicks
    x *= 0.55 + 0.45 * np.sin(2*np.pi*2.1*t)           # the drag is not even
    return (x / (np.abs(x).max() + 1e-9)).astype(np.float32)

bed = np.zeros(NS, dtype=np.float32)
DELAY, RES = EV["delay"], EV["residue"]
log = []
for k, e in enumerate(EV["events"]):
    b = brush(e["dur"], 900 + k) * 0.62
    n = len(b)
    def put(at, sig):
        p = int(at * SR); bed[p:p+len(sig)] += sig
    if e["kind"] == "other":
        put(e["t"], b)                                  # nothing predicted it
        log.append((e["t"], "other", 1.00))
    elif e["kind"] == "self":
        put(e["t"], b)                                  # what arrived
        put(e["t"], -b * (1.0 - RES))                   # what was expected
        log.append((e["t"], "self", RES))
    else:                                               # delayed
        put(e["t"] + DELAY, b)                          # the touch, late
        put(e["t"], -b * (1.0 - RES))                   # the prediction, on time
        log.append((e["t"], "delayed", 1.00))

# the flinch: the only sound in the film that nothing predicted
for ft in EV["flinches"]:
    n = int(0.34 * SR); t = np.arange(n) / SR
    hit = (rng.normal(0, 1, n) * np.exp(-t / 0.028)
           + 0.7 * np.sin(2*np.pi*np.linspace(210, 74, n) * t) * np.exp(-t / 0.10))
    sos = butter(2, 6000/(SR/2), btype="low", output="sos")
    hit = sosfilt(sos, hit); hit /= np.abs(hit).max() + 1e-9
    p = int(ft * SR); bed[p:p+n] += hit * 0.72

# the room: a small dry space, and a floor of air so the silence is not digital
ir = rng.normal(0, 1, int(0.5*SR)) * np.exp(-np.arange(int(0.5*SR))/SR / 0.13)
ir[:int(0.006*SR)] *= 0.04
ir = sosfilt(butter(2, 4800/(SR/2), btype="low", output="sos"), ir)
ir /= np.sqrt((ir**2).sum())
bed = 0.88 * bed + 0.30 * fftconvolve(bed, ir)[:NS]
air = sosfilt(butter(2, 900/(SR/2), btype="low", output="sos"), rng.normal(0, 1, NS)) * 0.006

# A drone, and one note change. This film is the quiet one — video six was two
# hundred people shouting — so the score is a single held low fifth that opens a
# fourth when the mechanism is named, and nothing else.
t = np.arange(NS) / SR
def sw(t0, t1): return np.clip((t - t0) / (t1 - t0), 0, 1)
drone = (0.62 * np.sin(2*np.pi*55.00*t) + 0.34 * np.sin(2*np.pi*82.41*t)
         + 0.20 * np.sin(2*np.pi*110.0*t + 0.7))
drone += 0.26 * np.sin(2*np.pi*146.83*t) * sw(15.5, 18.5)          # opens at the mechanism
drone += 0.18 * np.sin(2*np.pi*220.00*t) * sw(41.5, 44.5) * (1 - sw(53.4, 57.0))
drone *= 0.052 * (sw(0.4, 2.2) * (1 - sw(59.5, 61.7)))
mix = bed + air + drone

# A button that does not click has not been pressed. The tap lands
# SUBSCRIBE_TAP seconds after InkBrand.subscribe()'s `at`. It goes into
# `mix`, NOT into `bed`: bed has already been summed into mix by this point,
# and adding to it here is a no-op that ships a silent button.
place(mix, SR, np.stack([ui_click(SR)]*2, axis=1) * 0.5, 58.5 + SUBSCRIBE_TAP)

# ── the voice ────────────────────────────────────────────────────────────
AT = EV["narration"]
vox = np.zeros(NS, dtype=np.float32)
for sid, at in AT.items():
    s, sr = sf.read(f"../assets/audio/{sid}.wav", dtype="float32")
    if s.ndim > 1: s = s.mean(1)
    s = resample_poly(s, SR, sr)
    p = int(at * SR); vox[p:p+len(s)] += s
vox *= 0.93 / (np.abs(vox).max() + 1e-9)

# the house duck: 0.86, keyed off the speech envelope and widened both ways so
# it opens before the first syllable and does not close inside a sentence
sm = np.convolve(np.abs(vox), np.ones(int(0.02*SR))/int(0.02*SR), mode="same")
key = np.clip(sm / (np.percentile(sm[sm > 1e-4], 70) + 1e-9), 0, 1) ** 0.5
key = np.clip(np.convolve(key, np.ones(int(0.30*SR)), mode="same") / (int(0.30*SR) * 0.22), 0, 1)
key = np.convolve(key, np.ones(int(0.16*SR))/int(0.16*SR), mode="same")
# ...except under the flinch and the strokes that are the POINT, where the bed
# is the argument and must come through
prot = np.zeros(NS)
for ft in EV["flinches"]:
    prot[int(ft*SR):int((ft+0.5)*SR)] = 1
for e in EV["events"]:
    if e["kind"] != "self":
        a = int(e["t"]*SR); b = int((e["t"] + e["dur"] + DELAY + 0.25) * SR)
        prot[a:b] = 1
prot = np.convolve(prot, np.ones(int(0.10*SR))/int(0.10*SR), mode="same")
mix *= (1.0 - 0.86 * key * (1 - 0.35 * prot))

out = np.stack([mix, mix], axis=1)[:int(DUR*SR)]
NT = out.shape[0]
out += np.stack([vox[:NT], vox[:NT]], axis=1)
out *= 0.90 / (np.abs(out).max() + 1e-9)
sf.write("../assets/audio/mix.wav", out, SR)

# ── the checks ───────────────────────────────────────────────────────────
band = butter(4, [300/(SR/2), 4000/(SR/2)], btype="band", output="sos")
sp = key[:NT] > 0.5
def rms(x): return float(np.sqrt((x**2).mean()) + 1e-12)
v = sosfilt(band, vox[:NT])[sp]; b = sosfilt(band, (out.mean(1) - vox[:NT]))[sp]
print(f"{DUR}s · peak {np.abs(out).max():.3f} · rms {np.sqrt((out**2).mean()):.4f}")
print(f"voice over bed, 300Hz-4kHz, while speaking: {20*np.log10(rms(v)/rms(b)):+.1f} dB")
print("does the subtraction actually happen? loudness of each stroke, as heard:")
raw = bed
for (tt, kind, exp) in log:
    a = int(tt*SR); z = int((tt + 1.9)*SR)
    print(f"   t={tt:5.2f}  {kind:8s}  rms {rms(raw[a:z])*1000:6.2f}  (expected share {exp:.2f})")
