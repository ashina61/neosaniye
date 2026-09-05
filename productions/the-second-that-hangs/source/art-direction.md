# The Second That Hangs — art direction

Read `productions/MANIFESTO.md`, `productions/STYLE_LEDGER.md` and
`ink-theater/ADEM.md` before this. Fifth production, first one with Adem in his
settled design.

## The design read

**The drawing keeps disappearing, and the man in it never notices.**

Video four's read was a doodle trying to run an errand while the paper took it
away — the character was the subject. This one is not about anything he does.
It is about **what is missing from the frame**, which is exactly what the
subject is. He stands still for forty-five seconds and the film happens to him.

## The signature device: the blank

Every time his gaze jumps, **the entire drawing is not there for two frames.**
Sixty milliseconds of empty paper, eight times, plus one long one of three
hundred milliseconds under the line *the picture is switched off* — the caption
says it and the page does it — and one at the end that never comes back.

The sound goes with it. The clock's tick and the clock's hand are driven by the
same function, `dialSeconds(t)`, and the tick track was generated from that same
function in Python with the blank list applied. When the picture stops, the tick
stops. Nothing about that is decorative: the device **is** the argument, so
there is nothing left to explain.

## Layout set: a cut on every look

Two setups and nothing else — **the room**, and **the clock face**. The film
alternates between them and the cuts land where his eyes would move. Six cuts.

Video four was one continuous shot with no cut anywhere in it, and said so in
writing. This is the opposite, deliberately.

The second stretch on the clock face originally ran twenty-one seconds with only
the caption changing. That is the templating trap the ledger names, so it is cut
back to him for the two lines that are about him rather than about the clock.

## Motion character: stillness

He stands. He turns his back once and turns round once, and on the last line one
eyebrow moves. That is the entire performance. The only things that move in this
film are a second hand and the cuts.

The stand is `InkPuppet.still("shuffle", 34)` — a real captured frame, not the
hand-authored `STAND`, which is a different size from the clips. It runs from
t=0, because otherwise he holds the wrong pose through the whole draw-in.

## One clock, drawn twice

`drawClock(parent, cx, cy, R)` is called by both setups, so the face in the
close-up is **provably** the same object as the one on the wall — same twelve
hour marks, same sixty minute marks, same hands, same counterweight. A 300mm
wall clock, its centre 1900mm off the floor.

Its second hand is never tweened. It is `Math.floor(dialSeconds(t)) * 6`
degrees, so it ticks rather than sweeps, and the hang is a plateau in that one
function rather than an animation that has to be kept in sync with anything.

## Palette

| Role | Value | Rule |
|---|---|---|
| Paper | `#FCFBF8` | the channel's ground |
| Ink | `#333333` | the room, the man, the clock |
| **Invented time** | `#D4611B` | the stretch the brain paints over the gap, and **nothing else** — the backfilled arc, then the tally of jumps |
| **True time** | `#2E6E9E` | **once**, at the end, drawn round the whole dial as the honest measure against the orange |
| — | | **no red in this film** |

Video four used orange for the errand, red once on a lid seam and blue once
along a line of lids. Here orange is a quantity of time, blue is the quantity it
is measured against, and red does not appear.

## Sound

Silence, one tick, and a voice. The tick is two decaying partials at 2.15k and
4.9k with a breath of noise, one per second of clock time, generated from
`dialSeconds` — so it stops dead during the hang, cuts out in every blank, and
rattles up to fifteen a second during the tally. No music.

## The distinctness test

*Could this be any other video's frame?* No: a wall clock, a chair, and a man
who does not move.

*Does it reuse a look I have made before?* No, on all five ledger fields. The
read, the device, the layout set, the motion character and the palette roles are
all new. The ground, the character and the type are the channel's, which is now
deliberate — see the ledger.
