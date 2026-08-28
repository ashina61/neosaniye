# `MouldCast`

**Status:** PROPOSED → IMPLEMENTED
**Proposed:** 2026-08-28
**DNA version:** 1.0.0

## The problem

A class of claim the vocabulary cannot draw at all:

> A form is engulfed by a moving medium. The form is lost. A void remains where
> it was. The void is filled. The form returns, in a different material.

Five stages, one silhouette, and the whole meaning is in the *transitions*
between them. Shown as five separate pictures it explains nothing; the viewer
has to see that the cavity is the same shape as the thing that is gone, and that
what comes out is the *fill*, not the original.

This is not one topic. It is the shared mechanism of:

- **a mould and a casting** — wax invested, burned out, bronze poured in;
- **plaster casts recovered from a volcanic deposit** — body sealed, decayed,
  cavity filled;
- **fossil infill** — organism buried, dissolved, minerals precipitated into the
  space;
- **anything entombed and later recovered as its own negative** — tar, ice, silt.

The claim type is *engulfment and recovery by negative space*. That is what
generalises, exactly as `process` generalises "one object worked through
stages" and `map` generalises "two shores and the water between".

## Why existing components cannot solve it

| component checked | why it does not serve |
|---|---|
| `ProcessPlate` | Morphs a **bar of worked stock** through heat/strike/fold/quench. Its whole grammar is conservation of volume under a hammer. It has no medium, no burial, no void, and its stages are agents applied *to* the object — not an object *disappearing inside* something else. |
| `CrossSectionPlate` | Draws strata with a crack and fluid ingress. It can show a deposit and it can show a channel opening — but the cavity in a mould is not a fracture, it is a *shape*, and the section has no form to lose. It is a picture of the material, not of what is inside it. |
| `AnatomyFlowPlate` | Chambers and a circuit. On the line that raised this it produced four heart chambers labelled UPPER/LOWER over a body decaying in ash — the exact failure this repository is named for. |
| `ScaleHaulagePlate` | Owns the schematic human figure and the ground line, and both are reused here. But it is a drawing about *size*, and its subject never changes state. |
| `MapPlate` | A state, not a mechanism. Correct for where Vesuvius is; silent on what happened inside the deposit. |
| `Motif` (`coins`, `route`) | Frame-locked graphics that play a verb. No material, no section, no persistence between shots. |

`CrossSection` "almost does" — and the honest extension was tried first: a
section whose middle layer carries a void. It fails because the void has to be
*the shape of the thing that was there*, which means the section needs a form,
a before, and an after. That is a different drawing, not a prop on this one.

## Visual purpose

The viewer understands that a cast is **a negative filled in**, not a preserved
body and not a petrified one — a distinction almost every popular account of
Pompeii gets wrong, and one that no photograph of a finished cast can make,
because the finished cast is the last frame of the story.

## Motion purpose

**TRANSFORMATION**, with a **CAUSAL** spine: the front arrives *because* the
eruption changed; the level rises *because* the front arrived; the cavity exists
*because* the form decayed; the form returns *because* the cavity was filled.
Each stage is the cause of the next, and the drawing is the argument.

## Reuse

Any subject where something is lost inside a medium and recovered as its own
negative. It takes the form, the medium, the filler and the stage list as props;
nothing in it knows about volcanoes.

## Register

The `Sheet` register, unchanged: `weights()` line scale, mono labels,
registration ticks, a pinned disclosure plate. Reconstructed throughout, so the
plate is mandatory and defaults to `SCHEMATIC RECONSTRUCTION · NOT TO SCALE`.
