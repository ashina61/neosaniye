import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const input = path.join(ROOT, 'content', 'generated', 'current-story.json');
const output = path.join(ROOT, 'src', 'generated', 'vox-content.ts');

async function main() {
  const story = JSON.parse(await readFile(input, 'utf8'));
  if (!Array.isArray(story.scenes) || !story.scenes.length) throw new Error('Generated story has no scenes.');
  if (story.scenes.some((scene) => !scene.image)) throw new Error('Story contains scenes without generated image paths.');
  const module = `export type GeneratedVoxCamera = 'slow-push-in' | 'slow-push-out' | 'pan-left' | 'pan-right' | 'drift-up' | 'drift-down' | 'impact-push';
export type GeneratedVoxSfx = 'none' | 'snap' | 'chime' | 'impact';
export type GeneratedVoxScene = {id: string; voiceover: string; headline: string; label?: string; visualPrompt: string; camera: GeneratedVoxCamera; sfx: GeneratedVoxSfx; image: string};
export type GeneratedVoxContent = {slug: string; title: string; language: string; targetDurationSeconds: number; scenes: GeneratedVoxScene[]};
export const VOX_CONTENT: GeneratedVoxContent = ${JSON.stringify({
    slug: story.slug,
    title: story.title,
    language: story.language,
    targetDurationSeconds: story.targetDurationSeconds,
    scenes: story.scenes,
  }, null, 2)};
`;
  await mkdir(path.dirname(output), {recursive: true});
  await writeFile(output, module, 'utf8');
  console.log(JSON.stringify({output: path.relative(ROOT, output), scenes: story.scenes.length}, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
