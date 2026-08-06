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

export type TextStyle = 'serif-italic' | 'sticker' | 'headline';
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
  | 'evidence-board';
/** A string, not a union: an episode can register a custom type of its own. */
export type SceneType = string;

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
   */
  assets?: Record<string, string>;
  /** Template knobs. Frame values are relative to this scene's own start. */
  params?: Record<string, number | string | boolean | number[] | string[]>;
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
  totalDurationInFrames,
  validateEpisodeConfig,
} from './schema.mjs';
