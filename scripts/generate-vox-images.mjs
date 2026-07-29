import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {generateImageWithFallback} from './lib/provider-chain.mjs';
import {inspectImageBuffer, inspectImageFile} from './lib/image-file.mjs';
import {validateStory} from './lib/story-schema.mjs';

const ROOT = process.cwd();
const storyPath = path.join(ROOT, 'content', 'generated', 'current-story.json');
const stylePath = path.join(ROOT, 'content', 'style', 'vox-reference.base64');
const reportPath = path.join(ROOT, 'out', 'factory', 'image-report.json');
const force = /^(1|true|yes)$/i.test(String(process.env.IMAGE_FORCE || ''));
const selectedIds = new Set(String(process.env.IMAGE_SCENE_IDS || '').split(',').map((id) => id.trim()).filter(Boolean));

async function persist(story, report) {
  await Promise.all([
    writeFile(storyPath, `${JSON.stringify(story, null, 2)}\n`, 'utf8'),
    writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
  ]);
}

async function reusableImage(scene) {
  if (force || !scene.image) return null;
  const relative = String(scene.image).replace(/^\/+/, '');
  const file = path.join(ROOT, 'public', relative);
  const publicRoot = `${path.join(ROOT, 'public')}${path.sep}`;
  if (!file.startsWith(publicRoot)) {
    console.warn(`[image] cached path rejected for ${scene.id}: outside public directory`);
    return null;
  }
  try {
    return {file, qc: await inspectImageFile(file)};
  } catch (error) {
    console.warn(`[image] cached file rejected for ${scene.id}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function fullPrompt(story, scene, index) {
  return `Use the attached image only as a visual style reference when the provider supports image input. Do not copy its traffic-light subject unless relevant.

Create scene ${index + 1} of ${story.scenes.length} for a vertical documentary Short titled: ${story.title}
Narration beat: ${scene.voiceover}

Scene composition:
${scene.visualPrompt}

Mandatory direction:
- finished vertical 9:16 editorial documentary collage
- one dominant subject, immediately understandable on a phone
- historically or factually believable context
- archival photography mixed with illustration
- rough torn-paper edges, aged cream paper, newspaper fragments without readable words
- visible halftone printing, ink grain, tactile paper fibers
- muted charcoal, dark red, mustard yellow, dusty blue, sepia and warm beige
- clear foreground, middle ground and background for camera movement
- keep important subjects away from the bottom 16% and top 10% interface zones
- no readable text, caption, logo, watermark, modern UI, infographic cards, glossy 3D, neon, anime, childish cartoon or unrelated decoration`;
}

async function main() {
  const story = validateStory(JSON.parse(await readFile(storyPath, 'utf8')));
  const styleReference = (await readFile(stylePath, 'utf8')).trim();
  if (!Array.isArray(story.scenes) || !story.scenes.length) throw new Error('Generated story has no scenes.');
  const storyIds = new Set(story.scenes.map((scene) => scene.id));
  const unknownIds = [...selectedIds].filter((id) => !storyIds.has(id));
  if (unknownIds.length) throw new Error(`Unknown IMAGE_SCENE_IDS: ${unknownIds.join(', ')}`);
  const outputRoot = path.join(ROOT, 'public', 'generated', story.slug);
  await mkdir(outputRoot, {recursive: true});
  await mkdir(path.dirname(reportPath), {recursive: true});

  const report = {version: 1, slug: story.slug, title: story.title, startedAt: new Date().toISOString(), results: []};
  for (let index = 0; index < story.scenes.length; index += 1) {
    const scene = story.scenes[index];
    if (selectedIds.size && !selectedIds.has(scene.id)) continue;
    const started = Date.now();
    const cached = await reusableImage(scene);
    if (cached) {
      report.results.push({sceneId: scene.id, status: 'skipped', reason: 'valid-cached-image', image: scene.image, qc: cached.qc, durationMs: Date.now() - started});
      await persist(story, report);
      continue;
    }
    try {
      const generated = await generateImageWithFallback({
        prompt: fullPrompt(story, scene, index),
        styleReference,
        aspectRatio: '9:16',
        seed: 1868 + index * 97,
      });
      const qc = inspectImageBuffer(generated.buffer);
      const filename = `${scene.id}.${generated.extension}`;
      const destination = path.join(outputRoot, filename);
      await writeFile(destination, generated.buffer);
      scene.image = `generated/${story.slug}/${filename}`;
      report.results.push({sceneId: scene.id, status: 'success', provider: generated.provider, model: generated.model, image: scene.image, qc, durationMs: Date.now() - started});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.results.push({sceneId: scene.id, status: 'failed', error: message, durationMs: Date.now() - started});
      await persist(story, report);
      continue;
    }
    await persist(story, report);
  }

  report.finishedAt = new Date().toISOString();
  report.summary = {
    total: report.results.length,
    generated: report.results.filter((item) => item.status === 'success').length,
    reused: report.results.filter((item) => item.status === 'skipped').length,
    failed: report.results.filter((item) => item.status === 'failed').length,
    providers: [...new Set(report.results.map((item) => item.provider).filter(Boolean))],
  };
  await persist(story, report);
  console.log(JSON.stringify(report.summary, null, 2));
  if (report.summary.failed) throw new Error(`${report.summary.failed} scene image(s) failed. Successful scenes were saved; rerun to resume.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
