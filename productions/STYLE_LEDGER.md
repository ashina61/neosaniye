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

## The rule changed on 2026-09-06

The five fields above were written when every video invented its own world, and
they are what stopped the channel making five identical videos. That phase is
over: the channel now has **a character and a look** — Adem, Ink Theater, warm
paper, one weight of ink line, Patrick Hand — and consistency is the point of
them. Rotating the look now would throw away the only thing an audience can
recognise.

So, from the fifth production on:

- **Fixed, on purpose:** the character, the ground, the ink, the type, the
  engine. These are the channel. They are listed in `ink-theater/ADEM.md` and
  `styles/ink-sketch.yaml`, not here.
- **Still may not repeat, and the five tests still apply to them:** the
  **design read**, the **signature device**, the **layout set**, the **motion
  character**, and **which colour means what** (the accents are rationed and
  re-assigned every time; the ground is not).

If two productions in a row share a device or a motion character, that is still
a re-design, exactly as before.

## What does NOT count as variation

Changing only these is not a new design — it is the same video with new data:

- the same layout with a different accent colour
- the same waveform/graph/axis with a different label
- the same typographic treatment at a different size
- the same "hero element repeated every beat with new text underneath"
  (this is the scene-level templating trap; see bespoke-composition.md §1.5)


## Ledger

### 2026-09-06 — why-you-cannot-tickle-yourself
*"You cannot tickle yourself. Here is why."* · 61.7s · **ink-theater + Adem** / hyperframes / atelier

| Field | Value |
|---|---|
| Design read | **Everything in the frame is drawn twice — once as what is about to happen, once as what happens — and the film is the one time they do not line up.** |
| Ground | Warm white paper `#FCFBF8`, live boil. The channel's fixed ground. |
| Palette roles | **One accent, and its job is to disappear.** ink `#333333` = the room, the man, what actually arrives · grey `#8A857A` = the dark through the doorway, the ruler · teal `#0F7B6C` = **what the brain has already worked out, and nothing else.** Teal is drawn only so it can be subtracted; the previous film's accent piled up until it filled the page, this one is spent as fast as it is made, and the payoff is the frame where it fails to be. No orange, no blue, no violet. |
| Signature device | **The prediction, drawn ahead of the event and subtracted by it.** Three copies of one path — teal prediction, ink arrival, paper cancellation — and the paint order is the arithmetic. His own hand: paper wipes everything, the arm stays blank. Somebody else's: nothing predicted it, the whole ink stroke stays. Delayed by 200ms: nothing cancels, and **the gap between the two leading edges is the delay.** The soundtrack does the same sum with the same waveform inverted — 9.4 dB between the same stroke predicted and not, measured out of the finished file. |
| Layout set | **Three setups, nine cuts.** A small bare room with an open doorway and the dark in it (so the other hand has somewhere to come from) · the forearm, big enough to watch · three lanes of time with a minus and an equals sign in ink. The order and its copy are drawn on his own body, not in a diagram. |
| Motion character | **Anticipation.** Every movement is announced before it happens. Exactly one thing is not — the flinch, twice, a four-frame jolt of the whole page. The one un-anticipated event in a film built out of anticipation is the one that makes him jump. |
| Type | Patrick Hand, HTML overlay divs, y=1250. |
| Narrative structure | try it → mechanism → the difference → the counter-example → the experiment → the turn |
| Narration | Kokoro v1.0 `am_michael`, local. Voice measured at **+14.1 dB** over the bed while speaking. |
| Music | A single held low fifth that opens a fourth when the mechanism is named, and nothing else. Under it, twelve synthesised brushes and their inverted predictions. Nothing licensed, nothing sampled. |
| Captions | Burned in, Patrick Hand 62px at y=1250. Two of fourteen lines mark a word, in the one accent. |
| Brand | `InkBrand.mark()` top left with the play triangle in teal; `InkBrand.subscribe()` at 58.50, after the last line. |
| Providers used | none — zero API keys, zero generated images, zero stock, zero licensed audio |

**Burned for future videos:** a prediction drawn ahead of an event, cancellation
by paint order, a soundtrack that is an instance of the argument rather than a
rendering of it, and the un-announced event in a film of announced ones.

### 2026-09-06 — nobody-is-conducting
*"Nobody is conducting the applause."* · 58.2s · **ink-theater + Adem + a simulation** / hyperframes / atelier

| Field | Value |
|---|---|
| Design read | **The frame is a full house seen from the stage, and the film is the twelve seconds in which two hundred pairs of hands stop being two hundred things.** Nobody in it decides anything, Adem included — he is one of the two hundred. The subject is a statistic, and the statistic is loud. |
| Ground | Warm white paper `#FCFBF8`, live boil. The channel's fixed ground. |
| Palette roles | **One accent, and it is a measurement.** ink `#333333` = the hall and the people · grey `#8A857A` = **a clap out of step** · violet `#6B4E9E` = **a clap within half a radian of the room's mean phase, and nothing else.** The amount of violet on the page IS the Kuramoto order parameter — the page goes from a grey shimmer to a wall of violet on one frame and nothing has to say so. First production with a single accent; first with no orange. |
| Signature device | **The simulation is the film.** `sim/kuramoto.py` integrates 120 globally coupled phase oscillators and writes one array. Every hand in the composition is at the phase that array says, and every one of the 17,121 claps in the soundtrack was synthesised at the instant that array says it crossed. Picture and sound are two readings of the same numbers. The argument is not asserted anywhere in the film — it *runs*, twice, and you can hear both times. |
| Layout set | **Four setups, fifteen cuts.** The house in real perspective (front row wider than the frame, cropped by it) · one man in it with four neighbours on their own oscillators · the phase ring, which is the measurement · the spread against the pull, which is the proof. |
| Motion character | **Phase.** Not one thing eases, snaps, springs or travels. Every moving object is a cosine of its own phase — hands on `(1 − cos θ)/2`, dots on the rim at θ, the arrow `r` long at ψ, even the scatter in the diagram bobbing on the phases of the people it stands for. The only tweened positions in the file are the camera and two numbers in one chart. |
| Type | Patrick Hand, HTML overlay divs, y=1250. The channel's type. |
| Narrative structure | phenomenon → mechanism → the constraint that forces it → collapse |
| Narration | **Kokoro v1.0 `am_michael`, local, free, 24kHz.** First production not on Piper, which was the weakest component in the five before it. |
| Music | **First production with a score, and the score is the physics.** A low pad whose amplitude is `r^1.6` — inaudible while the room disagrees, open when it agrees. Under it, 17,121 synthesised claps in eight timbres, each in a seat, panned and attenuated by where that seat is, through a 260ms room. Nothing licensed, nothing sampled. |
| Captions | Burned in, Patrick Hand 62px at y=1250. Two of fourteen lines mark a word, in the one accent. |
| Providers used | none — zero API keys, zero generated images, zero stock, zero licensed audio |
| Note | Atelier composition; `skills/creative/ink-theater.md` declares the style pipeline-exempt. |

**Burned for future videos:** a simulation as the signature device, an accent
whose *quantity* is a measured number, a crowd of many small figures in real
perspective, and a soundtrack synthesised from the same array as the picture.

**Two things that had to be fixed before a crowd read as a crowd,** both now in
`ADEM.md`: rows go into the DOM **back row first** (front-first collapses eight
rows of perspective into a flat knitted pattern), and every head needs a few
percent of jitter in size, height and position — a crowd on a grid is wallpaper.

### 2026-09-06 — the-second-that-hangs
*"The clock isn't broken. You were."* · 48.6s · **ink-theater + Adem** / hyperframes / atelier
· **revised 2026-09-06 (rev 2)** — see the four faults at the bottom of this entry

| Field | Value |
|---|---|
| Design read | **The drawing keeps disappearing, and the man in it never notices.** Not about what the character does — about what is missing from the frame, which is the subject. He stands still for forty-five seconds and the film happens to him. |
| Ground | Warm white paper `#FCFBF8`, live boil. The channel's fixed ground from here on. |
| Palette roles | ink `#333333` = the room, the man, the clock · orange `#D4611B` = **invented time and nothing else** — the arc painted backwards into the gap, then the tally of jumps · blue `#2E6E9E` = **once**, drawn round the whole dial as the honest measure against it · **no red** |
| Signature device | **The blank.** The entire drawing is not there for two frames, nine times — including one 300ms blank under the line *the picture is switched off*, and a last one that never comes back. The tick track is generated from the same function that turns the second hand, so the sound goes out with the picture. The device is the argument. |
| Layout set | **Three setups, eleven cuts, cut on the looks.** A furnished waiting room · the clock face · **his eyes, close enough to watch them jump**. Six of the eleven cuts are placed inside a blank, so the cut itself is invisible and each one also changes the camera scale. Video four was one continuous shot with no cut anywhere in it. |
| Motion character | **Stillness, done with his hands.** The body never leaves one `InkPuppet.still()` pose — but he is holding a paper ticket and the near arm reads it three times, and the far hand finds his hip. One turn away and back; one eyebrow on the last line. The only other things that move are a second hand and the cuts. |
| Type | Patrick Hand, full TTF, HTML overlay divs. The channel's type. |
| Narrative structure | observation → mechanism → scale → turn |
| Narration | Piper `en_US-ryan-high`, 143 words over 48.6s |
| Music | None. One synthesised tick per second of clock time, from `dialSeconds()` — silent through the 2.8s hang, cut out in every blank, fifteen a second under the tally. |
| Captions | Burned in, Patrick Hand 62px **at y=1250**. Three of fourteen lines mark a word, in the colour that beat is using. |
| Providers used | none — zero API keys, zero generated images, zero stock |
| Note | Built as an atelier composition rather than through the 11-stage pipeline; `skills/creative/ink-theater.md` declares the style pipeline-exempt. `source/artifacts/decision_log.json` says so. |

**The four faults in revision 1, and what they cost.** All four were visible to
the viewer in one pass and none of them was visible in a still:

1. **The captions were at y=1660.** On a 1080×1920 Shorts frame everything below
   about 1450 is under the title, the handle, the description and the scrubber.
   Every line of the film was unreadable on the platform it was made for.
   → **The caption band is 1250–1400. Nothing that must be read goes below
   1400, and nothing important goes right of 900 below y=950 either** (the
   button rail). See `productions/ENVIRONMENT.md`.
2. **The sets were empty.** "A room" was a floor line, a skirting, one chair and
   the clock. → **A place needs about ten objects, and `mm()` makes them free.**
3. **The dial carried 22 of 48 seconds**, including six seconds of clock face
   under a sentence about eyes. → **When the film has a subject, show the
   subject.** The fix was a third setup, not a shorter one.
4. **He stood for forty-eight seconds with both arms hanging.** `fig.carry` and
   `fig.hold` existed and were unused. → **Stillness is a body that does not
   travel, not a character that does nothing.** Give him something to hold.

### 2026-09-05 — the-doorway-did-it
*"Why you forget the second you walk in."* · 47.0s · **ink-theater + ink-puppet** / hyperframes / atelier

| Field | Value |
|---|---|
| Design read | A doodle on a sheet of paper is trying to run an errand, and the paper keeps taking it away. The first production that is a character rather than an instrument, and the one that introduced **Adem**. |
| Ground | Warm white paper `#FCFBF8`, no grain, no border, no texture. Live hand-drawn boil on every ink stroke. |
| Palette roles | ink `#333333` = the figure and every object · orange `#D4611B` = **the errand and nothing else** · red `#C8322B` = **once**, on the lid seam of the box that will not open · blue `#2E6E9E` = **once**, drawn along the line of closed lids at the end |
| Signature device | The doorway is a machine: a barrier arm hinged on the left upright at exactly hand height, folded flat up the post until it drops to horizontal and sweeps the errand out of the figure's hand. Every number in its geometry was solved backwards from the requirement that it falls on the word *closes*. |
| Layout set | Not a layout set — **one continuous shot**. A figure pinned at screen centre while the world slides past it, and one pull-back at the end. There is no cut anywhere in the video. |
| Motion character | **Real human motion capture.** Six named CMU clips — march, walk, shuffle, walk mirrored, kick, sit — retargeted onto a hand-drawn stick figure. Hand-authored character motion: 0.0 seconds. |
| Type | Patrick Hand, the full TTF, on HTML overlay divs. The channel's first handwriting. |
| Narrative structure | story |
| Narration | Piper `en_US-ryan-high` at length_scale 1.00, 3.34 w/s measured. Warmer register than the three before it. |
| Music | None. Three synthesised event sounds: a pencil scratch under the draw-in, a wooden clack as the lid stamps, a duller thud on the kick that goes nowhere. |
| Captions | Burned in, Patrick Hand at 62px under the figure's feet. 13 of 28 chunks mark a load-bearing word, and the mark takes the colour the drawing is using on that same beat. |
| Providers used | none — zero API keys, zero generated images, zero stock |

**Burned for future videos (video 5):** the page going blank as a device, the
one-object-drawn-twice trick, a cut hidden inside the device, and the
big-close-up-of-his-own-eyes setup.

**Burned for future videos:** a machine disguised as architecture, an errand as a
coloured object that can be taken, the world-slides-past-a-fixed-character
camera, one-continuous-shot as a structure.

**Explicitly NOT burned — these recur by design:** Adem (the figure, the brush
weights, the face on one side), motion capture as the motion language, and
handwriting as the type when Adem is on screen. These are the channel, not this
video.

**What this one proved:** the channel can *act*. The three before it explained;
this one performs, and the performance carries content no diagram could — a
character not noticing it has been robbed is the doorway effect, exactly, with
nothing left to describe. It also proved the acting does not have to be authored:
the agent chose six clip names and a person from a 2003 mocap session did the
rest.

**Three defects worth remembering, none of them visible in a still:**
1. `transformOrigin` in px on an SVG `<g>` — GSAP needs `svgOrigin` in user units
   there. The figure was off the page for the last third of the video and every
   snapshot looked fine, because the snapshots I chose were of frames where it
   happened to be absent for other reasons. **Sample the finished file.**
2. A mocap segment longer than its clip wraps and starts the action again. `sit`
   is 6.00s; a 6.60s segment sat down twice. `loop: false` holds the last frame.
3. The style's white-dot eyes are invisible on an unfilled head on white paper,
   and a symmetrical stick figure has no facing — so the turn was unreadable
   until the face went on. On a mocap character, the face is not decoration; it
   is the only thing that says which way the motion is going.

**The character stays. This overrides the rotation rule, on purpose.**

My first note here said the next production should not have a character, because
two in a row would make the character the channel rather than the subject. The
user overruled it, and they were right: for a channel with no audience yet, a
character people recognise *is* the asset, and the subject changes every week
anyway. So the figure is now the one thing that carries across productions, and
it has a name — **Adem**.

That changes what this ledger is for. Everything else still may not repeat: the
world, the palette, the signature device, the layout, the motion character. Adem
is the deliberate exception, and the exception is exactly one character. If a
second recurring element appears, the ledger has failed.

**He was redesigned on 2026-09-06 from a reference sheet the user drew up.** The
first version was a fitter in a flat cap and a boiler suit; Adem is a young man
in a t-shirt, real proportions (6.7 heads, not 5.4), clean line art at the set's
own weight, and exactly one solid mass on him — his hair. Two things carried
over and are worth keeping if he is ever revisited: **one dark shape** gives the
eye somewhere to land and is what survives at thumbnail size, and **line weight
has to be in page pixels** (`unit: SCALE`), or he renders at nearly twice the
weight of everything he is standing next to.

Adem lives in `ink-theater/ink-figure.js`, not in any one video's HTML, so the
next production inherits the drawing rather than redrawing it. The rig, the
clips and the determinism are InkPuppet's; the body, the brush weights, the
hands, the feet and the face are Adem.

**The clip library was re-derived on 2026-09-06 and the fourth video no longer
reproduces from its source.** `bvh2clip.mjs` had been projecting every clip onto
world X whatever direction the subject actually walked in, so a CMU subject who
walked along Z came out front on: shoulders 145 units apart, a 30-unit stride on
a 538-unit figure. Every clip is now projected side on, carries root motion, and
has its leading T-pose trimmed. The committed mp4 of the-doorway-did-it is
unaffected — it is a rendered file — but its composition was fitted to the old
projections number by number, so re-running it produces something else.
Rebuilding it on the current rig means re-solving its geometry. That is a real
cost and it is the right trade: the walk was the weakest thing in it.

What the second pass on him fixed, and what the next production inherits for
free: every part is now paper-filled with an ink outline, like the head and like
the world, so limbs occlude each other instead of merging into one black shape;
the torso is a closed outline measured off the spine rather than a ribbon; the
feet take their angle from the shin and flatten as they plant; and the carrying
arm is measured from the shoulder, because the CMU clips are shot from different
angles and have mixed handedness, so a chest-relative reach that is comfortable
in `walk` is off the end of the arm in `shuffle`. `InkPuppet.STAND` itself was
mirrored relative to every clip in the catalogue — a bug that had been sitting
in the engine, not in the video.

He is now written down. **`ink-theater/ADEM.md` is the character sheet** — the
locked proportions, how to pose him, how to scale a scene off him, and every
trap that has cost a render. A composition attaches him with no options; passing
options makes a different character. `ink-theater/tests/adem-door/` is the
reference build: he walks to a door, works the lever and pushes it open, with
every dimension on the page derived from a real millimetre figure and the leaf
projected in one-point perspective. Nothing in it is narrated, scored or
captioned — it exists so the next video does not have to rediscover any of it.

**Worlds used so far:** Remotion atelier ×2, Manim ×1, Ink Theater ×1. Three.js,
HyperFrames-as-a-style (kinetic typography), Mermaid and code are untouched. Ink
Theater may be used again *because Adem lives there* — but if it is, the world has
to be pushed somewhere it has not been: a different ground, different props,
different camera. The character recurring is not a licence for the video to.


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
