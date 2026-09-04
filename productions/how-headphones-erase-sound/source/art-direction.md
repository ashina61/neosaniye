# Art Direction — The Deadline Inside Your Headphones

Atelier piece. Hand-authored for this subject only. Nothing here is reusable and nothing
here was carried in from an earlier video.

## The design read

An oscilloscope in a dark room. The video is about a measurement, so the frame is an
instrument: thin lines, exact numbers, no ornament, no illustration. The drama is supplied
by a clock that never stops, not by decoration. Cold, precise, slightly airless — and then,
at the very end, completely still.

## Palette

| Role | Hex | Meaning |
|---|---|---|
| Ground | `#080B10` | Near-black ink. Never pure black — the instrument has a glass. |
| Grid | `#12212B` | Faint, breathing. Stops breathing once, at the end. |
| The world | `#3FE0D0` | Cyan. Every sound that exists outside your head. |
| The headphone's answer | `#FF8A3D` | Amber. Always drawn as a mirror of whatever cyan just did. |
| Type | `#F2F5F7` | White, reserved for language. |
| Dim type | `#7E8A93` | Labels, units, axis ticks. |

Two signal colours and no third accent. No gradients, no glows, no fills except one
translucent field in the frequency scenes.

## Type

- **Archivo 800**, tight tracking, left-aligned — for the three moments the video speaks in
  words instead of drawing. Never centred, never spring-animated.
- **JetBrains Mono 500/700** — for every number, unit and axis label, because the whole story
  is a measurement and measurements are set in mono.

## Motion character

Constant-velocity travel, not eased arrivals. Things in this video are *in flight*; easing
would make them feel decorative. The two exceptions are the phase slip (interpolated, so the
failure reads as continuous rather than as a cut) and the final stop (instant).

`visual_variance: 7` — each beat owns a different visual mode.
`motion_intensity: 7` — something is always moving until the last beat.
`information_density: 4` — one idea per frame.

## The signature device

**A running microsecond counter in the right margin.** It starts the moment the microphone
first hears anything and never pauses again until the last shot, where it freezes
mid-count. It appears in four beats out of ten — it is the spine of the argument, not
wallpaper — and its final frozen state is the last thing on screen.

It counts a real number: 3 cm of air at 343 m/s is 87 microseconds. Every flight in the
video takes exactly that long.

## Anti-patterns (explicitly forbidden in this piece)

- A centred caption block sitting over generic b-roll — the shape of every previous video
  from this repository.
- The two-sine-waves-cancel diagram used as the whole video. It appears once, for six
  seconds, and is then abandoned.
- Purple or blue AI-gradient backgrounds.
- Stock headphone product photography. The video never shows the object it is about.
- Spring/bounce entrances on type.
- Any layout reused from a previous OpenMontage video.

## Quality gates

1. A viewer with the sound off must still be able to follow the argument.
2. The closing beat must be the only motionless shot in the video.
3. No scene may be recognisable as a stock scene-type.
4. Every number on screen must be derivable from the research brief.
