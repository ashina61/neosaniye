"""
BUTTER SIDE DOWN — the soundtrack.

The argument of this film is which way up a thing lands, and the punchline is
carried by two sounds: a **wet slap** and a **dry clack**. Everything else in
the mix exists to set those two up. When the toast turns 190 degrees you hear
butter hit tile; when it turns 380 you hear crust. Nothing has to say so.

Everything is synthesised in numpy from ink-theater/sfx.py — no library, no
licence, no key — and the fall sounds are driven by the same physics the picture
uses: a whoosh whose pitch and level rise with sqrt(2gh), for exactly as long as
the fall actually takes.
"""
import json, sys, os, numpy as np, soundfile as sf
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "ink-theater"))
from sfx import (ui_click, thud, clack, scrape, pencil, tone, room, reverb, place,
                 speech_key, voice_over_bed_db, DUCK, VOICE_PEAK, SUBSCRIBE_TAP, _band, _n)
from scipy.signal import butter, sosfilt, resample_poly

SR  = 48000
EV  = json.load(open(os.path.join(os.path.dirname(__file__), "events.json")))
P   = EV["physics"]; DUR = EV["duration"]; NS = int(DUR * SR) + SR
rng = np.random.default_rng(1848)
here = os.path.dirname(__file__)

def fall_time(h): return float(np.sqrt(2 * h / P["g"]))

# ── the two landings the whole film is built to deliver ──────────────────
def wet_slap(sr):
    """Butter, on a hard floor. A low body with almost no ring, and a short
    damped mid burst on top — the damping is what makes it sound WET, and it is
    the difference between the two punchlines."""
    n = int(0.60 * sr); t = np.arange(n) / sr
    body = np.sin(2 * np.pi * np.linspace(150, 52, n) * t) * np.exp(-t / 0.055)
    splat = _band(rng.normal(0, 1, n), sr, 320, 1900) * np.exp(-t / 0.022)
    stick = _band(rng.normal(0, 1, n), sr, 90, 420) * np.exp(-t / 0.085) * 0.5
    x = body * 1.0 + splat * 0.85 + stick
    x[:5] *= np.linspace(0, 1, 5)
    return _n(x)

def dry_clack(sr):
    """Crust, on the same floor. It rings, and it is up an octave."""
    x = clack(sr, f0=1350, tau=0.055)
    n = len(x); t = np.arange(n) / sr
    x = x + 0.4 * np.sin(2 * np.pi * 480 * t) * np.exp(-t / 0.09)
    return _n(x)

def soft_land(sr):
    a = wet_slap(sr) * 0.5; b = thud(sr, f0=64, tau=0.18, bright=0.2) * 0.6
    n = max(len(a), len(b)); o = np.zeros(n, dtype=np.float32)
    o[:len(a)] += a; o[:len(b)] += b
    return _n(o)

def fall_air(sr, dur, h):
    """Air past a tumbling slice. It gets louder and brighter as it speeds up,
    and it flutters once per half turn because the thing is rotating."""
    n = int(dur * sr); t = np.linspace(0, 1, n)
    v = np.sqrt(t)                                     # speed goes as sqrt(fall)
    x = _band(rng.normal(0, 1, n), sr, 240, 1200 + 2600 * h)
    turns = P["omega_rad_s"] * fall_time(h) / (2 * np.pi)
    x *= (0.62 + 0.38 * np.sin(2 * np.pi * turns * 2 * t))   # the tumble
    x *= v ** 2
    x[-int(0.004 * sr):] *= np.linspace(1, 0, int(0.004 * sr))
    return _n(x)

bed = np.zeros(NS, dtype=np.float32)
LAND = {"wet": wet_slap(SR), "dry": dry_clack(SR), "soft": soft_land(SR)}
LGAIN = {"wet": 0.95, "dry": 0.80, "soft": 0.34}

log = []
for d in EV["drops"]:
    ft = fall_time(d["h"]) / d["rate"]                  # slow motion stretches it
    # the toast comes off the edge: a plate tick, a slide, and the pivot
    place(bed, SR, clack(SR, f0=2200, tau=0.020) * 0.30, d["t"] - 0.30)
    place(bed, SR, scrape(SR, dur=0.26, lo=900, hi=6000) * 0.26, d["t"] - 0.26)
    place(bed, SR, clack(SR, f0=760, tau=0.030) * 0.28, d["t"] - 0.02)
    air = fall_air(SR, ft, d["h"]) * (0.30 if d["rate"] < 1 else 0.40)
    place(bed, SR, air, d["t"])
    place(bed, SR, LAND[d["land"]], d["t"] + ft, LGAIN[d["land"]])
    log.append((round(d["t"] + ft, 2), d["land"], round(ft, 2)))

# the click on the subscribe tap — it is a button, and a button that does not
# click has not been pressed
place(bed, SR, ui_click(SR) * 0.55, EV["subscribe_at"] + SUBSCRIBE_TAP)

# a kitchen, and a floor of air so the silence is not digital
IR = room(SR, decay=0.30, size=0.7, seed=55)
bed = reverb(bed, IR, wet=0.26, dry=0.90)
air_floor = sosfilt(butter(2, 700 / (SR / 2), btype="low", output="sos"),
                    rng.normal(0, 1, NS)) * 0.0055

# ── the score ────────────────────────────────────────────────────────────
# A low pedal that drops a fifth when the film stops being about toast and
# starts being about atoms, and a single struck note on the last line.
t = np.arange(NS) / SR
def sw(a, b): return np.clip((t - a) / (b - a), 0, 1)
pedal = (0.60 * np.sin(2 * np.pi * 73.42 * t) + 0.30 * np.sin(2 * np.pi * 110.0 * t + 0.4)
         + 0.16 * np.sin(2 * np.pi * 146.83 * t + 1.1))
pedal *= (1 - sw(40.2, 42.4))
deep = (0.60 * np.sin(2 * np.pi * 48.99 * t) + 0.28 * np.sin(2 * np.pi * 73.42 * t + 0.9)
        + 0.14 * np.sin(2 * np.pi * 97.99 * t))
deep *= sw(40.2, 42.4)
score = (pedal + deep) * 0.058 * sw(0.3, 2.0) * (1 - sw(58.9, 60.9))
place(bed, SR, tone(SR, 4.0, 195.998, (1.0, 0.34, 0.12), tau=1.6) * 0.10, 52.60)
mix = bed + air_floor + score

# ── the voice ────────────────────────────────────────────────────────────
vox = np.zeros(NS, dtype=np.float32)
for sid, at in EV["narration"].items():
    s, sr = sf.read(os.path.join(here, "..", "assets", "audio", sid + ".wav"), dtype="float32")
    if s.ndim > 1: s = s.mean(1)
    place(vox, SR, resample_poly(s, SR, sr).astype(np.float32), at)
vox *= VOICE_PEAK / (np.abs(vox).max() + 1e-9)

key = speech_key(vox, SR)
# the landings are the argument and must not be ducked into the carpet
prot = np.zeros(NS)
for d in EV["drops"]:
    a = d["t"] - 0.35; b = d["t"] + fall_time(d["h"]) / d["rate"] + 0.70
    prot[int(a * SR):int(b * SR)] = 1
prot[int((EV["subscribe_at"] + SUBSCRIBE_TAP - 0.1) * SR):int((EV["subscribe_at"] + SUBSCRIBE_TAP + 0.4) * SR)] = 1
prot = np.convolve(prot, np.ones(int(0.10 * SR)) / int(0.10 * SR), mode="same")
mix *= (1.0 - DUCK * key * (1 - 0.40 * prot))

out = np.stack([mix, mix], axis=1)[:int(DUR * SR)]
NT = out.shape[0]
out += np.stack([vox[:NT], vox[:NT]], axis=1)
out *= 0.90 / (np.abs(out).max() + 1e-9)
sf.write(os.path.join(here, "..", "assets", "audio", "mix.wav"), out, SR)

db = voice_over_bed_db(out.mean(1), vox[:NT], key[:NT], SR)
print(f"{DUR}s · peak {np.abs(out).max():.3f} · rms {np.sqrt((out**2).mean()):.4f}")
print(f"voice over bed, 300Hz-4kHz, while speaking: {db:+.1f} dB")
print("the landings, and how far apart the two punchlines are:")
def rms(a, b):
    s = out.mean(1)[int(a * SR):int(b * SR)]; return float(np.sqrt((s ** 2).mean())) * 1000
for (tt, kind, ft) in log:
    print(f"   t={tt:5.2f}  {kind:5s}  fall {ft:4.2f}s   rms {rms(tt, tt + 0.45):6.1f}")
