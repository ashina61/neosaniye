# Why You Cannot Tickle Yourself — art direction

Read `productions/MANIFESTO.md`, `productions/STYLE_LEDGER.md` and
`ink-theater/ADEM.md` before this. Seventh production.

## The design read

**Everything in the frame is drawn twice — once as what is about to happen, once
as what happens — and the film is the one time they do not line up.**

## The signature device: the prediction, drawn ahead, and subtracted by the event

A teal line is laid along his forearm *before* the finger gets there. Three
paths, one geometry, and the paint order is the arithmetic:

```
ghost   teal,  30px   the prediction        revealed to p(t)
real    ink,   15px   what arrived          revealed to q(t)
cancel  paper, 40px   where they coincided  revealed to matched ? min(p,q) : 0
```

- **His own hand.** `p` runs 7.5% ahead of `q` and `matched = 1`, so paper wipes
  everything the finger has passed. The arm stays blank behind it and a short
  teal lead is eaten in front of it. That is why you feel nothing.
- **Somebody else's hand.** `p = 0` — nothing predicted it — so `cancel = 0` and
  the whole ink stroke stays on his arm.
- **The delayed hand.** `p` runs 200 ms ahead and `matched = 0`, so nothing
  cancels: teal and ink both survive, and **the gap between their two leading
  edges is the delay.** You are looking at the experiment.

## The soundtrack does the same arithmetic

Every touch is a synthesised brush of filtered noise. **Every prediction is that
same waveform, inverted, at the instant the model says the touch will land**, and
`sim/mix.py` adds them together:

| | what the mixer does | what survives |
|---|---|---|
| his own hand | `+brush(t) − 0.88·brush(t)` | 12% |
| somebody else's | `+brush(t)` and nothing else | all of it |
| delayed | `+brush(t+0.2) − 0.88·brush(t)` | both, 200 ms apart |

Measured out of the finished file: **9.4 dB** between the same stroke predicted
and not. The film never claims the subtraction happens. It performs it, in the
picture and in the speakers, off one list of twelve events that both read.

The last delayed stroke is placed at 49.95 s, in a caption gap, so the doublet
lands in silence — 34 → 103 rms — immediately before the line *And it tickles.*

## Layout set: three setups, nine cuts

| | | |
|---|---|---|
| **A** | a small bare room — a bulb, a shelf, a switch, and an open doorway with the dark in it | the doorway is there so the other hand has somewhere to come from |
| **B** | the forearm, big enough to watch the subtraction happen | |
| **C** | three lanes of time: prediction, touch, and what is left over | the third lane is the film |

Setup C carries a minus and an equals sign in ink and a time ruler underneath.
No language, and none needed: it is arithmetic, and everyone can read it.

The order and its copy are drawn **on his own body** rather than in a diagram —
an ink line down to the hand, and a teal one that branches at the top, goes the
long way round and still arrives first.

## Motion character: anticipation

**Every movement in the film is announced before it happens.** Exactly one thing
is not: the flinch, twice — a four-frame jolt of the whole page and his brows
dropping. The one un-anticipated event in a film built entirely out of
anticipation is the one that makes him jump, which is the argument.

The six before this were: constant velocity in flight · spring overshoot ·
mechanical stepping · motion-capture locomotion · stillness with his hands ·
phase. This is none of them.

## Palette: one accent, and its job is to disappear

| Role | Value | Rule |
|---|---|---|
| Paper | `#FCFBF8` | the channel's ground |
| Ink | `#333333` | the room, the man, what actually arrives |
| Grey | `#8A857A` | the dark through the doorway, the ruler |
| **Predicted** | **`#0F7B6C`** | what the brain has already worked out, **and nothing else** |

Teal is drawn **only so it can be subtracted.** The previous film's accent piled
up until it filled the page; this one is spent as fast as it is made, and the
payoff is the frame where it fails to be. No orange, no blue, no violet.

## The channel

`InkBrand.mark()` top left, its play triangle in this film's teal.
`InkBrand.subscribe()` at 58.50 — after the last line, never over one.

## The distinctness test

*Could this be any other video's frame?* No: a man stroking his own forearm
while a green line runs ahead of his finger and vanishes under it.

*Does it reuse a look I have made before?* No, on all five ledger fields. And it
is the only one so far in which the sound is not a rendering of the argument but
an instance of it.
