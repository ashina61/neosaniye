# Per-scene plan — no hero-component spine

Required by `skills/meta/bespoke-composition.md` §1.5.

| # | Frames | Primary visual subject | Why this beat exists | How it differs from its neighbours | Arrows? |
|---|---|---|---|---|---|
| sc-01 | 0–114 | A shoreline with two tide marks | Put the phenomenon on the page before any explanation | Low horizon, most of the page empty; the only scene at human scale | no |
| sc-02 | 114–371 | The familiar two-bulge plate | Show the diagram the viewer was taught, faithfully | Planetary scale, centred figure — the opposite framing to sc-01 | no |
| sc-03 | 371–623 | A struck-out margin annotation | Name the wrong answer and mark it wrong | The only handwriting in the video; first vermilion | no |
| sc-04 | 623–780 | Three unequal arrows | Establish that the pull is three different pulls | Body stripped bare; drawing paced to the voice, one arrow per clause | **yes** |
| sc-05 | 780–904 | A measured inset at the margin | Make the gradient visible on its own, away from the geometry | The drawing steps outside itself to measure — happens once | echo |
| sc-06 | 904–995 | The subtraction | Both bulges fall out as arithmetic | Shortest scene, single continuous move, no text at all | **yes** |
| sc-07 | 995–1216 | A bathtub | Prove the mechanism by removing it | Same ink, same scale, different object; the only scene where nothing moves | equal |
| sc-08 | 1216–1305 | A figure caption | Give the viewer a definition to carry | Pure typography on a nearly bare page | no |
| sc-09 | 1305–1395 | A departing Moon | End on a process, not a summary | The only scene cut mid-motion | no |

**Do any two scenes share a primary visual subject?** No. sc-04 and sc-06 share
the arrows but not the subject: one establishes three quantities, the other
performs an operation on them and produces a different picture. sc-02 and sc-07
share the figure position on the page, which is the point of sc-07 — the
substitution has to be felt.

**If the signature device were removed, would each scene still work?** sc-01,
sc-02, sc-03, sc-08 and sc-09 never carry it. sc-04 and sc-06 are the device.
sc-05 echoes it deliberately, as a measurement of what sc-04 established, and
sc-07 uses it inverted — three arrows that are all the same, which is the whole
joke.

## Numbers and claims on screen

Nothing numeric appears on screen in this video. Every claim is carried by the
drawing or the narration, and each narration claim is sourced in
`artifacts/script.json → metadata.grounding`:

| Beat | Claim | Source |
|---|---|---|
| sc-03 | centrifugal force is a misconception here | arXiv 1506.04085 |
| sc-04 | the Moon's pull varies across the Earth | NOAA National Ocean Service |
| sc-06 | the differential force produces both bulges | NOAA; Strassler |
| sc-07 | a bath has no tide | NASA Science |

The arrow lengths in sc-04 are not decorative: near, centre and far are drawn in
proportion to `1/r²` at the Moon's actual distance, exaggerated by a constant
factor so the difference is visible on a phone. The exaggeration is uniform, so
the *ratios* on screen are the real ones.
