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

export type VisualMotif =
  | 'person'
  | 'monument'
  | 'machine'
  | 'map'
  | 'document'
  | 'money'
  | 'science'
  | 'nature'
  | 'ocean'
  | 'eye'
  | 'signal'
  | 'mystery'
  | 'generic';

export type ProceduralVisual = {
  motif: VisualMotif;
  subject?: string | null;
  secondary?: string | null;
  date?: string | null;
  location?: string | null;
  symbols?: string[];
  variant?: number;
  intensity?: 'calm' | 'medium' | 'high';
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
  visual: ProceduralVisual;
  sfx?: SfxCue[];
};

export type ProductionSpec = {
  version: 2;
  meta: {
    topic: string;
    title: string;
    language: string;
    fps: number;
    width: number;
    height: number;
    durationInFrames: number;
    visualPolicy: 'procedural-only';
    captionPolicy: 'none';
  };
  audio?: {
    voicePath?: string | null;
    musicPath?: string | null;
    voiceVolume?: number;
    musicVolume?: number;
  };
  theme?: {
    family?: 'neosaniye-premium-collage';
    accent?: 'gold' | 'red' | 'teal';
    paper?: 'cream';
    dark?: 'navy';
  };
  scenes: ProductionScene[];
  globalSfx?: SfxCue[];
};

export const DEFAULT_PRODUCTION: ProductionSpec = {
  version: 2,
  meta: {
    topic: 'NeoSaniye premium fixture',
    title: 'He sold the impossible',
    language: 'en',
    fps: 30,
    width: 1080,
    height: 1920,
    durationInFrames: 360,
    visualPolicy: 'procedural-only',
    captionPolicy: 'none',
  },
  theme: {family: 'neosaniye-premium-collage', accent: 'gold', paper: 'cream', dark: 'navy'},
  scenes: [
    {
      id: 'fixture-hook',
      template: 'hook-reveal',
      fromFrame: 0,
      durationInFrames: 120,
      headline: 'HE SOLD THE IMPOSSIBLE',
      kicker: 'one perfect lie',
      transition: 'whip-flash',
      visual: {motif: 'monument', subject: 'THE TARGET', symbols: ['SECRET', '1925'], variant: 1, intensity: 'high'},
    },
    {
      id: 'fixture-stat',
      template: 'stat-slot',
      fromFrame: 120,
      durationInFrames: 120,
      headline: 'THE NUMBER THAT SOLD IT',
      stat: '7,300',
      statLabel: 'TONS',
      transition: 'shutter',
      visual: {motif: 'money', subject: 'THE DEAL', symbols: ['IRON', 'CASH'], variant: 2, intensity: 'high'},
    },
    {
      id: 'fixture-final',
      template: 'final-twist',
      fromFrame: 240,
      durationInFrames: 120,
      headline: 'HE DID IT TWICE',
      kicker: 'the second attempt exposed him',
      dark: true,
      visual: {motif: 'mystery', subject: 'TWICE', symbols: ['FAKE', 'SOLD'], variant: 3, intensity: 'high'},
    },
  ],
};
