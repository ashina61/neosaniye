export type SceneTemplate =
  | 'hook-reveal'
  | 'portrait-dossier'
  | 'document'
  | 'map-route'
  | 'stat-slot'
  | 'explainer-diagram'
  | 'transaction'
  | 'consequence'
  | 'final-twist'
  | 'collage-generic';

export type SceneAsset = {
  path: string;
  type?: 'image' | 'video';
  role?: 'hero' | 'background' | 'evidence' | 'texture';
};

export type SfxCue = {
  path: string;
  atFrame: number;
  durationInFrames?: number;
  volume?: number;
  family?: string;
};

export type ProductionScene = {
  id: string;
  template: SceneTemplate;
  fromFrame: number;
  durationInFrames: number;
  narration?: string;
  headline?: string;
  kicker?: string;
  stat?: string;
  statLabel?: string;
  emphasis?: string[];
  transition?: 'cut' | 'whip-flash' | 'shutter' | 'long-zoom' | 'paper-tear';
  dark?: boolean;
  assets?: SceneAsset[];
  sfx?: SfxCue[];
};

export type ProductionSpec = {
  version: 1;
  meta: {
    topic: string;
    title: string;
    language: string;
    fps: number;
    width: number;
    height: number;
    durationInFrames: number;
  };
  audio?: {
    voicePath?: string | null;
    musicPath?: string | null;
    ambiencePath?: string | null;
    voiceVolume?: number;
    musicVolume?: number;
  };
  theme?: {
    family?: 'neosaniye-collage';
    accent?: 'gold' | 'red' | 'teal';
    paper?: 'cream';
    dark?: 'navy';
  };
  scenes: ProductionScene[];
  globalSfx?: SfxCue[];
};

export const DEFAULT_PRODUCTION: ProductionSpec = {
  version: 1,
  meta: {
    topic: 'NeoSaniye fixture',
    title: 'A country that never existed',
    language: 'en',
    fps: 30,
    width: 1080,
    height: 1920,
    durationInFrames: 360,
  },
  theme: {family: 'neosaniye-collage', accent: 'gold', paper: 'cream', dark: 'navy'},
  scenes: [
    {
      id: 'fixture-hook',
      template: 'hook-reveal',
      fromFrame: 0,
      durationInFrames: 120,
      headline: 'HE SOLD A COUNTRY',
      kicker: 'that did not exist',
      transition: 'whip-flash',
    },
    {
      id: 'fixture-stat',
      template: 'stat-slot',
      fromFrame: 120,
      durationInFrames: 120,
      headline: 'REAL PEOPLE BOARDED SHIPS',
      stat: '250',
      statLabel: 'SETTLERS',
      transition: 'shutter',
    },
    {
      id: 'fixture-final',
      template: 'final-twist',
      fromFrame: 240,
      durationInFrames: 120,
      headline: 'THE NATION WAS FAKE',
      kicker: 'the journey was real',
      dark: true,
    },
  ],
};
