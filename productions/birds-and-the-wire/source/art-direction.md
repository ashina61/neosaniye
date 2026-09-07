# Birds and the wire — art direction

**The claim.** A bird on an 11 kV line is not insulated, is not lucky, and is
not standing on rubber. It is fine because both of its feet are at the same
potential, and current needs a difference. What kills birds is bridging: two
conductors, or a conductor and something earthed.

## The design read

**The frame keeps being re-read.** The same strokes are a street in one shot
and a height diagram in the next, because that is what the physics says:
there is no such thing as high voltage, only a drop between two places. So the
film draws voltage as elevation, and the punchline of the middle section is
that the wire — eleven thousand volts, sixty feet up — is the **flattest place
in the picture**.

## The device: the drop

Every creature in this film is drawn touching something, and the only number
on the page is the difference between the things it touches. It reads **zero**
for two thirds of the film:

| beat | what is touched | the drop |
|---|---|---|
| the bird on one wire | wire, wire | 0 V |
| the diagram | top shelf, top shelf | 0 V |
| a second conductor | top shelf, lower shelf | a step |
| a wingspan | two wires | an arc |

The ball is the charge, and it only ever moves down a step. It sits perfectly
still for eleven seconds on a flat shelf, which is the argument stated as a
picture rather than a sentence.

## The accent is embargoed

One accent — **red `#C8322B`** — and it means *a potential difference and
nothing else*. There is therefore **no red anywhere in the first twenty-nine
seconds of the film**, including on the channel's own logo, which wears grey
here, and on the subscribe card, which wears ink. The first red in the film is
the step under the bird's foot. The last is the arc.

## The sound follows the same rule

The wire hums from the first frame: 50 Hz and its harmonics, quiet, steady,
going nowhere — eleven thousand volts sitting there with nothing to flow into.
When the step appears the hum **grows a 100 Hz buzz it did not have**; nothing
new is mixed in, the same oscillator opens. Its level was set by measurement
rather than taste: at the first setting the bed sat 5 dB *above* the narration
and the film was a hum with a man talking over it.

Two buses, ducked differently — ambience at the house 0.86, and the events the
film itself makes at 0.34, because ducking the arc under the narration buried
the one bang in the film.

## What is not in it

No stock, no generated images, no licensed audio, no API keys. Every sound is
synthesised in numpy through `ink-theater/sfx.py`; the narration is Kokoro
v1.0 `am_michael` running locally; the drawing is `ink-theater` and Adem.
