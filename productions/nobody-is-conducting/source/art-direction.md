# Nobody Is Conducting — art direction

Read `productions/MANIFESTO.md`, `productions/STYLE_LEDGER.md` and
`ink-theater/ADEM.md` before this. Sixth production.

## The design read

**The frame is a full house seen from the stage, and the film is the twelve
seconds in which two hundred pairs of hands stop being two hundred things.**

Nothing in it is a character doing something. Adem is in it, but he is one of
the two hundred and he does not decide anything; the subject is a statistic,
and the statistic is loud enough to hear.

## The signature device: the simulation *is* the film

`sim/kuramoto.py` integrates a globally coupled Kuramoto model — one phase
oscillator per pair of hands — and writes one array. **Every hand in this
composition is at the phase that array says it is at, and every clap in the
soundtrack was synthesised at the instant that array says it crossed.** The
picture and the sound are two readings of the same numbers. There is no
keyframe on a hand anywhere in the file and no sequenced beat anywhere in the
mix; the only tweened positions in the whole video are the camera and two
numbers in one diagram.

This is the first production where the argument is not illustrated but *run*.
Kuramoto locks when the coupling beats the spread of natural rates:

```
K > Kc = 2 σω sqrt(2/π)
```

and Néda et al. measured that a crowd's spread of clapping rates is a roughly
constant **fraction** of its rate — about 15%. So `Kc` scales with the rate and
`K` does not:

| the room claps at | its spread σω | the threshold Kc | the coupling K | |
|---|---|---|---|---|
| 4.0 /s | 3.90 | **6.22** | 4.60 | no lock, for anybody, ever |
| 2.0 /s | 1.95 | **3.11** | 4.60 | **locks**, with nobody deciding to |
| 3.7 /s | 3.61 | **5.75** | 4.60 | comes apart again |

Nothing was tuned to produce the film's arc. The arc is what those three lines
do. The room does not *choose* to halve its speed — halving is the only state in
which it can agree, and agreeing is what it was trying to do.

Measured out of the finished audio, folding the amplitude envelope at the beat:

| | peak-to-trough |
|---|---|
| 1–7s, clapping at 4/s | **1.35 : 1** — a wash |
| 12–20s, clapping at 2/s | **3.16 : 1** — a pulse |
| 53–57s, back up to 3.7/s | **1.44 : 1** — a wash again |

## Layout set: four setups, fifteen cuts

| | | |
|---|---|---|
| **A** | the house, from the stage | eight raked rows of fourteen and a balcony of eight — the same 120 seats the sound is panned across |
| **B** | one man in it | Adem and four neighbours, all five clapping on their own oscillators |
| **C** | the phase ring | the measurement: one dot per pair of hands, and an arrow whose length is how much the room agrees |
| **D** | the spread against the pull | the proof, and the only diagram in the film |

A's perspective is real: the front row is wider than the frame and is cropped by
it, which is what a house looks like from where the performer stands. Two things
had to be fixed before it read as people at all, and both are now in `ADEM.md`:
the rows go into the DOM **back row first** (front-first collapses eight rows of
perspective into a flat knitted pattern), and every head gets a few percent of
jitter in size, height and position — a crowd on a grid is wallpaper.

## Motion character: phase

**Not one thing in this film eases, snaps, springs or travels.** Every moving
object is a cosine of its own phase. Hands open and close on `(1 − cos θ)/2`,
dots ride the rim of the ring at θ, the arrow is `r` long at `ψ`, and even the
dots in the diagram bob on the phases of the people they stand for. The whole
piece is a hundred and twenty oscillators drifting into alignment and back out.

The five previous productions were: constant velocity in flight · spring
overshoot on draw-on · mechanical stepping · motion-capture locomotion ·
stillness. This is none of them.

## Palette: one accent, and it is a measurement

| Role | Value | Rule |
|---|---|---|
| Paper | `#FCFBF8` | the channel's ground |
| Ink | `#333333` | the hall, the people, the axis |
| Grey | `#8A857A` | a clap **out of step** — a scratch |
| **In step** | **`#6B4E9E`** | a clap within half a radian of the room's mean phase, **and nothing else** |

This is the first production with a **single** accent. It is not a highlight and
it is not decoration: **the amount of violet on the page is the order
parameter.** A clap out of step is a faint grey scratch; a clap in step is a
violet star and violet hands. You do not have to be told the room has locked,
because the page goes from a grey shimmer to a wall of violet on one frame.

No orange anywhere — it has carried the subject quantity in two videos running
and needed to stop.

## Sound

The first production with a score, and the score is the physics.

- **17,121 claps**, each one synthesised — a noise burst through a bandpass with
  a 10–28 ms decay and a low body thump, in eight timbres, one per pair of
  hands — placed at the exact instant its oscillator crossed a whole turn, in a
  seat, panned and attenuated by where that seat is in the hall.
- **A short room.** The first mix used a 440 ms hall and the rhythm vanished: at
  two claps a second the beat period is 500 ms and a long tail fills every gap
  between beats. 260 ms, mostly dry.
- **The instant, not the frame.** The first version quantised the claps to
  30 fps and jittered them inside the frame, which puts ±16 ms of noise on top
  of a unison only ±48 ms wide. The simulation now emits the exact crossing time
  and the mix uses it.
- **The pad is the order parameter.** The only tonal element is a low pad whose
  amplitude is `r^1.6`. It cannot be heard while the room disagrees, and it
  opens up when the room agrees. That is the entire score, and it is not
  playing along with the film — it *is* a reading of the film.
- **Narration: Kokoro v1.0, `am_michael`, 24 kHz, local, free.** The first five
  productions used Piper, which was the weakest component in all of them.

## The frame

Shorts owns everything below y≈1450 and the right rail under y≈950. The house
runs 200–1200 and the captions 1250–1400.

## The distinctness test

*Could this be any other video's frame?* No: two hundred people clapping,
counted.

*Does it reuse a look I have made before?* No, on all five ledger fields. And
one thing it does has never been done here at all: the deliverable and its
soundtrack are two views of one array, and the claim is not asserted anywhere —
it happens, twice, and you can hear both times.
