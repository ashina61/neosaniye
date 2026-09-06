# The Second That Hangs — art direction

Read `productions/MANIFESTO.md`, `productions/STYLE_LEDGER.md` and
`ink-theater/ADEM.md` before this. Fifth production, first one with Adem in his
settled design.

**Revision 2.** The first cut shipped with four faults, all of them real:
the sets were empty, the close-up of the dial carried too much of the film on
its own, he stood for forty-eight seconds without using his hands, and the
captions sat at y=1660 — underneath the Shorts title block, where they cannot
be read at all. Everything below describes the film as it now stands; where a
decision changed, the old one is named.

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

**Three** setups, eleven cuts:

| | | |
|---|---|---|
| **A** | the waiting room | 19.4s |
| **B** | the clock face | 19.0s |
| **C** | **his eyes**, close enough to watch them jump | 10.2s |

Video four was one continuous shot with no cut anywhere in it, and said so in
writing. This is the opposite, deliberately.

**C is the fix for the dial.** The first cut had two setups, and the dial was on
screen for 22.4 seconds of 48.6 — including a six-second stretch under *your
eyes do not glide, they jump* where the picture was a clock face and the
sentence was about eyes. The film was describing its own subject over a
photograph of something else. Setup C is that subject: his fringe, his brows,
two eyes, and a pair of irises that **jump** — `tl.set`, never a tween, because
an eye does not glide and that is the entire point. Three and a half jumps a
second, and the page-blanks at 16.40 / 17.28 / 18.16 land on three of them.

It takes nine seconds off the dial and gives the film a picture of the thing it
is arguing about.

**Cut where the page is already empty.** Six of the eleven cuts are placed
*inside* a blank — 6.56 sits in the blank at 6.52, 21.52 inside the 300ms one at
21.40 — so the cut itself is invisible and the audience reads it as a look
rather than an edit. The film's own device is doubling as its transition.

**The camera moves too.** Every cut sets a slightly different scale on the
camera group — 1.00 to 1.08 — so a return to a setup is a new framing rather
than the same picture again. Without it a cut back reads as the wall having
changed behind a man standing still.

## Motion character: stillness, done with his hands

His body never leaves one captured pose — the stand is
`InkPuppet.still("shuffle", 34)`, a real captured frame rather than the
hand-authored `STAND`, which is a different size from the clips, and it runs
from t=0 or he holds the wrong pose through the whole draw-in.

But stillness is not the same as doing nothing, and the first cut confused the
two: he stood for forty-eight seconds with both arms hanging. **He is holding
his number.** A paper ticket, drawn in pose units, hung off `fig.hand()` every
frame, and the near arm picks it up and reads it three times — before the first
look, in the middle, and on the last line. The far hand finds his hip at 13.30
and stays there. That is a man waiting his turn, and it is the reason his eyes
keep going to the clock, which is the reason the film has anything to describe.

Prop rules that cost renders to learn, all of them in `ADEM.md`: reaches are
measured **from the shoulder** (a chest-relative target that is a comfortable
bent arm in one clip is past the end of the arm in another, and FABRIK answers
an unreachable target by straightening and pointing); a prop parented to a hand
needs `pup.setPose()`, never `fig.redraw()`; and every tween that moves him
carries `onUpdate: sync`, or gsap renders it a frame behind its own gesture.

On the last line one eyebrow moves. That is still the only thing on his face
that ever does.

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

## The set

The first cut's room was a floor line, a skirting, one chair and the clock, and
it read as nothing — which is exactly what it was. It is now a public waiting
room, and every dimension in it is looked up rather than eyeballed, because
`MM = SCALE * 534 / 1750` makes that free:

an 860 × 1400 window with its sill at 900 and a roller blind a third of the way
down · a linked bench of three 420 seats at 450, with a newspaper somebody left
on the end one · a bin · a notice nobody reads · a pendant lamp straight over
his head · a 300 clock at 1900 · a 100 skirting · the corner where the room
turns, just inside the right edge · two joints in the floor.

Two things about it went wrong first and are worth keeping written down:

1. **A filled back rail under a window sill is a kitchen.** The bench's back
   panel landed at the sill's height and the two fused into one continuous
   counter, which turned the bench beneath it into base units. Open slats on
   posts, offset from the window's edge, and it is a bench again. Aligned
   edges fuse; a dado rail at exactly the sill height did the same thing and
   was deleted.
2. **A fringe at half the frame is a black bar.** Setup C's hair started as a
   band to y=350 and every camera push cropped it into a stripe. Shallow, and
   it reads as his head again.

## The frame

Shorts eats the bottom of the picture — title, handle, description and scrubber
below y≈1450, the button rail on the right under y≈950. The first cut put the
captions at **y=1660**, which is inside all of it: the user could not read a
single line of the film. They are now at **1250**, the floor is at **1130**, and
nothing that has to be read goes below 1400.

## The distinctness test

*Could this be any other video's frame?* No: a man waiting his turn under a
clock, and a pair of his own eyes big enough to watch them jump.

*Does it reuse a look I have made before?* No, on all five ledger fields. The
read, the device, the layout set, the motion character and the palette roles are
all new. The ground, the character and the type are the channel's, which is now
deliberate — see the ledger.
