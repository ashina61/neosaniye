# The narration in this folder is a SCRATCH TRACK.

`vo.wav` was spoken by **espeak-ng 1.51** (`-v en-gb -s 172 -p 35 -g 6 -a 170`),
installed from apt inside the build container. It is a formant synthesiser. It
is not a broadcast read and must not be published as one.

It is here because of the zeroth law: **the voiceover is the clock.** Scene
durations are MEASURED from the silences between lines in this file
(`scripts/lib/measure.mjs`, via `npm run voice -- --episode=vajont --measure`),
never estimated. Without an audio file the planner falls back to
`words / 2.7 * 30` and every cut in the reel is a guess.

No neural voice was reachable from this environment: the HuggingFace hosts
return 000 through the egress proxy and the GitHub release endpoints return 403,
so no model could be fetched and no hosted API was configured.

## Two things this file taught the pipeline

1. **Trailing silence is not a boundary.** The measurement took the tail of the
   take as one of its eleven line breaks, which pushed a real break out and
   merged three lines into one fourteen-second window. Fixed in `measure.mjs`.
2. **One sentence per line.** A full stop INSIDE a VO line makes a pause the
   measurement cannot tell from a line break. The script is written one sentence
   per line for that reason.

## Replacing it

Record the eleven lines of `brief.json` as ONE continuous take, one sentence per
line, with a clear pause between lines. Then:

    npm run voice -- --episode=vajont --measure
    npm run plan  -- --episode=vajont
    npm run render -- --episode=vajont
