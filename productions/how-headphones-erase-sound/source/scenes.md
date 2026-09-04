# Per-scene plan — no hero-component spine

Required by `skills/meta/bespoke-composition.md` §1.5. Each scene's primary visual subject
must differ from its neighbours', and the signature device (the microsecond counter) must be
scarce.

| # | Frames | Primary visual subject | Why this beat exists | How it differs from its neighbours | Counter? |
|---|---|---|---|---|---|
| sc-01 | 0–101 | A single descending cyan trace | Overturn the assumption before any explanation exists | Vertical travel; the only scene where motion crosses the whole frame top to bottom | no |
| sc-02 | 101–297 | Two mirrored horizontal traces collapsing | Deliver the known mechanism fast so the video can leave it behind | Horizontal, symmetric, converging — the opposite axis to sc-01 | no |
| sc-03 | 297–396 | Typography in an empty frame | Mark the end of the known part | The only scene with no drawn subject at all | no |
| sc-04 | 396–525 | The mic-to-ear gap, with a pulse crossing it | Establish that the sound is already in flight | Introduces spatial geometry; first appearance of the counter | **yes** |
| sc-05 | 525–615 | An engineering dimension line | Turn "microseconds out" into a measurable distance | Same geometry as sc-04 but static and annotated — a drawing, not an event | yes |
| sc-06 | 615–726 | A tolerance band on the anti-wave | Give the deadline a number and show it still works inside it | Returns to waveforms, but now with a third element — the residual sum line | yes |
| sc-07 | 726–833 | The phase slip and the broken sum | Prove a tiny timing error destroys the effect | Same furniture as sc-06, inverted outcome — this is the climax | yes |
| sc-08 | 833–975 | A vertical frequency axis filling with cancellation | Show cancellation covers only the bottom of the spectrum | Whole frame becomes one instrument; no waveforms at all | no |
| sc-09 | 975–1098 | The untouched band above the ceiling | Answer the viewer's own complaint | Same axis, but the motion has moved to the top of the frame and the bottom has gone still | no |
| sc-10 | 1098–1245 | Stillness | Reframe silence as a deadline met | The only motionless shot; the counter appears one last time, frozen | frozen |

**Do any two scenes share a primary visual subject?** No. sc-04 and sc-05 share geometry but
not subject — one is an event (a pulse crossing), the other is a measurement of the space it
crossed. sc-06 and sc-07 share furniture but are the two halves of one proof, and sc-07
inverts its outcome. sc-08 and sc-09 share the axis and split it: the field below the ceiling,
then the activity above it.

**If the signature device were removed, would each scene still work?** sc-01, sc-02, sc-03,
sc-08 and sc-09 never carry it. sc-04 through sc-07 need it — the counter *is* the deadline
those scenes are about. sc-10 needs it frozen, because the freeze is the ending.

## Numbers on screen, and where each comes from

| On screen | Value | Source |
|---|---|---|
| `87 µs` per flight | 3 cm ÷ 343 m/s = 87 µs | Derived; distance from the research brief's mic-to-ear geometry |
| `40 µs` tolerance | feedforward alignment requirement, 40 µs or less | US 9,786,264 |
| `100 µs` failure | 10 % of one 1 kHz cycle | Hacker News latency discussion; 1 kHz period = 1000 µs |
| residual amplitude | `2·sin(π·d/T)` for offset d, period T | Superposition of a sine and its delayed inverse — computed in the composition, not eyeballed |
| `50 Hz – 2 kHz` band | effective range of active cancellation | SoundGuys |

The residual line in sc-06 and sc-07 is not a drawing of failure — it is the actual sum of
the two traces, computed per sample. At 40 µs it is a quarter of the original amplitude; at
100 µs it is nearly two thirds. The picture cannot lie about the physics because it is doing
the arithmetic.
