# Nothing is photographed

The rule for this channel, decided on 2026-09-05:

> **Every frame is drawn. No stock footage, no generated photography, no camera
> anywhere in the pipeline. The drawing is the argument.**

This is a position, not a shortage. It was reached after establishing that the
production environment cannot reach Pexels, Pixabay, Wikimedia, Openverse,
archive.org, NASA or any other media host — but the reason to keep it is not
that.

## Why it is the stronger hand for an explainer

A stock clip is a picture *of the subject*. A drawing can be a picture *of the
mechanism*, and the mechanism is what an explainer is for.

The reference video that started this conversation does something clever: it
draws vector annotation on top of the photograph — two dots on a sparrow's feet,
an arrow down a wire. That device is the best thing in it. And it exposes the
limitation of the form: **the annotation can only point at whatever the
photograph happens to contain.** The creator had to find a clip with a bird
whose feet were both visible and separated enough to label.

When the frame is drawn, the thing being pointed at is always there, always in
the right place, always at the right scale. Two of our videos have already
depended on that: 87 microseconds of flight time and a 3.4% difference in
gravitational pull cannot be filmed. There is no clip of either.

So the annotation grammar is worth taking. The photograph underneath it is not.

## The real risk

It is not that we will look like a stock channel. It is that we will look like
*ourselves*, over and over.

Two productions in and both were line drawings on a flat ground with an even
narration. That is a groove forming, and a groove is what the previous five
videos died of. `STYLE_LEDGER.md` exists to fight exactly this, and it now
matters more than before: with photography off the table, variety has to come
entirely from how the drawing is made.

## The worlds available, verified on this machine

Each is a genuinely different way to draw, not a different colour scheme. Rotate
them. Two consecutive productions should not use the same one.

| World | Tool | What it is good at |
|---|---|---|
| Vector composition | Remotion atelier (`video_compose`, `composition_mode: atelier`) | Anything hand-authored: instruments, plates, typography, data. Used for productions 1 and 2, and as the glass layer over Manim in production 3. |
| Mathematical animation | Manim 0.21 (`math_animate`) | Transformations, proofs, graphs that morph, things that are literally equations. Production 3. |
| 3D worlds | `threejs_world`, `threejs_asset_catalog` | Terrain, scale, camera flight, anything where the point is spatial |
| Hand-drawn character | Ink Theater + Ink Puppet (`ink-theater/`, `character_spec_generator`, `character_rig_renderer`) | A figure that draws itself and acts the idea out; contraption explainers |
| Kinetic typography | HyperFrames (`hyperframes_compose`) | When the words *are* the visual — quotes, counts, lists, rhythm |
| Structural diagram | `diagram_gen` (Mermaid) | Flows, states, architectures |
| Code | `code_snippet` | When the subject is software and the code should be read |

Nothing on that list needs an API key or an unreachable host. All of it is free.

## What we take from the reference

Its grammar, not its clothes:

- **Name the current idea** on screen, persistently. It gives a viewer who joined
  three seconds ago somewhere to stand. Their form is a dark pill top-left; ours
  should be whatever suits the piece.
- **Caption the words**, with the load-bearing word marked. Ours are burned in
  and styled per production (see `scripts/build_captions.py`).
- **Annotate what you are looking at.** Point at the thing. This is the device
  worth stealing, and it works better on a drawing than on a photograph.
- **One accent colour for emphasis, one reserved colour used exactly once**, at
  the turn. This is the sharpest idea in the reference and it costs nothing.
- **Cut roughly every 4–5 seconds.**

What we do not take: their chip shape, their yellow, their typeface, their
layout. Copying those would make our work read as theirs, and it would be a
worse video for it — a channel that looks borrowed is not a channel.

## Splitting the world

Production 3 found an architecture worth keeping, separately from its look:
**one world draws every pixel, and a second runtime is glass over the top** —
the chip, the burned captions, the annotation. Manim rendered thirteen silent
clips; Remotion mounted them with `OffthreadVideo` and drew on them.

That is the reference video's grammar exactly, with a drawing where the
photograph was. It is reusable as a structure with any of the worlds below, and
it reuses nothing about the look. Its price is a doubled failure surface: on the
first render, two overlay elements had no upper frame bound and leaked across
every later shot, and four clips were out of sync with the narration. Neither
bug is visible in a still. Sample the finished file, not the frames.

## The standing brief, restated

Vertical shorts. Original script. **Every frame drawn.** Narration in natural
English. Burned captions. Royalty-free or self-produced audio. Nothing paid for.
A different drawn world often enough that the ledger stays honest.
