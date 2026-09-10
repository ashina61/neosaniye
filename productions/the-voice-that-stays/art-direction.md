# The Voice That Stays — art direction

## The read

**One mouth, two routes, and the film is the difference between them.** Everything
in the picture is either the long way round outside the head or the short way
straight through it, and the accent green `#2E7D5B` belongs to the second one
and to nothing else.

This is the first film on the channel whose argument is **audible rather than
drawn**. The claim — that your skull hands you a low half of your own voice that
never reaches anyone else — cannot be illustrated, because the thing being
described is a sound you have heard your whole life and have never heard
isolated. So the last third of the film is two takes of the same narration:
one with everything under 320 Hz lifted, one band-limited and squashed like the
phone speaker on the table. Same words, same loudness, back to back. See
`sim/mix.py`, which measures the gap rather than asserting it (+9.0 dB of bass
on the bone take, +9.2 dB of top on the air take).

## Setups

Two, and the close-up is **drawn, not zoomed**. Video 10's first pass pushed the
camera into the wide shot to get the head, which dragged the table through the
caption band and magnified every line in the room with it. A macro of Adem is
its own setup, as `ink-theater/ADEM.md` says.

1. **The room.** A kitchen table, a phone lying face up on it, a window, a
   poster, a lamp, a plant. Adem stands and talks. The phone's record dot blinks
   from 4.2 s, so the recording that the film ends on has been running the whole
   time.
2. **His head, front on**, with the two routes and the two frequency combs.

## Why the head is front on

Because a route drawn on a three-quarter head has to travel from a mouth on one
side to an ear on the other, and **a line that leaves a face and comes back to
it encloses an area — which beside a head is a speech balloon.** Four drafts
proved it: a loop round the skull, a tighter loop, an open C, and a
there-and-back wedge that `IF.smooth` turned into an ellipse with a pointer at
his ear. All four read as him saying something in a bubble.

Face on, the mouth is in the middle and there is an ear on each side, so:

- **Air** gets no route line at all. It gets arcs *leaving* his mouth and an
  arrow *arriving* at his ear — the two symbols nobody misreads — and the
  journey between them is carried by a moving dot on a path that is never
  stroked. Motion can draw what a still line cannot.
- **Bone** gets a green dotted line from his throat, up through the jaw and the
  side of the skull, into the same ear. It starts at the larynx because that is
  where the voice starts, and it is steep because the shallow version along the
  jawline read as a nasal cannula.

Long way round outside, short way straight through, both arriving at the same
ear. That is the film in one drawing.

## The combs

Two 22-bar frequency combs at y=1120, labelled "what the air carries" and "what
bone carries". Air is nearly flat; bone is `(1-u)^2.8` — all bass, nothing on
top. They are the only place the film states the mechanism as a graph, and they
sit far enough below the shoulder line not to read as something he is wearing.

## Sound

Two buses, ducked differently: the room at the house `DUCK = 0.86`, the film's
own events at 0.34. The air pulse is bright, panned, and goes away and comes
back — the only panned sound in the film, because being somewhere else for a
moment is the whole difference. The bone pulse is 110 Hz, band-limited to
nothing above 400, and sits dead centre, because it has nowhere to go.

## Labels

One, and it says "bone". There was a "through the air" label; it repeated the
caption under it word for word, which `annotate.js` warns against, and its
arrow had to cross the arcs it pointed at in order to reach them. The bone
label stays because it does the job a label is actually for: a green dotted
line down a cheek is a scar until something names it.
