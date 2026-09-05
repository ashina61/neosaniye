# nib-door — a rig test

Nib walks to a door, takes the lever, presses it and pushes the door open, then
walks through. No narration, no music, no captions: this is the rig, not a
production.

What it is testing:

1. **Nib as a fixed character.** Nothing here overrides `InkFigure.NIB`, so this
   is what he looks like in every video. See `../../NIB.md`.
2. **A hand that holds something moving on its own.** The handle is drawn in the
   world layer and swings with the door; the hand is IK'd to it every frame
   through `InkFigure.toPose()`. The arm follows the handle, not the reverse.
3. **A door drawn correctly.** Every dimension is a real millimetre figure, and
   the leaf is projected in one-point perspective rather than squashed — seen
   exactly square on, an opening door is a pure horizontal squash, which is
   geometrically right and unreadable, because it just looks like a narrower
   door. What tells you a door is open is that its far edge is further away.

## Running it

The composition expects the engine files beside it:

```sh
mkdir -p /tmp/nib-door && cd /tmp/nib-door
cp ink-theater/tests/nib-door/index.html .
cp ink-theater/{ink-theater.js,ink-puppet.js,ink-figure.js} .
cp ink-theater/mocap/clips.js .
cp <any project>/hyperframes/gsap.min.js .          # vendored; jsdelivr is blocked
npx hyperframes lint . && npx hyperframes snapshot . --at 7.9,8.8,10.2 --no-end -o snap
npx hyperframes render . -o nib-door.mp4 -f 30 -q high
```

`hyperframes render` sometimes fails its own FFmpeg probe on the first run
("Install a working 64-bit FFmpeg build") while `ffmpeg -version` works fine from
the shell. Run it again.
