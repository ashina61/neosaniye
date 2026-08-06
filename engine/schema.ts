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
};

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
  /** Partial grade for this scene only, merged over the episode's grade. */
  gradeOverride?: Partial<Grade>;
  onScreenText?: OnScreenTextSpec[];
};

export type EpisodeConfig = {
  id: string;
  title?: string;
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
  sceneOffsets,
  resolveAssets,
  OPTIONAL_ROLE,
  totalDurationInFrames,
  validateEpisodeConfig,
} from './schema.mjs';
