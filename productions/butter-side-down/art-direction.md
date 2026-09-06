# Butter Side Down — art direction

Read `productions/MANIFESTO.md`, `productions/STYLE_LEDGER.md` and
`ink-theater/ADEM.md` before this. Eighth production.

## The design read

**A kitchen, and one question asked five times: how far did it get to turn
before the floor arrived.**

## The signature device: the rotation gauge

A dial locked to the toast that fills with the angle it has turned through.
Every beat of the film is that one number, and the whole argument is which side
of 360° you land on.

**And it is not fitted.** Angular speed is set at the edge and does not change
in flight; fall time goes as `sqrt(h)`. So four times the height is twice the
fall and twice the turn:

| | fall | turn | |
|---|---|---|---|
| a table, 0.75 m | 0.391 s | **190°** | butter side down |
| three metres | 0.782 s | **380°** | all the way round |

190 and 380 are one number, not two. That is why three metres is the answer
rather than a guess, and the comparison shot puts both dials side by side so you
can read it off them.

## The soundtrack carries the punchline

Two landings, and the difference between them is the film:

- **a wet slap** — a low body with almost no ring and a short damped mid burst.
  Butter, on a hard floor.
- **a dry clack** — an octave up, and it rings. Crust.

Both are synthesised in numpy from `ink-theater/sfx.py`. The fall itself is
driven by the same physics as the picture: a whoosh whose level rises as `v²`,
fluttering once per half turn because the thing is rotating, for exactly as long
as the fall actually takes. Nothing in the narration points at any of it.

The subscribe tap now has a click — two very short transients, the press and a
tiny release 28 ms later, because one click on its own sounds like a fault.

## The annotation layer — new in this production

The note on the seventh video was that in some shots you cannot tell what you
are looking at. That was a missing **layer**, not a drawing problem: every
technical illustration ever made has handwritten labels and arrows over the
picture, and this channel did not have one. `ink-theater/annotate.js` is now
part of the engine:

```js
InkAnnotate.callout(tl, g, { at: 10.1, out: 13.1, text: "it pivots here",
                             x: 640, y: 300, to: [248, 400], bend: 40 });
InkAnnotate.measure(tl, g, { at: 27.0, out: 30.6, from: [462,1150], to: [462,1000],
                             text: "75 cm" });
InkAnnotate.ring(tl, g, { at: 29.1, out: 30.6, cx: 396, cy: 1120, r: 78 });
```

The rules it enforces, written into the file: an arrow aims at the **edge** of
the thing and uses `bend` to swing clear of everything between; two labels on
screen at once is the limit; never in the caption band; and they are **written
on** rather than faded in, because a label that fades is a graphic laid over a
drawing and a label that is written is part of it.

## Layout set: four setups, seven cuts

| | |
|---|---|
| **the kitchen** | a table drawn from a NUMBER, so it can grow to three metres while he stands next to it |
| **the fall** | the edge, the toast, the dotted parabola of the centre of mass, and the gauge |
| **the comparison** | two tables, two dials, two landings — 190° and 380° in one frame |
| **the chain** | atoms → how hard they hold on → how tall you can be → how high a table is → 190°, assembled one link per clause with arrows |

**The camera pulls back to 0.60 as the table grows,** so a three metre table
fits and he goes small in the frame doing nothing. That is the joke, and it is a
camera move rather than a cut.

## Motion character: free fall

**There is no easing function in this film except gravity.** Every falling thing
is at `y = ½gt²` and every turning thing at `θ = ωt`, computed from the real
numbers, and the only reason anything ever moves slowly is that the film slows
time to one eighth so you can watch a third of a second happen.

The seven before this: constant velocity · spring overshoot · mechanical
stepping · motion-capture locomotion · stillness with his hands · phase ·
anticipation.

## Palette: one accent, and the only thing that happens to it is which way up it is

| Role | Value | Rule |
|---|---|---|
| Paper | `#FCFBF8` | the channel's ground |
| Ink | `#333333` | the kitchen, the man, the toast |
| Grey | `#8A857A` | the tiles, the trace, the dimension lines |
| **The buttered face** | **`#A8710C`** | **and nothing else** |

The ochre never changes amount and never changes intensity. The only thing that
ever happens to it is that it ends the film underneath instead of on top — and
that is the answer. Video six's accent piled up; video seven's was spent as fast
as it was made; this one just turns over.

## The distinctness test

*Could this be any other video's frame?* No: a dial reading 190° beside a slice
of toast halfway to the floor.

*Does it reuse a look I have made before?* No, on all five ledger fields.
