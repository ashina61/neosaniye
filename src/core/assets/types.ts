export type AssetRole =
  | 'background'
  | 'hero-cutout'
  | 'prop-cutout'
  | 'texture'
  | 'effect-overlay';

export type GeneratedAssetSpec = {
  id: string;
  role: AssetRole;
  aspectRatio: '9:16' | '1:1' | '4:5' | '16:9';
  transparent: boolean;
  prompt: string;
  negativePrompt: string;
  layer: 'background' | 'midground' | 'foreground' | 'overlay';
  animationIntent: string[];
};
