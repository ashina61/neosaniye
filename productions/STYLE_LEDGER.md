# Style ledger

Every production in `productions/` gets one row here, written when it ships.

Read [`MANIFESTO.md`](MANIFESTO.md) first — it says what kind of channel this is
and lists the drawn worlds available. Then read this.

**Treat the rows below as a list of things you may not do again.** An agent has no memory across sessions; this file is the
memory. Without it, the second video quietly inherits the first one's habits and
we are back to five identical videos.

## The rule

A new production may not reuse, from any row below:

1. the **design read** — the one-sentence description of what the frame *is*
2. the **palette roles** — which colour means what, and the ground
3. the **signature device** — the recurring element that carries the argument
4. the **layout set** — how the frame is divided across beats
5. the **motion character** — how things enter, move and stop

Overlap on one of the five is a warning. Overlap on two is a re-design: go back
to `skills/meta/taste-direction.md` and find the direction that belongs to *this*
subject and no other.

The test at the end, from `skills/meta/bespoke-composition.md`: *could this be
any other video's frame? does it reuse a look I have made before?* If either
answer is yes, the art direction failed.

## What does NOT count as variation

Changing only these is not a new design — it is the same video with new data:

- the same layout with a different accent colour
- the same waveform/graph/axis with a different label
- the same typographic treatment at a different size
- the same "hero element repeated every beat with new text underneath"
  (this is the scene-level templating trap; see bespoke-composition.md §1.5)


## Ledger

### 2026-09-05 — the-digit-that-catches-liars
*"One digit shows up 30% of the time."* · 56.6s · **manim** (picture) + remotion / atelier (glass)

| Field | Value |
|---|---|
| Design read | A machine shop for numbers. The frame is a slate bench with a measuring instrument on it, and the video is that instrument being read. |
| Ground | Flat slate `#161A26`. No grain, no glow, no border, no texture of any kind. |
| Palette roles | bone `#F0EAD8` = structure and all language · `#79809A` = scaffolding that is not the subject · chartreuse `#C9E265` = whatever is measurably true · magenta `#E5487B` = **used once**, in sc13, on the data the ruler cannot read. Fabricated data is hollow bone outline — empty rather than coloured, so the real/fake contrast costs no hue. |
| Signature device | A vernier caliper: fixed full-width beam, two sliding jaws, and the reading on the instrument rather than over the measurement. It measures a digit's stretch in sc07 and the span of a dataset in sc12–13 — the power and the limit as the same gesture. |
| Layout set | scatter of unlike magnitudes · 3×3 grid of hollow boxes · descending bar column · a bare rule on an empty frame · a segmented ruler with digits under each stretch · a chartreuse span whose labels change decade while it does not move · a caliper above the ruler · a tally growing above the ruler · nine stretches standing up into a chart · a ledger over a flat hollow tally · one typographic figure overwritten in place · a five-decade ruler with a sample cloud · the same ruler with the jaws almost shut |
| Motion character | Mechanical stepping. Things snap between fixed positions or run at a machined constant rate; nothing eases in, nothing overshoots. **Exactly one exception** — sc09, where the ruler stands up into the chart — and it is the centrepiece because everything around it is machined. |
| Type | Space Grotesk 500/700 for language, Space Mono 400 for every measured number. Numbers are always mono and language is never mono; the distinction is load-bearing. |
| Narrative structure | problem_solution, ending on the limit of the solution rather than on the solution |
| Narration | Piper `en_US-ryan-high` at length_scale 0.98, 3.23 w/s measured |
| Music | None. Silence under the voice, and one locally synthesised machined tick per caliper move — sixteen in total, and no other sound in the video. |
| Captions | Burned in, Space Grotesk 500 at 54px centred in the clear band under the drawing. Twelve chunks mark a load-bearing word in the accent; the last marks one word in the reserved colour, on the same beat as the only magenta in the picture. |
| Providers used | none — zero API keys |

**Burned for future videos:** the slate/bone/chartreuse instrument palette, the
caliper, hollow-outline-as-fabricated, stepped motion with one eased exception,
the "labels change but the bar does not move" proof, the chip-as-index-mark
(accent bar plus letterspaced caps), Space Grotesk with Space Mono.

**One honest overlap to record:** the caliper is adjacent to the engineering
dimension line used once in *how-headphones-erase-sound*. They are drawn as
different objects — a caliper has a beam, jaws and feet and is present as a tool;
a dimension line is an annotation — and the overlap is part of one field out of
five, which the rule above treats as a warning, not a re-design. The next
production should not reach for a measuring instrument at all.

**What this one proved:** the drawn world can be *split* — Manim for every pixel
of the picture, Remotion for the chip, the captions and the annotation over it.
That is the reference video's grammar with drawn footage underneath, and it is
reusable as an *architecture* without reusing anything about the look. It also
doubles the failure surface: on the first render, two Remotion annotations had no
upper frame bound and leaked across every later shot, and four Manim shots were
out of sync with the narration by up to 1.3 seconds. Both classes of bug are
invisible in stills and only show up when you sample the finished file.

**Worlds used so far:** Remotion atelier ×2, Manim ×1. Three-JS, Ink Theater,
HyperFrames, Mermaid and code are untouched. The next production may not use
Manim.

### 2026-09-04 — why-the-sea-rises-twice
*"The Bulge Nobody Can Explain"* · 46.5s · remotion / atelier

| Field | Value |
|---|---|
| Design read | A page from a physics book, being corrected in front of you. |
| Ground | Warm paper `#EDE6D6` with a deterministic grain and a soft plate border |
| Palette roles | ink `#141210` = the drawing · sea blue `#1F4E6B` = water only · vermilion `#C1452F` = force only |
| Signature device | Three arrows of unequal length along the Moon's axis; used in two beats, and the middle one is subtracted in the second |
| Layout set | shoreline section with hatched rock · centred plate with an ocean ring · struck-out margin annotation · three arrows on a bare body · measured inset against a baseline in the upper third · vector subtraction · a bathtub in the figure's position · a figure caption low-left · a departing Moon |
| Motion character | Ink draws on and settles with a spring overshoot. Nothing at constant velocity. Cut mid-motion at the end — the Moon is still drifting. |
| Type | Spectral 600 for language, Spectral 400 letterspaced for labels, Caveat 600 for exactly one struck-out annotation. No monospace. |
| Narrative structure | myth_busting |
| Narration | Piper `en_US-ryan-high` at length_scale 1.12, 3.27 w/s measured |
| Music | Silent underneath; one low swell arriving at 39.6s and never resolving |
| Captions | Burned in, in the plate's own serif at y=1270, skipped over the closing figure caption so no phrase is doubled |
| Providers used | none — zero API keys |

**Burned for future videos:** paper-and-ink plate framing, the annotate-then-strike-out
correction device, arrows-as-argument, an ocean drawn as a ring around a circle, the
bathtub-as-control-experiment gag, ending on unresolved drift.

**Captions are now expected on every video.** Timings come from
`scripts/../captions.py`: the narration is synthesised from text we wrote, so the
words are known and only their position inside each measured section is
estimated by character count. Whisper would be more exact but its models come
from HuggingFace, which this environment denies. Style the caption band per
piece — it is a design element, not a fixture.

**Note on the pair so far:** both videos are line drawings on a flat ground with
even narration and near-silence. Photography is off the table by choice — see
`MANIFESTO.md` — so the third has to break the groove from inside the drawing:
a different *world* (Manim, Three.js, Ink Theater, kinetic typography), not a
different palette. Two data points do not make a house style. Three would.

### 2026-09-03 — how-headphones-erase-sound
*"The Deadline Inside Your Headphones"* · 41.5s · remotion / atelier

| Field | Value |
|---|---|
| Design read | An oscilloscope in a dark room. The frame is a measuring instrument. |
| Ground | Near-black ink `#080B10` with a faint breathing grid |
| Palette roles | cyan `#3FE0D0` = the outside world · amber `#FF8A3D` = the headphone's answer · white `#F2F5F7` = language only |
| Signature device | A running microsecond counter in the right margin, frozen in the last shot |
| Layout set | full-frame vertical trace · mirrored horizontal traces · empty frame with type low-left · mic-to-ear vertical axis · engineering dimension line · full-height logarithmic frequency axis |
| Motion character | Constant velocity, no eased arrivals — things are in flight. One exception: the phase slip interpolates. Ends on the only motionless shot. |
| Type | Archivo 800 for the three spoken-in-words moments; JetBrains Mono for every number |
| Narrative structure | data_narrative |
| Narration | Piper `en_US-ryan-high`, 3.32 w/s measured |
| Music | Self-produced pulse, stops before the closing line |
| Providers used | none — zero API keys |

**Burned for future videos:** oscilloscope framing, cyan/amber signal pair on
near-black, running-counter-as-spine, waveform-on-a-grid as the primary subject,
"the only still frame is the ending" as the closing device.

<!--
Row template — copy, fill, keep the burned-list honest.

### YYYY-MM-DD — <slug>
*"<title>"* · <seconds>s · <runtime> / <mode>

| Field | Value |
|---|---|
| Design read | |
| Ground | |
| Palette roles | |
| Signature device | |
| Layout set | |
| Motion character | |
| Type | |
| Narrative structure | |
| Narration | |
| Music | |
| Providers used | |

**Burned for future videos:**
-->
