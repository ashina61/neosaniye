"""Original ambient score for 'Why birds don't get shocked' — 30s, A minor.
Written for this film: chord moves land on the narrative beats."""
import numpy as np, wave, struct

SR = 48000; DUR = 30.0
N = int(SR*DUR); t = np.arange(N)/SR

def adsr(n, a, d, s, r, peak=1.0):
    """Length-safe ADSR: segments are clamped so a truncated note still fits."""
    env = np.zeros(n)
    ai, di, ri = int(a*SR), int(d*SR), int(r*SR)
    if ai + di + ri > n:                       # note was cut short at the buffer end
        scale = n / max(ai + di + ri, 1)
        ai, di, ri = int(ai*scale), int(di*scale), int(ri*scale)
    si = max(0, n - ai - di - ri)
    i = 0
    if ai: env[i:i+ai] = np.linspace(0, peak, ai); i += ai
    if di: env[i:i+di] = np.linspace(peak, s*peak, di); i += di
    if si: env[i:i+si] = s*peak; i += si
    if ri: env[i:i+ri] = np.linspace(s*peak, 0, ri)
    return env

def note(freq, start, dur, kind='pad', amp=0.2, detune=0.0):
    """Render one voice into a full-length buffer."""
    n = int(dur*SR); s0 = int(start*SR)
    if s0 >= N: return np.zeros(N)
    n = min(n, N-s0)
    tt = np.arange(n)/SR
    if kind == 'pad':
        # additive partials, slow vibrato, soft odd harmonics
        vib = 1 + 0.0022*np.sin(2*np.pi*0.23*tt + freq)
        sig = np.zeros(n)
        for k, g in [(1,1.0),(2,0.42),(3,0.20),(4,0.11),(5,0.06),(6,0.035)]:
            sig += g*np.sin(2*np.pi*freq*k*vib*tt + k*0.7)
        sig /= 1.85
        env = adsr(n, dur*0.32, dur*0.18, 0.72, dur*0.40)
    elif kind == 'bell':
        # FM bell: carrier + inharmonic modulator, fast decay
        mod = np.sin(2*np.pi*freq*2.76*tt) * np.exp(-tt*5.5) * 2.4
        sig = np.sin(2*np.pi*freq*tt + mod)
        env = np.exp(-tt*2.6) * (1-np.exp(-tt*220))
    elif kind == 'sub':
        sig = np.sin(2*np.pi*freq*tt)
        sig = np.tanh(sig*1.35)/1.35
        env = adsr(n, 0.18, 0.25, 0.8, dur*0.45)
    elif kind == 'pluck':
        sig = np.sin(2*np.pi*freq*tt) + 0.30*np.sin(2*np.pi*freq*2*tt) + 0.12*np.sin(2*np.pi*freq*3*tt)
        env = np.exp(-tt*7.0) * (1-np.exp(-tt*400))
    out = np.zeros(N); out[s0:s0+n] = sig*env*amp
    return out

def lowpass(x, cutoff):
    """One-pole lowpass; cutoff may be an array (time-varying)."""
    c = np.atleast_1d(cutoff)
    if c.size == 1: c = np.full(len(x), c[0])
    a = np.exp(-2*np.pi*c/SR); y = np.zeros_like(x); prev = 0.0
    for i in range(len(x)):
        prev = (1-a[i])*x[i] + a[i]*prev
        y[i] = prev
    return y

def reverb(x, decay=2.2, mix=0.34):
    """Schroeder-ish: parallel combs + series allpass."""
    out = np.zeros_like(x)
    for d_ms, g in [(29.7,0.805),(37.1,0.827),(41.1,0.783),(43.7,0.764)]:
        d = int(SR*d_ms/1000); buf = np.zeros(len(x)+d)
        gg = g**(1/max(decay,0.1))
        for i in range(len(x)):
            buf[i+d] = x[i] + gg*buf[i]
        out += buf[d:d+len(x)]
    out /= 4.0
    for d_ms, g in [(5.0,0.7),(1.7,0.7)]:
        d = int(SR*d_ms/1000); buf = np.zeros(len(out)+d); y = np.zeros_like(out)
        for i in range(len(out)):
            v = out[i] + (-g)*buf[i]
            buf[i+d] = v; y[i] = g*v + buf[i]
        out = y
    return (1-mix)*x + mix*out

# --- musical material -------------------------------------------------------
def f(midi): return 440.0*2**((midi-69)/12)
A3,C4,E4,F4,G4,A4,C5,D5,E5,G5,A5,D4,B4,F5 = (f(m) for m in
    [57,60,64,65,67,69,72,74,76,79,81,62,71,77])

# chord moves land on story beats: hook / mechanism / rule / danger / resolve
chords = [
    (0.00, 6.20, [A3, C4, E4, A4],  'Am'),
    (5.60, 6.20, [f(53), f(60), f(65), f(69)], 'F'),
    (11.20,6.20, [f(48), f(55), f(64), f(67)], 'C'),
    (16.80,6.10, [A3, C4, E4, A4],  'Am'),
    (22.10,6.40, [f(50), f(57), f(65), f(69)], 'Dm'),   # tension: the danger beat
    (27.60,3.40, [A3, C4, E4, A4],  'Am'),              # resolve out
]

mix = np.zeros(N)
for start, dur, notes, name in chords:
    for j, fr in enumerate(notes):
        mix += note(fr, start, dur, 'pad', amp=0.115 - 0.012*j)

# sub bass roots
for start, dur, root in [(0,6.2,f(33)),(5.6,6.2,f(29)),(11.2,6.2,f(36)),
                         (16.8,6.1,f(33)),(22.1,6.4,f(26)),(27.6,3.4,f(33))]:
    mix += note(root, start, dur, 'sub', amp=0.16)

# sparse bells — curiosity motif, placed in the narration's gaps
for st, fr, a in [(0.20,A5,0.16),(1.55,E5,0.10),(4.10,C5,0.085),
                  (5.35,A4,0.10),(8.95,E5,0.095),(11.35,G5,0.10),
                  (14.95,C5,0.09),(17.70,A4,0.11),(18.10,E5,0.07),
                  (21.85,D5,0.10),(26.75,A4,0.115),(28.40,C5,0.085),(29.10,A5,0.07)]:
    mix += note(fr, st, 2.6, 'bell', amp=a)

# gentle pulse (heartbeat of the explanation) — enters at the mechanism, out at the end
bpm = 84.0; beat = 60.0/bpm
k = 0; tb = 5.60
while tb < 27.4:
    accent = 1.0 if k % 4 == 0 else 0.52
    body = 0.20 if 9.0 < tb < 27.0 else 0.13
    mix += note(f(33) if k % 4 == 0 else f(45), tb, 0.26, 'pluck', amp=body*accent)
    tb += beat; k += 1

# noise riser into the danger beat (21.0 → 22.15)
r0, r1 = int(21.0*SR), int(22.15*SR)
rn = r1-r0
rng = np.random.default_rng(7)
riser = rng.standard_normal(rn)
riser = lowpass(riser, np.linspace(400, 5200, rn)) * np.linspace(0, 0.085, rn)**1.7
mix[r0:r1] += riser

# soft impact on the danger word
mix += note(f(26), 22.10, 1.9, 'sub', amp=0.20)

# --- shape, space, master ---------------------------------------------------
mix = lowpass(mix, 5200)
mix = reverb(mix, decay=2.4, mix=0.30)

# arrangement dynamics: room for the hook, lift into danger, fade out
env = np.ones(N)
env *= np.clip(t/1.4, 0, 1)                                  # fade in
env *= np.where(t > 28.6, np.clip((30.0-t)/1.4, 0, 1), 1.0)  # fade out
env *= 0.80 + 0.20*np.clip((t-9.0)/6.0, 0, 1)                # gentle build
env *= np.where((t > 22.0) & (t < 27.0), 1.13, 1.0)          # danger lift
mix *= env

# stereo: Haas widening on the pad, mono-safe low end
delay = int(0.011*SR)
L = mix.copy(); R = np.concatenate([np.zeros(delay), mix[:-delay]])
low = lowpass(mix, 180)
L = 0.80*L + 0.20*low; R = 0.80*R + 0.20*low

st = np.stack([L, R], axis=1)
st = np.tanh(st*1.10)/1.10                    # soft limit
st /= (np.max(np.abs(st)) + 1e-9); st *= 0.72  # headroom for ducking

with wave.open('audio/music.wav','wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st*32767).astype('<i2').tobytes())
print("music.wav yazıldı:", st.shape[0]/SR, "sn")
