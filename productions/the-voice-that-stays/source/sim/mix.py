"""
THE VOICE THAT STAYS — the soundtrack.

This is the first film on the channel whose ARGUMENT IS AUDIBLE, and the mix
is where it happens rather than the picture. The claim is that your skull
hands you a low half of your own voice that never leaves your head, so the
recording sounds thin and wrong. You cannot draw that. You can play it.

Two lines are therefore processed, and they are the only processed sound in
the film:

  s08 "This is the voice in your head."   -> everything under 320 Hz lifted
                                             about 9 dB: what bone adds.
  s09 "And this is the one that leaves    -> 380 Hz to 4.5 kHz and squashed:
       the room."                            what the phone on the table got.

Both are RMS-matched back to the unprocessed narration, on purpose. If the
bone version were also louder the viewer would hear "louder", which is not
the claim. Same loudness, different half of the spectrum, back to back: the
only way to hear what you have never heard.

Everything else keeps the same rule in miniature. The air pulse is bright and
goes away and comes back. The bone pulse is 110 Hz with nothing above 400 in
it at all, and it does not travel, because it has nowhere to go. Nothing here
is sampled and nothing is licensed.
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
rng = np.random.default_rng(4471)
t   = np.arange(NS) / SR

# Two buses, ducked differently — the correction that came out of video 9.
# `bed` is the room and takes the full house duck; `fx` is what the film
# itself is doing and takes a third of it, or the two pulses that ARE the
# diagram disappear under the sentence that introduces them.
bed = np.zeros((NS, 2), dtype=np.float32)
fx  = np.zeros((NS, 2), dtype=np.float32)

# ── the room ─────────────────────────────────────────────────────────────
# A room with one person in it and a phone on the table: quiet enough that
# the two demo lines have somewhere to land, present enough that the cut to
# his head is not a cut to a vacuum.
air = _band(rng.normal(0, 1, NS), SR, 90, 1600) * 0.019
air *= 0.74 + 0.26 * np.sin(2 * np.pi * 0.048 * t + 1.1)
bed += np.stack([air, np.roll(air, 137)], axis=1)
hum = 0.010 * (np.sin(2 * np.pi * 50 * t) + 0.28 * np.sin(2 * np.pi * 100 * t + 0.4))
hum *= np.clip(t / 1.4, 0, 1) * (1 - np.clip((t - (DUR - 1.8)) / 1.8, 0, 1))
bed += np.stack([hum * 0.96, hum], axis=1).astype(np.float32)

# ── the page drawing itself ──────────────────────────────────────────────
for i in range(11):
    p = pencil(SR, 0.19 + 0.055 * (i % 3)) * 0.175
    place(fx[:, 0], SR, p, 0.05 + i * 0.052)
    place(fx[:, 1], SR, p * 0.9, 0.05 + i * 0.052 + 0.006)
# the two routes are drawn on later, and each gets its own stroke
for at, d in [(13.55, 0.26), (14.30, 0.20), (18.85, 0.22)]:
    place(fx[:, 0], SR, pencil(SR, d) * 0.17, at)
    place(fx[:, 1], SR, pencil(SR, d) * 0.15, at + 0.005)

# ── the phone starts recording ───────────────────────────────────────────
place(fx[:, 0], SR, ui_click(SR, bright=1.2) * 0.30, E["record_at"])
place(fx[:, 1], SR, ui_click(SR, bright=1.2) * 0.27, E["record_at"] + 0.003)

# ── the air pulse: bright, and it goes somewhere ─────────────────────────
# A gust that leaves, gets quiet and far, and comes back into the near ear.
# It is panned, and it is the only panned thing in the film, because being
# somewhere else for a moment is the entire difference from the bone route.
def air_gust(dur=1.55):
    n = int(dur * SR); u = np.arange(n) / SR; f = u / dur
    s = _band(rng.normal(0, 1, n), SR, 700, 6000)
    # out (loud, near) -> away (quiet, dull) -> back in
    env = 0.55 * np.exp(-((f - 0.03) ** 2) / 0.006) + 0.30 * np.exp(-((f - 0.5) ** 2) / 0.10) \
        + 0.62 * np.exp(-((f - 0.95) ** 2) / 0.008)
    dull = _band(s, SR, 700, 2200)
    s = s * (1 - np.clip(1.6 * (0.5 - np.abs(f - 0.5)), 0, 1)) + dull * np.clip(1.6 * (0.5 - np.abs(f - 0.5)), 0, 1)
    return (s * env).astype(np.float32), f
for at in E["air_pulse"]:
    g, f = air_gust()
    pan = np.clip(np.sin(np.pi * f) * 0.85, 0, 1)        # 0 near, 1 far right
    place(fx[:, 0], SR, g * (1 - pan * 0.72), at)
    place(fx[:, 1], SR, g * (0.55 + pan * 0.45), at + 0.004)

# ── the bone pulse: 110 Hz, and it does not go anywhere ──────────────────
def bone_knock():
    n = int(0.52 * SR); u = np.arange(n) / SR
    s = np.sin(2 * np.pi * 110 * u) * np.exp(-u / 0.085)
    s += 0.42 * np.sin(2 * np.pi * 168 * u + 0.7) * np.exp(-u / 0.055)
    s += 0.20 * np.sin(2 * np.pi * 74 * u) * np.exp(-u / 0.16)
    return _band(s, SR, 40, 400).astype(np.float32)      # nothing above 400. That is the point.
for at in E["bone_pulse"]:
    k = bone_knock()
    place(fx[:, 0], SR, k * 0.46, at)
    place(fx[:, 1], SR, k * 0.46, at)                    # dead centre, in his head

# a small dry room: a kitchen table, not a hall
ir = room(SR, decay=0.17, size=0.30)
for ch in (0, 1):
    bed[:, ch] = reverb(bed[:, ch], ir, wet=0.14, dry=0.95)
    fx[:, ch]  = reverb(fx[:, ch],  ir, wet=0.18, dry=0.94)

place(fx, SR, np.stack([ui_click(SR)] * 2, axis=1) * 0.5,
      EV["subscribe_at"] + SUBSCRIBE_TAP)

# ── the voice, and the two lines that are the film ───────────────────────
def rms(x): return float(np.sqrt((x ** 2).mean()) + 1e-12)
def match(y, x): return (y * (rms(x) / rms(y))).astype(np.float32)

def bone_voice(x):
    """What your skull hands you: the bottom of your own voice, lifted."""
    return match(x + 1.85 * _band(x, SR, 20, 320), x)

def air_voice(x):
    """What the phone on the table got: a small speaker's band, squashed."""
    y = _band(x, SR, 380, 7000)
    y = y + 0.55 * _band(x, SR, 2600, 7000)      # a small speaker is all presence
    return match(np.tanh(y * 2.2), x)

DEMO = {"s08": bone_voice, "s09": air_voice}

vox = np.zeros(NS, dtype=np.float32)
for sid, at in EV["narration"].items():
    s, sr = sf.read(f"../assets/audio/{sid}.wav", dtype="float32")
    if s.ndim > 1: s = s.mean(1)
    s = resample_poly(s, SR, sr).astype(np.float32)
    if sid in DEMO: s = DEMO[sid](s)
    p = int(at * SR); vox[p:p + len(s)] += s
vox *= VOICE_PEAK / (np.abs(vox).max() + 1e-9)

key = speech_key(vox, SR)
FX_DUCK = 0.34
mix = bed.copy()
mix *= (1.0 - DUCK * key)[:, None]
mix += fx * (1.0 - FX_DUCK * key)[:, None]
mix += np.stack([vox, vox], axis=1)

mix = mix[:int(DUR * SR)]
mix *= 0.90 / (np.abs(mix).max() + 1e-9)
sf.write("../assets/audio/mix.wav", mix, SR)

db = voice_over_bed_db(mix.mean(1), vox[:len(mix)], key[:len(mix)], SR)
print(f"{DUR:.2f}s · peak {np.abs(mix).max():.3f} · rms {rms(mix):.4f}")
print(f"voice over room, 300Hz-4kHz, while speaking: {db:+.1f} dB")

# The claim has to be measurable or it is decoration. Below 320 Hz the bone
# line must carry clearly more energy than the air line, and above 4.5 kHz it
# must be the other way round — otherwise the two demos sound the same and
# the film's last twenty seconds are a man asserting something.
def half(sid, lo, hi):
    at = EV["narration"][sid]; d = EV["durations"][sid]
    seg = vox[int(at * SR):int((at + d) * SR)]
    return 20 * np.log10(rms(_band(seg, SR, lo, hi)) / rms(seg))
lo_b, lo_a = half("s08", 20, 320), half("s09", 20, 320)
hi_b, hi_a = half("s08", 4500, 12000), half("s09", 4500, 12000)
print(f"under 320Hz  · bone {lo_b:+.1f} dB · air {lo_a:+.1f} dB · bone carries {lo_b-lo_a:+.1f} dB more")
print(f"over 4.5kHz  · bone {hi_b:+.1f} dB · air {hi_a:+.1f} dB · air carries  {hi_a-hi_b:+.1f} dB more")
if not (db >= 10): raise SystemExit("voice is not clear of the room")
if not (lo_b - lo_a >= 8): raise SystemExit("the bone line does not sound like bone")
if not (hi_a - hi_b >= 6): raise SystemExit("the air line does not sound like a phone")
