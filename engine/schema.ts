/**
 * THE CONTRACT between an episode's JSON and the engine.
 *
 * This file is the single source of truth for the config shape: the renderer
 * imports it for types, and the validator imports the runtime check below. If
 * those two ever drift, a config passes validation and then crashes the render
 * — which is the failure mode a separate schema file always produces
 * eventually.
 */

export type Grade = {
  saturate: number;
  contrast: number;
  sepia: number;
  brightness: number;
};

/** Every layer of the film treatment is independently switchable. */
export type FilmLayers = {
  grain: boolean;
  grunge: boolean;
  scanlines: boolean;
  vignette: boolean;
  gateWeave: boolean;
  grainOpacity?: number;
  grungeOpacity?: number;
  scanlineOpacity?: number;
  scanlinePeriod?: number;
  vignetteStrength?: number;
  weavePx?: number;
  weaveScale?: number;
};

export type EpisodeLook = {
  /** Motion is snapped to this rate. 12 reads as stop-motion, 30 as digital. */
  posterizeFps: number;
  grade: Grade;
  film: FilmLayers;
};

export type TextStyle = 'serif-italic' | 'sticker' | 'headline' | 'typed';
export type TextPosition = 'top' | 'center' | 'bottom' | 'left' | 'right';

export type OnScreenTextSpec = {
  text: string;
  /** Frames from the START OF ITS SCENE — never from the start of the reel. */
  atFrame: number;
  durationInFrames?: number;
  style?: TextStyle;
  position?: TextPosition;
};

/** The four shared templates. An episode may add its own under scenes/. */
export type BuiltInSceneType =
  | 'portal-zoom-reveal'
  | 'parallax-punch'
  | 'stacked-reveal'
  | 'split-shift'
  | 'title-slate'
  | 'evidence-board'
  | 'composite';
/** A string, not a union: an episode can register a custom type of its own. */
export type SceneType = string;

/**
 * ONE LAYER OF A COMPOSED SHOT.
 *
 * The reference kit settles the argument: a shot is not a photograph, it is a
 * stack. Its opening frame is seven pieces — a sky, two cut-out clouds drifting
 * at different speeds, a cut-out building, a figure, a frame, a paper texture.
 * Not one of them is a whole picture, and the depth in the shot comes from them
 * moving at different rates rather than from anything inside a file.
 *
 * DEPTH is the only idea here. One number per layer says how much of the
 * camera's push that layer takes: 0 is the far sky and barely moves, 1 is the
 * subject at the anchor and takes all of it. Everything else — parallax, the
 * sense of a real space, the reason a flat plate stops looking flat — falls out
 * of that one number.
 */
/**
 * A PROP — an object in the room that is DRAWN, not photographed.
 *
 * Law 2: people and places are photographs, everything else is drawn. A prop
 * takes a depth and stands on a point exactly as a plate does, because it is a
 * thing inside the same space; that is what separates it from a motif, which
 * is pinned to the frame because it is a graphic about the sentence rather
 * than an object in the shot.
 */
export type PropSpec = {
  kind: 'plaque' | 'newspaper' | 'card' | 'print' | 'wire' | 'beam';
  /** 0 = infinitely far, 1 = at the anchor. Same law as a layer's depth. */
  depth?: number;
  x?: number;
  y?: number;
  /** How wide the drawn object is. `wire` and `beam` read it as their size. */
  width?: number;
  rotate?: number;
  opacity?: number;
  /** Frames, scene-relative, at which it springs or draws itself on. */
  from?: number;
  /** plaque, card, newspaper: the words on it. */
  text?: string;
  heading?: string;
  lines?: string[];
  masthead?: string;
  date?: string;
  stamp?: string;
  caption?: string;
  /** wire: which outline is drawn. */
  shape?: 'diamond' | 'rect' | 'circle';
  colour?: string;
  /**
   * WHICH EDGE IT ARRIVES FROM — the same law the plates are held to.
   *
   * Two documents landing on a desk from the same direction read as one event
   * with a stutter; from opposite edges, a beat apart, they read as two capitals
   * answering. It is the whole character of the reference's third scene and it
   * costs a word.
   */
  enter?: 'left' | 'right' | 'top' | 'bottom';
  enterDistance?: number;
};

export type LayerSpec = {
  /** Asset role to draw. A layer with no role and no fill draws nothing. */
  role?: string;
  /** 0 = infinitely far, 1 = at the anchor. Drives the parallax. */
  depth?: number;
  /** Placement in scene pixels. */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** `fill` covers the frame; `bottom` stands on (x, y); `center` centres on it. */
  anchor?: 'fill' | 'bottom' | 'center';
  /** Sideways travel across the whole scene, in pixels. Clouds live on this. */
  drift?: number;
  driftY?: number;
  rotate?: number;
  opacity?: number;
  blur?: number;
  /** A cast shadow made from this layer's own artwork, never a second file. */
  shadow?: boolean;
  shadowSkew?: number;
  shadowOpacity?: number;
  /** `screen` for anything shot on black — smoke, haze, light. */
  blend?: 'normal' | 'screen';
  /** The stop-motion breath. Off for anything that should sit still. */
  alive?: boolean;
  /** Frames, scene-relative, over which this layer springs in. */
  from?: number;
  /**
   * WHICH EDGE IT COMES IN FROM — the move this layer owns, as opposed to the
   * camera move the whole shot shares.
   *
   * The reference reel's offer scene is the argument for this and it is not
   * subtle: one hand slides in from the LEFT, the other from the RIGHT, a
   * second apart. Both are flat cut-outs on one backdrop; the only thing that
   * makes it a scene rather than a picture is that each plate travels on its
   * own, from its own side, on its own beat. Without this every layer could do
   * exactly one thing — sit still and ride the push — which is a slideshow with
   * extra files in it.
   */
  enter?: 'left' | 'right' | 'top' | 'bottom';
  /** How far it travels in, in pixels. Defaults to most of the frame. */
  enterDistance?: number;
  /**
   * A DECAYING SWING about its own base, in degrees. The foam finger wagging
   * "no", a plate settling after it lands, a sign swaying. Zero for anything
   * that should arrive dead still.
   */
  swing?: number;
  /**
   * THE HIGHLIGHT TRICK — the shadow trick again, with colour instead of black.
   *
   * A second copy of the SAME artwork, recoloured, laid exactly over the first
   * and switched on and off. It costs no asset and it is how the reference reel
   * makes stacked cash glow: `sepia(1) saturate(5) hue-rotate(18deg)`.
   *
   * `flicker` are [on, off] pairs in scene frames, and they are HOLD keyframes —
   * instant on, instant off, never a fade. The whole character of it is that
   * there is no ramp: cross-fade it and it stops being electrical and becomes a
   * dissolve.
   */
  recolour?: string;
  flicker?: number[][];
};

/**
 * THE DRAWN LAYER THAT ACTS OUT THE SENTENCE.
 *
 * A photograph says who and where; a motif says what happened. Gold falling and
 * piling up while the line is about money, a route drawing itself while it is
 * about a journey, a tally counting while it is about years. It is the only
 * thing in the frame changing on purpose, so it is the thing the eye follows.
 */
export type MotifKind = 'coins' | 'rise' | 'route' | 'embers' | 'rays' | 'tally';

/** How a scene arrives. Only ever affects the incoming shot — see Transition. */
export type TransitionSpec = {
  kind?: 'cut' | 'slam' | 'slip' | 'flare' | 'rack' | 'blinds';
  frames?: number;
};

export type SceneSpec = {
  id: string;
  sceneType: SceneType;
  /** What is spoken over this scene. Data for now — the reel renders silent. */
  voText?: string;
  durationInFrames: number;
  /**
   * ROLE → FILE. The role names are the engine's vocabulary ("character",
   * "background"); the file names are the episode's business. No template ever
   * writes a file name, which is the whole reason a second episode is a folder
   * rather than a code change.
   *
   * A role written "?character" is OPTIONAL: used when the file exists, quietly
   * dropped when it does not, so a scene that wants a figure still renders on
   * the day the artwork for it is not there.
   */
  assets?: Record<string, string>;
  /** Template knobs. Frame values are relative to this scene's own start. */
  params?: Record<string, number | string | boolean | number[] | string[]>;
  /** How this shot arrives. Absent means a hard cut. */
  transition?: TransitionSpec;
  /** The layer stack, for scene types that compose one. */
  layers?: LayerSpec[];
  props?: PropSpec[];
  /**
   * A DRAWN VISUAL, described as data.
   *
   * The answer to "we do not have a photograph of this". Not a placeholder: a
   * meshing gear train is a better hero than a poor photograph of the wrong
   * machine, and a timeline is a better shot than a stock picture of a cupboard.
   * Typed loosely here because the shape is a union owned by the drawing layer;
   * `validateEpisodeConfig` checks the discriminator and the engine refuses a
   * kind it does not know.
   */
  diagram?: {type: string} & Record<string, unknown>;
  /** Partial grade for this scene only, merged over the episode's grade. */
  gradeOverride?: Partial<Grade>;
  onScreenText?: OnScreenTextSpec[];
};

export type EpisodeConfig = {
  id: string;
  title?: string;
  /**
   * The narration, episode-relative. THE CLOCK, not a layer: every scene's
   * duration is measured from this file's line boundaries, so it plays across
   * the whole reel rather than inside any one scene.
   */
  audio?: string;
  fps: number;
  width: number;
  height: number;
  look: EpisodeLook;
  scenes: SceneSpec[];
};

export {
  DEFAULT_GRADE,
  DEFAULT_FILM,
  DEFAULT_LOOK,
  BUILT_IN_SCENE_TYPES as BUILT_IN_SCENE_TYPE_LIST,
  MOTIF_KINDS,
  DIAGRAM_KINDS,
  sceneOffsets,
  resolveAssets,
  OPTIONAL_ROLE,
  totalDurationInFrames,
  validateEpisodeConfig,
} from './schema.mjs';
