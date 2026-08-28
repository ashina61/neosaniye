# The narration in this folder is a SCRATCH TRACK.

`vo.wav` was spoken by **espeak-ng 1.51** (`-v en-gb -s 168 -p 35 -g 6 -a 170`),
installed from apt inside the build container. It is a formant synthesiser from
the 1990s. It is not a broadcast read and must not be published as one.

It is here because of the zeroth law: **the voiceover is the clock.** Scene
durations are MEASURED from the silences between lines in this file
(`scripts/lib/measure.mjs`, via `npm run voice -- --episode=pompeii --measure`),
never estimated. Without an audio file the planner falls back to
`words / 2.7 * 30` and every cut in the reel is a guess.

No neural voice was reachable from this environment: the HuggingFace hosts
return 000 through the egress proxy and the GitHub release endpoints return 403,
so no model could be fetched and no hosted API was configured. Rather than ship
a reel cut to estimates and call it finished, the line was spoken by the one
synthesiser that *was* installable and measured with the repo's normal
measurement path — no code changed to accommodate it.

## Replacing it

Record or generate the ten lines of `brief.json` as ONE continuous take with a
clear pause between lines (the measurement finds the nine longest silent runs
and will refuse the file if it finds fewer). Then:

    npm run voice -- --episode=pompeii --measure
    npm run plan  -- --episode=pompeii
    npm run render -- --episode=pompeii

The timing, the cuts and every drawn stage re-derive from the new file. Nothing
else needs to be touched.
