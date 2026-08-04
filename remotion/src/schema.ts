/**
 * REEL SPEC — the machine form of the beat sheet.
 *
 * One voiceover line = one beat = one rig. The spec carries no React: every
 * value a scene needs is a prop here, so a beat can be re-timed, re-graded or
 * re-cast without touching a component.
 */

import type {SetId} from './engine/stage';
import type {MotifId} from './engine/motifs';
import type {AtmosphereId} from './engine/atmosphere';

/** The signature animation a beat runs on. */
export type RigId =
  | 'portal-zoom'
  | 'villain-punch'
  | 'paper-drop'
  | 'grounded-punch'
  | 'money-room'
  | 'finale-clone';

/** Where a beat sits in the emotional arc — chosen from the line, not the index. */
export type BeatRole = 'setup' | 'rejection' | 'turn' | 'fall' | 'payoff' | 'button';

export type AssetRole = 'plate' | 'character' | 'prop' | 'texture';

export type BeatAsset = {
  path: string;
  type?: 'image' | 'video';
  role: AssetRole;
};

export type SfxCue = {
  path: string;
  /** Frames from the start of the beat. */
  atFrame: number;
  durationInFrames?: number;
  volume?: number;
  family?: string;
};

/**
 * On-screen words. `text` is always a verbatim fragment of the spoken line —
 * never a paraphrase — and `atFrame` is where that fragment is actually
 * spoken, measured from the TTS word timings.
 */
export type Caption = {
  text: string;
  atFrame: number;
  durationInFrames?: number;
  style?: 'serif-italic' | 'sticker' | 'slot' | 'headline';
  side?: 'left' | 'right' | 'center';
  /** Hand-drawn mark that draws on under/around the words. */
  mark?: 'none' | 'underline' | 'oval';
};

/** The four-value colour filter, exposed so a beat can be graded on its own. */
export type Grade = {
  saturate: number;
  contrast: number;
  sepia: number;
  brightness: number;
};

/**
 * Every layer of the film treatment can be switched off independently, and
 * every layer's strength is a number rather than a constant — the treatment is
 * part of a video's identity, not a house style stamped on all of them.
 */
export type FilmLayers = {
  scanlines: boolean;
  grain: boolean;
  grunge: boolean;
  vignette: boolean;
  weave: boolean;
  scanlineOpacity?: number;
  scanlinePeriod?: number;
  grainOpacity?: number;
  grungeOpacity?: number;
  vignetteStrength?: number;
  weavePx?: number;
  weaveScale?: number;
};

/** The video's colour world. Chosen once per production, never per scene. */
export type Palette = {
  ink: string;
  paper: string;
  paperLight: string;
  paperDark: string;
  accent: string;
  accentDark: string;
  cool: string;
  danger: string;
  white: string;
};

/** Which drawing each coded prop uses in THIS video. */
export type PropVariants = {
  frame: 'ornate' | 'museum' | 'brass';
  masthead: string;
  gesture: 'foam-finger' | 'flat-palm' | 'stamp';
  rayCount: number;
};

/**
 * Choreography polarity. The same mechanic, mirrored and re-biased, so two
 * videos are not the same storyboard with different photographs in it.
 */
export type MotionVariants = {
  polarity: 1 | -1;
  cardOrder: number[];
  lampSide: number;
  punchBias: number;
  pushBias: number;
  portalScale: number;
};

export type Look = {
  name: string;
  seed: number;
  palette: Palette;
  grade: Grade;
  film: FilmLayers;
  props: PropVariants;
  motion: MotionVariants;
};

/**
 * Rig props. Every rig exposes its choreography as plain numbers so it can be
 * dragged live in Studio and written back into the spec — nothing is hidden in
 * component code.
 */
export type RigProps = {
  /** portal-zoom */
  pushEndFrame?: number;
  throughEndFrame?: number;
  detachFrame?: number;
  wallScaleEnd?: number;
  weldRatio?: number;
  /** villain-punch */
  riseFrame?: number;
  punchScale?: number;
  slotFrame?: number;
  slotWord?: string;
  negativeFrame?: number;
  /** paper-drop */
  cardFrames?: number[];
  cardTexts?: string[];
  /** grounded-punch / finale-clone */
  groundY?: number;
  characterPunch?: number;
  platePunch?: number;
  shadowSkew?: number;
  shadowOpacity?: number;
  shiftFrame?: number;
  shiftPx?: number;
  gesture?: 'none' | 'wag';
  gestureFrame?: number;
  /** money-room */
  lampX?: number;
  lampY?: number;
  flickerFrames?: number[];
  focusDipFrame?: number;
  /** shared */
  kenBurns?: number;
  /**
   * What the line is about — read from the line itself, not from the rig.
   * `set` is the place, `motif` the drawn object, `atmosphere` the effect in
   * the air. Without these, every rig draws the same room forever.
   */
  set?: SetId;
  motif?: MotifId | null;
  atmosphere?: AtmosphereId;
};

export type Beat = {
  id: string;
  rig: RigId;
  role: BeatRole;
  /** The spoken line this beat exists to serve. The source code. */
  line: string;
  fromFrame: number;
  durationInFrames: number;
  captions: Caption[];
  assets: BeatAsset[];
  sfx: SfxCue[];
  props: RigProps;
  grade: Grade;
  film?: Partial<FilmLayers>;
  /** Rig this one was cloned from — a reskin, not a new mechanic. */
  clonedFrom?: RigId;
};

export type ReelSpec = {
  version: 2;
  meta: {
    topic: string;
    title: string;
    language: string;
    fps: number;
    width: number;
    height: number;
    durationInFrames: number;
  };
  engine: {
    /** Motion is snapped to this rate so it stutters like stop-motion. */
    posterizeFps: number;
    gateWeavePx: number;
    weaveScale: number;
    grade: Grade;
    film: FilmLayers;
    /** This video's identity: colours, treatment strength, prop and motion variants. */
    look: Look;
  };
  audio?: {
    voicePath?: string | null;
    musicPath?: string | null;
    ambiencePath?: string | null;
    voiceVolume?: number;
    musicVolume?: number;
    /** Music drops to this level while a line is being spoken. */
    musicDuckVolume?: number;
    /** Windows, in frames, where narration is on top and music must duck. */
    duckWindows?: Array<[number, number]>;
  };
  beats: Beat[];
  globalSfx?: SfxCue[];
};

export const DEFAULT_GRADE: Grade = {
  saturate: 0.86,
  contrast: 1.08,
  sepia: 0.16,
  brightness: 0.95,
};

export const DEFAULT_FILM: FilmLayers = {
  scanlines: true,
  grain: true,
  grunge: true,
  vignette: true,
  weave: true,
  scanlineOpacity: 0.16,
  scanlinePeriod: 8,
  grainOpacity: 0.55,
  grungeOpacity: 0.16,
  vignetteStrength: 0.5,
  weavePx: 5,
  weaveScale: 1.012,
};

/**
 * The fallback identity. A real production always carries its own look, chosen
 * from its topic — this exists so a hand-written spec or a Studio preview still
 * renders, not so that videos share a house palette.
 */
export const DEFAULT_LOOK: Look = {
  name: 'genel / tarih — krem arşiv',
  seed: 0,
  palette: {
    ink: '#171511',
    paper: '#efe6d3',
    paperLight: '#f8f1e4',
    paperDark: '#d7c6a9',
    accent: '#d5a52d',
    accentDark: '#9b6d11',
    cool: '#9fc8c6',
    danger: '#bc493f',
    white: '#fffdf7',
  },
  grade: DEFAULT_GRADE,
  film: DEFAULT_FILM,
  props: {frame: 'ornate', masthead: 'THE DAILY RECORD', gesture: 'foam-finger', rayCount: 30},
  motion: {polarity: 1, cardOrder: [0, 1, 2], lampSide: 0.55, punchBias: 1.7, pushBias: 1.12, portalScale: 6.8},
};

export const DEFAULT_REEL: ReelSpec = {
  version: 2,
  meta: {
    topic: 'NeoSaniye fixture',
    title: 'The most expensive no in history',
    language: 'en',
    fps: 30,
    width: 1080,
    height: 1920,
    durationInFrames: 360,
  },
  engine: {
    posterizeFps: 12,
    gateWeavePx: 5,
    weaveScale: 1.012,
    grade: DEFAULT_GRADE,
    film: DEFAULT_FILM,
    look: DEFAULT_LOOK,
  },
  beats: [
    {
      id: 'beat-01',
      rig: 'portal-zoom',
      role: 'setup',
      line: 'In 2000, a small startup pitched the giant that owned every store.',
      fromFrame: 0,
      durationInFrames: 120,
      captions: [
        {text: 'a small startup', atFrame: 78, durationInFrames: 42, style: 'serif-italic', side: 'center'},
      ],
      assets: [],
      sfx: [],
      props: {pushEndFrame: 46, throughEndFrame: 76, detachFrame: 62, wallScaleEnd: 6.8, weldRatio: 0.369},
      grade: DEFAULT_GRADE,
    },
    {
      id: 'beat-02',
      rig: 'paper-drop',
      role: 'turn',
      line: 'So they built the opposite. No late fees. No stores. Customer first.',
      fromFrame: 120,
      durationInFrames: 120,
      captions: [
        {text: 'built the opposite', atFrame: 4, durationInFrames: 44, style: 'serif-italic', side: 'center'},
      ],
      assets: [],
      sfx: [],
      props: {cardFrames: [20, 60, 100], cardTexts: ['NO LATE FEES', 'NO STORES', 'CUSTOMER FIRST']},
      grade: DEFAULT_GRADE,
    },
    {
      id: 'beat-03',
      rig: 'finale-clone',
      role: 'button',
      line: 'This was the most expensive no in history.',
      fromFrame: 240,
      durationInFrames: 120,
      captions: [
        {text: 'The most expensive', atFrame: 8, durationInFrames: 60, style: 'serif-italic', side: 'left'},
        {text: 'in history', atFrame: 40, durationInFrames: 70, style: 'serif-italic', side: 'left', mark: 'underline'},
      ],
      assets: [],
      sfx: [],
      props: {
        groundY: 1690,
        characterPunch: 1.7,
        platePunch: 1.12,
        shadowSkew: -53,
        shadowOpacity: 0.55,
        gesture: 'wag',
        gestureFrame: 24,
      },
      grade: {saturate: 0.62, contrast: 1.12, sepia: 0.06, brightness: 0.94},
      clonedFrom: 'grounded-punch',
    },
  ],
};
