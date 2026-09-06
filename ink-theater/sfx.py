"""
Ink Theater — SOUND EFFECTS, synthesised.

No sample library, no licence, no key. Every sound this channel makes is built
out of noise and sine waves in numpy, which means it is deterministic, it is
free, and it can be driven from the same numbers that drive the picture.

    from sfx import ui_click, thud, scrape, whoosh, pencil, clack, place
    bed = np.zeros(N)
    place(bed, SR, ui_click(SR), 58.5 + SUBSCRIBE_TAP)

Everything returns a mono float32 array normalised to 1.0. Scale it yourself.
"""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

def _n(x):
    x = np.asarray(x, dtype=np.float32)
    return (x / (np.abs(x).max() + 1e-9)).astype(np.float32)

def _band(x, sr, lo, hi, order=2):
    lo = max(20.0, min(lo, sr / 2 - 200)); hi = max(lo + 50, min(hi, sr / 2 - 100))
    return sosfilt(butter(order, [lo / (sr / 2), hi / (sr / 2)], btype="band", output="sos"), x)

def place(buf, sr, sig, at, gain=1.0):
    """Add `sig` into `buf` at `at` seconds. Clips at the end rather than throwing."""
    p = int(at * sr)
    if p >= len(buf) or p < 0: return
    n = min(len(sig), len(buf) - p)
    buf[p:p + n] += sig[:n] * gain

# ── the interface ────────────────────────────────────────────────────────
def ui_click(sr, bright=1.0):
    """A tap on something. Two very short transients — the press and the tiny
    release a few milliseconds later — because one click on its own sounds like
    a fault rather than a button."""
    g = np.random.default_rng(7)
    def tick(dur, f0, tau):
        n = int(dur * sr); t = np.arange(n) / sr
        x = g.normal(0, 1, n) * np.exp(-t / tau)
        x = _band(x, sr, f0 * 0.55, f0 * 2.6)
        x += 0.5 * np.sin(2 * np.pi * f0 * t) * np.exp(-t / (tau * 0.7))
        x[:6] *= np.linspace(0, 1, 6)
        return x
    n = int(0.20 * sr)
    out = np.zeros(n, dtype=np.float32)
    a = tick(0.09, 2100 * bright, 0.0075)
    b = tick(0.06, 3200 * bright, 0.0042) * 0.42
    out[:len(a)] += a
    p = int(0.028 * sr); out[p:p + len(b)] += b
    return _n(out)

# ── things hitting things ────────────────────────────────────────────────
def thud(sr, f0=92.0, tau=0.13, bright=0.5):
    """Something soft-ish landing on something hard."""
    g = np.random.default_rng(11)
    n = int(0.55 * sr); t = np.arange(n) / sr
    body = np.sin(2 * np.pi * np.linspace(f0 * 1.7, f0 * 0.72, n) * t) * np.exp(-t / tau)
    grit = _band(g.normal(0, 1, n), sr, 220, 2600) * np.exp(-t / (tau * 0.22)) * bright
    return _n(body + grit)

def clack(sr, f0=1150.0, tau=0.045):
    """Hard on hard — a plate, a lid, wood."""
    g = np.random.default_rng(13)
    n = int(0.36 * sr); t = np.arange(n) / sr
    x = _band(g.normal(0, 1, n), sr, f0 * 0.5, f0 * 3.4) * np.exp(-t / tau)
    x += 0.55 * np.sin(2 * np.pi * f0 * t) * np.exp(-t / (tau * 1.5))
    x += 0.30 * np.sin(2 * np.pi * f0 * 1.61 * t) * np.exp(-t / (tau * 0.8))
    x[:8] *= np.linspace(0, 1, 8)
    return _n(x)

def scrape(sr, dur=0.5, lo=380, hi=4200, rough=2.4):
    """Something dragged: filtered noise with an uneven grip."""
    g = np.random.default_rng(17)
    n = int(dur * sr); t = np.linspace(0, 1, n)
    x = _band(g.normal(0, 1, n), sr, lo, hi)
    x *= np.sin(np.pi * t) ** 1.3
    x *= 0.55 + 0.45 * np.sin(2 * np.pi * rough * t)
    return _n(x)

def whoosh(sr, dur=0.6, peak=0.55, lo=180, hi=2600):
    """Air moving past. Use it sparingly; it is the easiest sound in the world
    to overuse and the fastest way to make a piece feel like a stock trailer."""
    g = np.random.default_rng(19)
    n = int(dur * sr); t = np.linspace(0, 1, n)
    x = _band(g.normal(0, 1, n), sr, lo, hi)
    env = np.exp(-((t - peak) ** 2) / (2 * 0.16 ** 2))
    return _n(x * env)

def pencil(sr, dur=0.4):
    """Graphite on paper, for a draw-in."""
    g = np.random.default_rng(23)
    n = int(dur * sr); t = np.linspace(0, 1, n)
    x = _band(g.normal(0, 1, n), sr, 1400, 8000)
    x *= (0.5 + 0.5 * np.sin(2 * np.pi * 11 * t + g.random() * 6)) * np.sin(np.pi * t) ** 0.7
    return _n(x)

def tone(sr, dur, f0, partials=(1.0, 0.4, 0.18), tau=0.9):
    """A struck note, for a beat that has to land."""
    n = int(dur * sr); t = np.arange(n) / sr
    x = np.zeros(n)
    for k, a in enumerate(partials):
        x += a * np.sin(2 * np.pi * f0 * (k + 1) * t)
    return _n(x * np.exp(-t / tau))

# ── the room ─────────────────────────────────────────────────────────────
def room(sr, decay=0.26, size=0.5, seed=101):
    """A short impulse response. Keep the tail SHORTER than the gap between the
    events it is applied to, or the rhythm of a piece disappears into it —
    that mistake cost a whole render on the sixth video."""
    g = np.random.default_rng(seed)
    n = int((decay * 3.4) * sr); t = np.arange(n) / sr
    ir = g.normal(0, 1, n) * np.exp(-t / decay)
    ir[:int(0.006 * sr)] *= 0.04
    for d, a in [(0.011 * size, 0.5), (0.019 * size, 0.36), (0.031 * size, 0.24)]:
        i = int(d * sr)
        if i < n: ir[i] += a
    ir = sosfilt(butter(2, 5000 / (sr / 2), btype="low", output="sos"), ir)
    return (ir / np.sqrt((ir ** 2).sum())).astype(np.float32)

def reverb(x, ir, wet=0.30, dry=0.88):
    n = len(x)
    return (dry * x + wet * fftconvolve(x, ir)[:n]).astype(np.float32)

# ── the house mix rules ──────────────────────────────────────────────────
DUCK = 0.86            # measured: 0.40 gave +1.4 dB and was unhearable
VOICE_PEAK = 0.93
SUBSCRIBE_TAP = 1.48   # seconds after InkBrand.subscribe()'s `at`, when it lands

def speech_key(vox, sr, widen=0.30, smooth=0.16):
    """The ducking key: built from the speech envelope and widened BOTH ways, so
    the bed is already down before the first syllable and does not come back up
    in the gaps inside a sentence."""
    sm = np.convolve(np.abs(vox), np.ones(int(0.02 * sr)) / int(0.02 * sr), mode="same")
    ref = np.percentile(sm[sm > 1e-4], 70) if (sm > 1e-4).any() else 1.0
    k = np.clip(sm / (ref + 1e-9), 0, 1) ** 0.5
    k = np.clip(np.convolve(k, np.ones(int(widen * sr)), mode="same") / (int(widen * sr) * 0.22), 0, 1)
    return np.convolve(k, np.ones(int(smooth * sr)) / int(smooth * sr), mode="same")

def voice_over_bed_db(mix_mono, vox, key, sr):
    """The check that must be run before shipping. Anything under +10 dB costs
    the viewer words; the house target is +12 to +15."""
    n = min(len(mix_mono), len(vox), len(key))
    sp = key[:n] > 0.5
    if sp.sum() < sr * 0.5: return float("nan")
    b = butter(4, [300 / (sr / 2), 4000 / (sr / 2)], btype="band", output="sos")
    def rms(x): return float(np.sqrt((x ** 2).mean()) + 1e-12)
    v = sosfilt(b, vox[:n])[sp]
    d = sosfilt(b, (mix_mono[:n] - vox[:n]))[sp]
    return 20 * np.log10(rms(v) / rms(d))
