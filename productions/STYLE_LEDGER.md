# Style ledger

Every production in `productions/` gets one row here, written when it ships.

**Read this before designing a new video, and treat it as a list of things you
may not do again.** An agent has no memory across sessions; this file is the
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

**Note on the pair so far:** both videos are now line drawings on a flat ground with
narration and near-silence. The third should break that too — a piece with real
photographic texture, or one built on typography rather than diagram, or one with
an actual music bed. Two data points do not make a house style, but three would.

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
