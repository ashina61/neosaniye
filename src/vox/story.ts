import {SCENES, TOTAL_FRAMES} from '../generated/timing';
import {VOX_CONTENT, type GeneratedVoxCamera, type GeneratedVoxSfx} from '../generated/vox-content';

export const VOX_FPS = 30;
export const VOX_WIDTH = 1080;
export const VOX_HEIGHT = 1920;

export type VoxScene = {
  id: string;
  durationInFrames: number;
  voiceover: string;
  headline: string;
  label?: string;
  visualPrompt: string;
  camera: GeneratedVoxCamera;
  sfx: GeneratedVoxSfx;
  image: string;
};

const generatedStarts = VOX_CONTENT.scenes.map((scene) => (SCENES as unknown as Record<string, number>)[scene.id]);
const generatedDuration = TOTAL_FRAMES / VOX_FPS;
const usable = generatedDuration >= 40 && generatedDuration <= 45 && generatedStarts.every((value, index) => Number.isFinite(value) && value >= 0 && (index === 0 || value > generatedStarts[index - 1]));
const fallbackTotal = Math.round(VOX_CONTENT.targetDurationSeconds * VOX_FPS);
const fallbackStarts = Array.from({length: VOX_CONTENT.scenes.length + 1}, (_, index) => index === VOX_CONTENT.scenes.length ? fallbackTotal : Math.round((fallbackTotal * index) / VOX_CONTENT.scenes.length));

export const VOX_SCENE_STARTS = usable ? [...generatedStarts, TOTAL_FRAMES] : fallbackStarts;
export const VOX_TOTAL_FRAMES = VOX_SCENE_STARTS.at(-1) ?? fallbackTotal;

export const voxStory = {
  slug: VOX_CONTENT.slug,
  title: VOX_CONTENT.title,
  language: VOX_CONTENT.language,
  scenes: VOX_CONTENT.scenes.map<VoxScene>((scene, index) => ({
    ...scene,
    durationInFrames: Math.max(1, VOX_SCENE_STARTS[index + 1] - VOX_SCENE_STARTS[index]),
  })),
};
