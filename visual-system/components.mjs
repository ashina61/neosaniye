/**
 * THE COMPONENT REGISTRY — what already exists, so nobody builds it twice.
 *
 * This file is the answer to the question a new episode should start with:
 * *which existing component expresses this?* — rather than *what should I
 * invent?* Every entry names a real export, says what it is FOR, and says what
 * it must not be used for, because the second is what stops a component being
 * quietly repurposed into a near-duplicate of itself.
 *
 * THE RULE: before writing a component, search this file. If something here can
 * express the requirement — alone or composed with others — use it. If it
 * ALMOST can, extend it. Only when neither is true does a proposal go into
 * `visual-system/proposals/`, and it is `PROPOSED` until somebody agrees it is
 * reusable across subjects.
 *
 * There is no `Arrow2`. There will not be an `ArrowNew`, a `BetterArrow` or an
 * `ArrowFinal`. There is `Arrow`, and it takes props.
 */

/** A component that is part of the persistent vocabulary. */
const c = (name, file, purpose, notFor = null, composes = []) => ({name, file, purpose, notFor, composes});

export const CAMERA_COMPONENTS = [
  c('useCamera', 'engine/Camera.ts',
    'the single camera for a shot: push, pan, tilt, roll, handheld float and impact, resolved per frame',
    'per-layer movement — a layer takes its SHARE of this camera via depth, it does not get its own'),
  c('cameraFromParams', 'engine/Camera.ts', 'reads a shot camera out of scene params so a config never speaks in transforms'),
  c('Depth', 'engine/draw/material.tsx',
    'places drawn content on one of four planes and gives it that plane`s share of the push',
    'a substitute for the camera — it distributes a camera, it does not make one'),
];

export const TYPOGRAPHY_COMPONENTS = [
  c('WordStack', 'engine/draw/Kinetic.tsx',
    'a caption that arrives word by word, with one emphasis word and its mark',
    'labels or callouts — those are the drawing`s voice and are set in mono'),
  c('KineticLine', 'engine/draw/Kinetic.tsx', 'one line of kinetic type; the unit WordStack stacks'),
  c('Piece', 'engine/draw/Kinetic.tsx', 'a single word`s arrival: rise, wipe, punch, blur or char'),
  c('Mark', 'engine/draw/Kinetic.tsx', 'the emphasis treatment — underline, box, highlight — drawn, never faded'),
  c('TitleSlate', 'engine/sceneTypes/TitleSlate.tsx', 'a graphic-first card: kicker, title, footer, figure slot'),
  c('Slot', 'engine/draw/Type.tsx', 'a number that is SELECTED — a split-flap that lands on its value'),
  c('Counter', 'engine/draw/Type.tsx', 'a number that CLIMBS — magnitude felt as it counts'),
  c('OnScreenText', 'engine/OnScreenText.tsx', 'timed text laid over a shot from the config'),
  c('Type', 'engine/draw/Type.tsx', 'the shared type block: scrim, wrap, safe area, optical centring'),
];

export const GRAPHIC_COMPONENTS = [
  c('Arrow', 'engine/draw/sheet.tsx', 'a force, a direction or a pointer; draws itself along its own length',
    'a connector between diagram parts — that is a Callout leader'),
  c('Callout', 'engine/draw/sheet.tsx', 'names a part: leader line to the thing, mono label on whichever side has room'),
  c('Ticks', 'engine/draw/sheet.tsx', 'registration marks — the corner furniture of a drawing sheet',
    'decoration on a photographic shot; they say "this is a plate"'),
  c('Disclosure', 'engine/draw/sheet.tsx', 'the plate that says a drawing is a reconstruction and not a record'),
  c('Annotation', 'engine/draw/Annotation.tsx', 'a hand-drawn mark over a photograph: circle, underline, arrow, cross'),
  c('Plaque', 'engine/draw/Props.tsx', 'a labelled plate hanging on what it names'),
  c('WireFrame', 'engine/draw/Props.tsx', 'a dashed frame around a subject', 'a shot that already has a mechanism in it'),
  c('Beam', 'engine/draw/Props.tsx', 'a shaft of light from a source outside the frame'),
  c('Card', 'engine/draw/Props.tsx', 'an index card carrying its own line'),
  c('Newspaper', 'engine/draw/Props.tsx', 'a front page whose masthead is a NAME and whose headline is the sentence'),
  c('Glow', 'engine/draw/Glow.tsx', 'the light a lamp in a photograph does not emit; core only where a plate is under it'),
  c('Contact', 'engine/draw/material.tsx', 'the contact shadow that stops an object being a sticker'),
  c('GroundPlane', 'engine/draw/material.tsx', 'the floor, as a receding surface rather than a line'),
  c('Sky', 'engine/draw/material.tsx', 'the air above a horizon, so a drawn band is not floating in black'),
  c('Haze', 'engine/draw/material.tsx', 'distance, as a wash'),
  c('Motes', 'engine/draw/material.tsx', 'subordinate life: dust in a shaft, particles in front of a subject'),
  c('MaterialDefs', 'engine/draw/material.tsx', 'the gradients and speckle one material needs, declared once per plate'),
  c('MaterialFace', 'engine/draw/material.tsx', 'paints a material — body, hue, sheen, tooth, spec — over any shape'),
];

export const DIAGRAM_COMPONENTS = [
  c('Diagram', 'engine/draw/Diagram.tsx', 'the dispatcher: a spec in, a plate out, the shot camera applied to the WORLD only'),
  c('MapPlate', 'engine/draw/Map.tsx', 'a place and the relation between its parts', 'a diagram of a process happening at a place'),
  c('ProcessPlate', 'engine/draw/Process.tsx', 'ONE object continuing through stages, keeping its volume', 'four illustrations in a row'),
  c('CrossSectionPlate', 'engine/draw/CrossSection.tsx', 'the inside of a material, and what happens in it'),
  c('AnatomyFlowPlate', 'engine/draw/AnatomyFlow.tsx', 'chambers, valves and a circuit that closes'),
  c('ScaleHaulagePlate', 'engine/draw/ScaleHaulage.tsx', 'a mass, a size reference and the effort of moving it'),
  c('GearSystem', 'engine/draw/Diagram.tsx', 'a mechanism whose ratio is physical and whose teeth actually mesh'),
  c('Timeline', 'engine/draw/Diagram.tsx', 'elapsed time, including the years when nothing happened'),
  c('Measurement', 'engine/draw/Diagram.tsx', 'a dimension, compared against something known'),
  c('Orbit', 'engine/draw/Diagram.tsx', 'celestial geometry'),
  c('Scan', 'engine/draw/Diagram.tsx', 'a sweep across the frame that reveals structure', 'a transition'),
  c('Motif', 'engine/draw/Motif.tsx', 'the VERB of a sentence, drawn: coins pile, a route draws, a tally notches'),
];

export const MOTION_PRIMITIVES = [
  c('drawOn', 'engine/motion.ts', 'a stroke arriving along its own length — the channel`s entrance for anything drawn'),
  c('springEntrance', 'engine/motion.ts', 'an arrival with weight behind it'),
  c('punch', 'engine/motion.ts', 'a scale hit that says THIS word'),
  c('shake', 'engine/motion.ts', 'a frame that has been struck'),
  c('stagger', 'engine/motion.ts', 'the same arrival, offset per item, so a list reads as a sequence'),
  c('clipReveal', 'engine/motion.ts', 'a wipe expressed as a clip path'),
  c('wipeMask', 'engine/motion.ts', 'the mask a directional arrival travels behind'),
  c('countTo', 'engine/motion.ts', 'a number climbing', 'a number that was SELECTED — that is slotState'),
  c('slotState', 'engine/state.mjs', 'a split-flap value: one readable value at every frame, never two'),
  c('counterValue', 'engine/state.mjs', 'the integer a counter shows — the same function the checker asserts on'),
  c('posterizeTime', 'engine/motion.ts', 'the shared clock; everything steps together or nothing does'),
  c('focusHunt', 'engine/motion.ts', 'a lens finding focus, so a reveal is found rather than cut to'),
  c('holdKeyframes', 'engine/motion.ts', 'a value that jumps rather than ramps — a flicker is not a dissolve'),
  c('tracking', 'engine/motion.ts', 'letter-spacing settling as a line arrives'),
  c('blurBurst', 'engine/motion.ts', 'a defocus that resolves'),
  c('pingpong', 'engine/motion.ts', 'a value that goes and returns'),
  c('boil', 'engine/motion.ts', 'the small constant unrest of hand-drawn line work'),
  c('drift', 'engine/motion.ts', 'slow unmotivated movement — atmosphere, never a subject'),
  // The physical family. These are models, not curves.
  c('heavy', 'engine/motion.ts', 'mass: most of the shot spent starting and most of the rest failing to stop'),
  c('tension', 'engine/motion.ts', 'a rope taking up its slack, overshooting once, settling'),
  c('rigid', 'engine/motion.ts', 'flat, step, flat — something that yields all at once'),
  c('impact', 'engine/motion.ts', 'displacement and one bounce'),
  c('flow', 'engine/motion.ts', 'continuous movement that never arrives'),
  c('cyclic', 'engine/motion.ts', 'a fast stroke and a slow return — a pump, a bellows, a heart'),
  c('angular', 'engine/motion.ts', 'exactly linear rotation, because a wheel does not ease'),
  c('settle', 'engine/motion.ts', 'a small give at the end of a movement'),
  c('shimmer', 'engine/draw/material.tsx', 'heat haze off something hot'),
  c('gearsMesh', 'engine/state.mjs', 'whether two wheels actually touch — the check and the drawing agree'),
];


/**
 * THE SCENE TEMPLATES — seven shared, and no episode adds an eighth.
 *
 * A template is a KIND OF SHOT, not a kind of story. `composite` is the general
 * one and the other six are its special cases; `title-slate` and
 * `evidence-board` are graphic-first, so they work with no photograph at all
 * and cannot die on a missing asset.
 */
export const SCENE_TEMPLATES = [
  c('Composite', 'engine/sceneTypes/Composite.tsx',
    'the general shot: a layer stack on a shared anchor, drawn props, a diagram, a motif and words',
    'a shot that needs its own grain, grade or camera — those come from FilmLook and useCamera'),
  c('TitleSlate', 'engine/sceneTypes/TitleSlate.tsx', 'a graphic-first card: kicker, title, footer, counted figure'),
  c('EvidenceBoard', 'engine/sceneTypes/EvidenceBoard.tsx', 'pinned cards, graphic-first, survives with no photography'),
  c('PortalZoomReveal', 'engine/sceneTypes/PortalZoomReveal.tsx', 'a zoom THROUGH one plate into what is behind it'),
  c('ParallaxPunch', 'engine/sceneTypes/ParallaxPunch.tsx', 'two plates closing at different rates — depth as an event'),
  c('SplitShift', 'engine/sceneTypes/SplitShift.tsx', 'two halves moving against each other'),
  c('StackedReveal', 'engine/sceneTypes/StackedReveal.tsx', 'plates arriving in order, back to front'),
];

/**
 * THE FRAME PASS — everything that happens to a shot after it is composed.
 * One place each, and no template may have a second opinion.
 */
export const FRAME_COMPONENTS = [
  c('Episode', 'engine/Episode.tsx', 'the Sequence chain: scene order, durations, per-scene FilmLook'),
  c('RemotionRoot', 'engine/Root.tsx', 'fps, size and duration, all read from the config'),
  c('FilmLook', 'engine/FilmLook.tsx',
    'grain, grunge, scanlines, vignette, gate weave and grade — the ONLY place any of them exist',
    'a template writing its own grain; two grains read as noise, not as more film'),
  c('Transition', 'engine/Transition.tsx', 'the arrival a cut carries, when the cut has earned one'),
  c('Plate', 'engine/Plate.tsx', 'one photographic layer: anchor, depth share, shadow, defocus'),
  c('Field', 'engine/draw/Field.tsx', 'a drawn ground for a shot with no photograph: wash, spotlight, grid, paper, sunburst'),
  c('Fog', 'engine/draw/Glow.tsx', 'atmosphere in front of the stack', 'a fog that sits over the words — type wins'),
  c('Overlay', 'engine/draw/Overlay.tsx', 'a flat wash used to key a mood across a whole shot'),
  c('Print', 'engine/draw/Paper.tsx', 'printed matter as a surface: stock, tram, ink bleed'),
  c('Slate', 'engine/draw/Type.tsx', 'the title card`s own type block'),
  c('Flicker', 'engine/draw/Type.tsx', 'a HOLD-keyframed flash — never a fade; a ramp turns a strike into a dissolve'),
  c('DrawnProps', 'engine/draw/Props.tsx', 'the drawn objects standing in the room, each taking its depth`s share of the push'),
  c('SceneMotif', 'engine/draw/Motif.tsx', 'the motif a scene asks for, pinned to the frame and outside the camera'),
];

export const REGISTRY = [
  ...CAMERA_COMPONENTS,
  ...TYPOGRAPHY_COMPONENTS,
  ...GRAPHIC_COMPONENTS,
  ...DIAGRAM_COMPONENTS,
  ...MOTION_PRIMITIVES,
  ...SCENE_TEMPLATES,
  ...FRAME_COMPONENTS,
];

/**
 * NAMES THAT WOULD BE NEAR-DUPLICATES. The lint refuses these outright, because
 * every one of them is a decision to fork rather than to extend.
 */
export const FORBIDDEN_NAME_PATTERNS = [
  // Anchored at a word boundary so `Newspaper` is a newspaper and not a fork.
  /^(.+)2$/,
  /^New[A-Z]/,
  /^[a-z0-9]New$/,
  /^Better(.+)$/,
  /^(.+)Final$/,
  /^(.+)V\d$/,
  /^(.+)Alt$/,
  /^(.+)Copy$/,
  /^My(.+)$/,
];

export function knownComponent(name) {
  return REGISTRY.some((entry) => entry.name === name);
}

export function findComponent(name) {
  return REGISTRY.find((entry) => entry.name === name) ?? null;
}
