import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {validateStory} from './lib/story-schema.mjs';

const ROOT = process.cwd();
const input = path.join(ROOT, 'content', 'generated', 'current-story.json');
const output = path.join(ROOT, 'src', 'generated', 'vox-content.ts');

async function main() {
  const story = validateStory(JSON.parse(await readFile(input, 'utf8')), {requireImages: true});
  const module = `export type GeneratedVoxCamera = 'locked' | 'slow-push-in' | 'slow-push-out' | 'pan-left' | 'pan-right' | 'drift-up' | 'drift-down' | 'impact-push';
export type GeneratedVoxSfx = 'none' | 'snap' | 'chime' | 'impact';
export type GeneratedVoxLayers = {background: string; support: string; hero: string; foreground: string};
export type GeneratedVoxLayerImages = Partial<Record<keyof GeneratedVoxLayers, string>>;
export type GeneratedVoxScene = {id: string; voiceover: string; headline: string; label?: string; visualPrompt: string; layers?: GeneratedVoxLayers; layerImages?: GeneratedVoxLayerImages; camera: GeneratedVoxCamera; sfx: GeneratedVoxSfx; image: string};
export type GeneratedVoxContent = {slug: string; title: string; language: string; targetDurationSeconds: number; subjectBible?: string[]; scenes: GeneratedVoxScene[]};
export const VOX_CONTENT: GeneratedVoxContent = ${JSON.stringify({slug: story.slug, title: story.title, language: story.language, targetDurationSeconds: story.targetDurationSeconds, subjectBible: story.subjectBible || [], scenes: story.scenes}, null, 2)};
`;
  await mkdir(path.dirname(output), {recursive: true});
  await writeFile(output, module, 'utf8');
  console.log(JSON.stringify({output: path.relative(ROOT, output), scenes: story.scenes.length, layeredScenes: story.scenes.filter((scene) => Object.keys(scene.layerImages || {}).length === 4).length}, null, 2));
}

main().catch((error) => {console.error(error); process.exitCode = 1;});
