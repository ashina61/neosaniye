"""
NOBODY IS CONDUCTING — the simulation.

This is the film. The picture and the soundtrack are both read out of the array
this script writes; nothing in either of them is animated by hand.

The model is the one Néda, Ravasz, Brechet, Vicsek & Barabási used in Nature
(2000) when they recorded real audiences: globally coupled Kuramoto phase
oscillators, one per pair of hands.

    dθi/dt = ωi + (K/N) Σj sin(θj − θi) + noise

The whole argument of the video falls out of one inequality. Kuramoto locks
when the coupling beats the spread of natural rates:

    K > Kc = 2 σω sqrt(2/π)

and — this is Néda's actual measurement — the *relative* spread of clapping
rates in a crowd is roughly constant, about 15%. So σω is proportional to the
mean rate, and Kc is proportional to the mean rate, while K is not. Clap fast
and Kc is above K: no lock, whatever anyone wants. Halve the rate and Kc halves
with it, drops under K, and the room locks without anybody deciding to.

    f = 4.0 Hz  ->  σω = 3.90  ->  Kc = 6.22   > K = 4.6   incoherent
    f = 2.0 Hz  ->  σω = 1.95  ->  Kc = 3.11   < K = 4.6   locked
    f = 3.7 Hz  ->  σω = 3.61  ->  Kc = 5.75   > K = 4.6   comes apart

Nothing is tuned to produce the arc; the arc is what those three numbers do.
"""
import json, base64, numpy as np

FPS      = 30
DUR      = 58.20
FRAMES   = int(round(DUR * FPS))
N        = 120
SUB      = 4                      # integration substeps per rendered frame
K        = 4.60                   # coupling, rad/s
REL_SIG  = 0.155                  # Néda's constant relative dispersion
NOISE    = 0.42                   # rad/sqrt(s) — a crowd is not a machine
SEED     = 71828

# the room's mean clapping rate, in claps per second, over the film
def mean_rate(t):
    if t < 7.40:  return 4.00
    if t < 8.30:  return 4.00 + (2.00 - 4.00) * (t - 7.40) / 0.90
    if t < 49.40: return 2.00
    if t < 54.50: return 2.00 + (3.70 - 2.00) * (t - 49.40) / 5.10
    return 3.70

rng   = np.random.default_rng(SEED)
eps   = rng.normal(0.0, REL_SIG, N)          # each person's rate, as a fraction
eps  -= eps.mean()                           # the room's mean is the room's mean
theta = rng.uniform(0, 2*np.pi, N)           # everybody starts wherever

dt = 1.0 / (FPS * SUB)
sq = np.sqrt(dt)

th_q  = np.zeros((FRAMES, N), dtype=np.uint8)
r_out = np.zeros(FRAMES)
p_out = np.zeros(FRAMES)
f_out = np.zeros(FRAMES)
claps = [[] for _ in range(FRAMES)]          # per frame: +i aligned, -(i+1) not
# The picture only needs to know which frame a clap fell in. The SOUND needs the
# instant, and this film is entirely about instants: quantising 17,000 claps to
# 33ms frames and then jittering them puts ±16ms of noise on top of a unison
# that is only ±48ms wide, and the lock stops being audible.
exact = []                                   # [t seconds, i, aligned]

for f in range(FRAMES):
    for s in range(SUB):
        t  = (f + s / SUB) / FPS
        w  = 2*np.pi * mean_rate(t) * (1.0 + eps)
        z  = np.exp(1j * theta).mean()
        r, psi = abs(z), np.angle(z)
        before = theta.copy()
        theta += (w + K * r * np.sin(psi - theta)) * dt + NOISE * sq * rng.normal(0, 1, N)
        # a clap is a phase crossing a whole turn
        hit = np.floor(theta / (2*np.pi)) > np.floor(before / (2*np.pi))
        if hit.any():
            d = np.abs(np.angle(np.exp(1j * (theta - psi))))
            for i in np.nonzero(hit)[0]:
                al = bool(d[i] < 0.38)
                claps[f].append(int(i) if al else -(int(i) + 1))
                # where inside the substep the turn was crossed
                edge = np.ceil(before[i] / (2*np.pi)) * 2*np.pi
                frac = (edge - before[i]) / max(1e-9, theta[i] - before[i])
                exact.append([round(float(t + frac * dt), 5), int(i), int(al)])
    z = np.exp(1j * theta).mean()
    r_out[f] = abs(z); p_out[f] = np.angle(z)
    f_out[f] = mean_rate(f / FPS)
    th_q[f]  = np.mod(theta, 2*np.pi) / (2*np.pi) * 256

nat = 2*np.pi * (1.0 + eps)                  # each person's rate ÷ the room's
open("../hyperframes/sim.js", "w").write(
    "window.SIM=" + json.dumps({
        "n": N, "fps": FPS, "frames": FRAMES, "duration": DUR,
        "theta": base64.b64encode(th_q.tobytes()).decode(),
        "r":   [round(float(v), 4) for v in r_out],
        "psi": [round(float(v), 4) for v in p_out],
        "rate": [round(float(v), 4) for v in f_out],
        "eps": [round(float(v), 5) for v in eps],
        "claps": claps,
        "K": K, "relSigma": REL_SIG,
    }, separators=(",", ":")) + ";\n")

json.dump({"n": N, "fps": FPS, "frames": FRAMES, "duration": DUR,
           "exact": exact, "r": [round(float(v), 4) for v in r_out],
           "rate": [round(float(v), 4) for v in f_out]},
          open("claps.json", "w"), separators=(",", ":"))

print(f"{FRAMES} frames, {sum(len(c) for c in claps)} claps")
al = np.zeros(FRAMES); tc = np.zeros(FRAMES)
for f in range(FRAMES):
    for c in claps[f]:
        tc[f] += 1
        if c >= 0: al[f] += 1
W = 30
for t in [1, 4, 7, 8, 9, 10, 11, 12, 14, 20, 35, 48, 50, 52, 54, 56, 57.5]:
    f = min(FRAMES-1, int(t*FPS)); a=max(0,f-W); b=min(FRAMES,f+W)
    frac = al[a:b].sum() / max(1, tc[a:b].sum())
    bar = "#" * int(r_out[f] * 40)
    print(f"  t={t:5.1f}  rate={f_out[f]:.2f}Hz  r={r_out[f]:.3f}  in-step {frac*100:4.0f}%  cps={tc[a:b].sum()/2:5.1f} |{bar}")
