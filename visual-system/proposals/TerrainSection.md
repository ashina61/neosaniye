# PROPOSED — `TerrainSection`

**Status:** PROPOSED → IMPLEMENTED (Vajont, 1963)
**Serves:** `terrain`, `geography`
**One line:** the land in profile, the water standing in it, and the mass that moves.

## Why this is not a component we already have

Law 45 says a genuinely new behaviour is written down before it is built, and
only built if it is reusable across more than one subject. Here is every
component that could plausibly have carried the Vajont beats, and what it does
instead.

| component | what it actually draws | why it cannot carry this |
|---|---|---|
| `CrossSectionPlate` | full-width horizontal `layers` in a box, with a `crack` path, `fluid` running down it, `inclusions` and `growth` | A valley is not horizontal strata. There is no landform, no standing water, no structure, and no mass that detaches and TRAVELS — its crack propagates but nothing moves along it. Closest fit and still the wrong picture. |
| `ScaleHaulagePlate` | a rectangle on a ground line with `rollers`, `sledge`, `ropes`, `humans`, `forces`, `ramp` | A landslide has no rollers, no ropes and no haulers. Casting one here would draw a crew dragging a mountain — the exact "approximately right family, wrong object" error this repository is named after. |
| `MapPlate` | plan view: regions, coasts, water, routes, markers, a distance | Plan view cannot show a water level, a dam crest, or water going OVER something. The overtopping is the whole story and it is an elevation event. |
| `ProcessPlate` | ONE object's outline continuing through stages, keeping its volume | No ground, no basin, no water. The slab is not the only thing in the frame; the point is what it does to the thing beside it. |
| `AnatomyFlowPlate` | chambers, valves and a circuit that closes | Not a body. |
| `MouldCastPlate` | one silhouette through burial, decay, void, infill, cast | The slab is not buried and does not leave a cavity. |
| `Measurement` | a dimension compared against something known | Carries "262 metres" and nothing else in the story. |

## Why it generalises

It is not a Vajont component. `TerrainSection` is the land seen from the side,
which is the only way to draw:

- a landslide, a rockfall, a slump, a debris flow
- a dam, a reservoir, a spillway, an overtopping
- a glacier and its bed, a fjord, a moraine
- coastal erosion, a cliff retreat, a sea wall
- subsidence, a sinkhole, a collapsing mine roof
- a volcano flank, a lahar path
- river incision, a terrace, a captured valley
- an aquifer and a water table

Every one of those is "the ground in profile, something standing in it, and
something moving through it". None of them are drawable today.

## The contract

Physical coherence is the reason it exists, so it is enforced rather than
authored:

- the mass slides ALONG its declared plane, not through the air
- the water level rise is COMPUTED from the area the mass displaces — the
  planner does not get to state it, so it cannot state it wrongly (law 15's
  "one source of truth for a number", applied to a geometry)
- seepage arrives before the release, and the release before the rise, and the
  rise before the overtopping: A causes B causes C, drawn in that order
- everything reconstructed says `SCHEMATIC RECONSTRUCTION · NOT TO SCALE`

## Rejected alternatives

**Extending `CrossSectionPlate` with a profile mode.** Two drawings in one
component, sharing a name and nothing else: its layers are horizontal by
definition and its whole vocabulary (crack, fluid, growth, inclusions) is about
what happens INSIDE a material at magnification, not about a landform at
kilometre scale. The `scaleNote` on one says `MAGNIFIED`; on the other it would
have to say the opposite.

**Extending `MapPlate` with an elevation mode.** A plan and a section are two
projections of the same place and share no geometry. `MapPlate` would become a
component that draws two unrelated pictures depending on a flag.
