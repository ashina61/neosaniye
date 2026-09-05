# nib-corridor — the rig reference

Nib walks down a corridor carrying a toolbox, works the lever, pushes the door
open, steps through — cut — and is in another room, where he puts the toolbox on
a bench. No narration, no music, no captions: this is the rig, not a production.

It supersedes the earlier `nib-door` test, which was built before the clips were
re-projected and before root motion existed.

## What it is the reference for

1. **A walk that travels.** `bvh2clip.mjs` used to project every clip onto world
   X whatever direction the subject actually walked in, so a CMU subject who
   walked along Z came out **front on**: shoulders 145 units apart, a 30-unit
   stride on a 538-unit figure. It looked like marching on the spot and it could
   not travel. The converter now projects onto the direction the motion goes in
   (travel if the take travels, otherwise the way the feet point), and `walk` is
   a true side view with a 438-unit stride — 0.84 of his own height.

2. **The ground moving at the speed the feet chose.** Every clip carries `rootX`
   now, `InkPuppet` reports `pup.travel`, and the world slides by exactly that.
   Planted-foot slip per frame: **13.0px before, 1.2px after**. No speed is
   chosen anywhere in this file; it comes out at 1.43 m/s because that is how
   fast the man in the capture walked.

3. **Two hands.** `fig.carry` drives the near arm and `fig.hold` the far one, so
   he keeps the toolbox in one hand and works the lever with the other.

4. **A cut that does not cross the line.** Room B is a **ninety-degree camera
   change** — a different wall, with the doorway he came through seen almost
   edge-on in the corner. Looking back at the door wall would swap left and
   right, and a man who walked right down the corridor would be walking left in
   the room. The cut lands mid-stride, inside one continuous walk segment, so
   the legs carry through it.

5. **Real dimensions.** The character sets the scale (534 units crown to sole,
   1750mm) and everything else is a millimetre figure: a 2030x820 door leaf, its
   handle 1050 off the floor and 65 back from the edge, a 750-high bench, a
   1200 window with its sill at 900, a 100 skirting.

6. **A door in one-point perspective.** Square on, a door swinging away is a
   pure horizontal squash — right, and unreadable, because it just looks like a
   narrower door. A point `u` from the hinge sits at depth `u*sin(angle)` and
   scales about the vanishing point by `D/(D + u*sin(angle))`. At angle 0 that
   is 1 everywhere, so the closed door needs no fudge.

## Running it

```sh
mkdir -p /tmp/nib && cd /tmp/nib
cp ink-theater/tests/nib-corridor/index.html .
cp ink-theater/{ink-theater.js,ink-puppet.js,ink-figure.js} .
cp ink-theater/mocap/clips.js .
cp <any project>/hyperframes/gsap.min.js .          # vendored; jsdelivr is blocked
npx hyperframes lint . && npx hyperframes snapshot . --at 4.2,7.3,9.4,11.2,13.4 --no-end -o snap
npx hyperframes render . -o nib-corridor.mp4 -f 30 -q high
```

`hyperframes render` sometimes fails its own FFmpeg probe on the first run
("Install a working 64-bit FFmpeg build") while `ffmpeg -version` works fine from
the shell. Run it again.
