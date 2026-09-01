"""Synthesize an original score for one video. No samples, no licensing.

The chord changes are placed on the narration's own beat boundaries, so the
music turns when the story turns rather than on an arbitrary bar grid.
"""
from __future__ import annotations

import wave
from pathlib import Path

import numpy as np

SR = 48_000


def _f(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


# Roman-numeral shapes per mood, as semitone offsets from the mood's root.
MOODS: dict[str, dict] = {
    "curious": {"root": 57, "cycle": [(0, "min"), (8, "maj"), (3, "maj"), (0, "min")]},
    "warm":    {"root": 60, "cycle": [(0, "maj"), (9, "min"), (5, "maj"), (7, "maj")]},
    "tense":   {"root": 50, "cycle": [(0, "min"), (10, "maj"), (5, "min"), (0, "min")]},
    "bright":  {"root": 62, "cycle": [(0, "maj"), (7, "maj"), (9, "min"), (5, "maj")]},
}
TRIAD = {"maj": (0, 4, 7), "min": (0, 3, 7)}


def _adsr(n: int, a: float, d: float, s: float, r: float, peak: float = 1.0) -> np.ndarray:
    env = np.zeros(n)
    ai, di, ri = int(a * SR), int(d * SR), int(r * SR)
    if ai + di + ri > n:                       # note truncated at the buffer end
        k = n / max(ai + di + ri, 1)
        ai, di, ri = int(ai * k), int(di * k), int(ri * k)
    si = max(0, n - ai - di - ri)
    i = 0
    if ai: env[i:i + ai] = np.linspace(0, peak, ai); i += ai
    if di: env[i:i + di] = np.linspace(peak, s * peak, di); i += di
    if si: env[i:i + si] = s * peak; i += si
    if ri: env[i:i + ri] = np.linspace(s * peak, 0, ri)
    return env


def _voice(buf: np.ndarray, freq: float, start: float, dur: float, kind: str, amp: float) -> None:
    n_total = len(buf)
    s0 = int(start * SR)
    if s0 >= n_total:
        return
    n = min(int(dur * SR), n_total - s0)
    if n <= 0:
        return
    t = np.arange(n) / SR
    if kind == "pad":
        vib = 1 + 0.0022 * np.sin(2 * np.pi * 0.23 * t + freq)
        sig = sum(g * np.sin(2 * np.pi * freq * k * vib * t + k * 0.7)
                  for k, g in [(1, 1.0), (2, .42), (3, .20), (4, .11), (5, .06), (6, .035)]) / 1.85
        env = _adsr(n, dur * .32, dur * .18, .72, dur * .40)
    elif kind == "bell":
        mod = np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 5.5) * 2.4
        sig = np.sin(2 * np.pi * freq * t + mod)
        env = np.exp(-t * 2.6) * (1 - np.exp(-t * 220))
    elif kind == "sub":
        sig = np.tanh(np.sin(2 * np.pi * freq * t) * 1.35) / 1.35
        env = _adsr(n, .18, .25, .8, dur * .45)
    else:  # pluck
        sig = (np.sin(2 * np.pi * freq * t) + .30 * np.sin(2 * np.pi * freq * 2 * t)
               + .12 * np.sin(2 * np.pi * freq * 3 * t))
        env = np.exp(-t * 7.0) * (1 - np.exp(-t * 400))
    buf[s0:s0 + n] += sig * env * amp


def _lowpass(x: np.ndarray, cutoff) -> np.ndarray:
    c = np.atleast_1d(cutoff).astype(float)
    if c.size == 1:
        c = np.full(len(x), c[0])
    a = np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x)
    prev = 0.0
    for i in range(len(x)):
        prev = (1 - a[i]) * x[i] + a[i] * prev
        y[i] = prev
    return y


def _reverb(x: np.ndarray, decay: float = 2.4, mix: float = 0.30) -> np.ndarray:
    out = np.zeros_like(x)
    for ms, g in [(29.7, .805), (37.1, .827), (41.1, .783), (43.7, .764)]:
        d = int(SR * ms / 1000)
        buf = np.zeros(len(x) + d)
        gg = g ** (1 / max(decay, .1))
        for i in range(len(x)):
            buf[i + d] = x[i] + gg * buf[i]
        out += buf[d:d + len(x)]
    out /= 4.0
    for ms, g in [(5.0, .7), (1.7, .7)]:
        d = int(SR * ms / 1000)
        buf = np.zeros(len(out) + d)
        y = np.zeros_like(out)
        for i in range(len(out)):
            v = out[i] - g * buf[i]
            buf[i + d] = v
            y[i] = g * v + buf[i]
        out = y
    return (1 - mix) * x + mix * out


def compose(duration: float, out: Path, mood: str = "curious",
            turn: float | None = None, changes: list[float] | None = None,
            seed: int = 7) -> Path:
    """Write a `duration`-second stereo score.

    changes: times where the harmony should move (the narration's beat starts).
    turn:    the moment the piece should darken — a riser lands just before it.
    """
    if mood not in MOODS:
        raise ValueError(f"unknown mood {mood!r}; have {sorted(MOODS)}")
    spec = MOODS[mood]
    n = int(duration * SR)
    t = np.arange(n) / SR
    mix = np.zeros(n)

    marks = [m for m in (changes or []) if 0.0 < m < duration - 1.0]
    marks = [0.0] + marks
    if len(marks) < 3:                                   # fall back to an even grid
        marks = list(np.linspace(0, duration, 6))[:-1]
    # thin dense beat lists down to a musical rate (~5s per chord)
    kept = [marks[0]]
    for m in marks[1:]:
        if m - kept[-1] >= 4.0:
            kept.append(m)
    marks = kept
    spans = [(marks[i], (marks[i + 1] if i + 1 < len(marks) else duration) - marks[i])
             for i in range(len(marks))]

    for idx, (start, span) in enumerate(spans):
        off, qual = spec["cycle"][idx % len(spec["cycle"])]
        # darken the chord that carries the turn
        if turn is not None and start <= turn < start + span:
            qual = "min"
        root = spec["root"] + off
        notes = [_f(root - 12), *[_f(root + s) for s in TRIAD[qual]], _f(root + 12)]
        for j, fr in enumerate(notes[1:]):
            _voice(mix, fr, start, span + 0.6, "pad", 0.115 - 0.012 * j)
        _voice(mix, _f(root - 24), start, span + 0.6, "sub", 0.16)

    # bell motif on the harmony moves, an octave up
    for idx, (start, _span) in enumerate(spans):
        off, _q = spec["cycle"][idx % len(spec["cycle"])]
        _voice(mix, _f(spec["root"] + off + 24), max(start - 0.15, 0.0), 2.6, "bell", 0.13)

    # pulse: enters after the hook, leaves before the outro
    beat = 60.0 / 84.0
    tb, k = min(5.6, duration * 0.2), 0
    while tb < duration - 2.6:
        accent = 1.0 if k % 4 == 0 else 0.52
        _voice(mix, _f(spec["root"] - 24) if k % 4 == 0 else _f(spec["root"] - 12),
               tb, 0.26, "pluck", 0.17 * accent)
        tb += beat
        k += 1

    if turn is not None and 1.2 < turn < duration:
        r0, r1 = int(max(turn - 1.15, 0) * SR), int(turn * SR)
        rn = r1 - r0
        if rn > 0:
            rng = np.random.default_rng(seed)
            riser = _lowpass(rng.standard_normal(rn), np.linspace(400, 5200, rn))
            mix[r0:r1] += riser * np.linspace(0, 0.085, rn) ** 1.7
        _voice(mix, _f(spec["root"] - 31), turn, 1.9, "sub", 0.20)

    mix = _reverb(_lowpass(mix, 5200))

    env = np.clip(t / 1.4, 0, 1)
    env *= np.where(t > duration - 1.4, np.clip((duration - t) / 1.4, 0, 1), 1.0)
    env *= 0.80 + 0.20 * np.clip((t - duration * 0.3) / 6.0, 0, 1)
    if turn is not None:
        env *= np.where((t > turn - 0.1) & (t < turn + 5.0), 1.13, 1.0)
    mix *= env

    delay = int(0.011 * SR)
    low = _lowpass(mix, 180)
    L = 0.80 * mix + 0.20 * low
    R = 0.80 * np.concatenate([np.zeros(delay), mix[:-delay]]) + 0.20 * low
    st = np.stack([L, R], axis=1)
    st = np.tanh(st * 1.10) / 1.10
    st /= np.max(np.abs(st)) + 1e-9
    st *= 0.72                                   # headroom for the voice duck

    out.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(out), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st * 32767).astype("<i2").tobytes())
    return out
