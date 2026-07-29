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
const layerMode = !/^(0|false|no)$/i.test(String(process.env.VOX_LAYER_MODE || 'true'));
const layerNames = ['background', 'support', 'hero', 'foreground'];

async function persist(story, report) {
  await Promise.all([writeFile(storyPath, `${JSON.stringify(story, null, 2)}\n`, 'utf8'), writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')]);
}

async function reusable(relativePath) {
  if (force || !relativePath) return null;
  const relative = String(relativePath).replace(/^\/+/, '');
  const file = path.join(ROOT, 'public', relative);
  if (!file.startsWith(`${path.join(ROOT, 'public')}${path.sep}`)) return null;
  try {return {file, qc: await inspectImageFile(file)};} catch {return null;}
}

function compositePrompt(story, scene, index) {
  return `Use the attached image only as a visual style reference. Create finished scene ${index + 1} of ${story.scenes.length} for a vertical documentary Short titled ${story.title}. Narration beat: ${scene.voiceover}. Composition: ${scene.visualPrompt}. One hero carries about 70 percent of visual weight, maximum 2-3 supporting elements, generous negative space, phone-readable, no modern UI.`;
}

function layerPrompt(story, scene, index, layer) {
  const transparent = layer !== 'background';
  return `Create ONLY the ${layer.toUpperCase()} layer for scene ${index + 1} of ${story.scenes.length}, title: ${story.title}.
Narration beat: ${scene.voiceover}
Recurring subject bible: ${(story.subjectBible || []).join(' | ') || 'none'}
Finished frame plan: ${scene.visualPrompt}
Exact layer instruction: ${scene.layers[layer]}

Alignment law: vertical 9:16 full canvas, preserve the exact size and position described by the finished frame so all four separately generated layers align when stacked. Do not add elements assigned to another layer.
${transparent ? 'TRANSPARENCY IS MANDATORY: transparent PNG-style canvas, alpha background, no paper rectangle, no room, no floor, no backdrop, no border. Only isolated hand-cut paper pieces and their subtle local shadows.' : 'BACKGROUND PLATE ONLY: fill the canvas with aged newsprint or archival map surface and fixed non-story scaffolding. No hero, no supporting subject, no foreground decoration.'}
Physical medium: hand-cut documentary paper collage, black and white halftone cutouts, rough scissor edges, torn paper, visible print grain and paper fiber, tan, ink black and halftone gray, one hot red accent and restrained mustard secondary, matte flat lighting. No digital illustration, cartoon, 3D, gloss, gradients, clutter, watermark or logos. No readable text except the scene label when explicitly assigned to this layer.`;
}

async function generateOne({prompt, styleReference, seed, destination}) {
  const generated = await generateImageWithFallback({prompt, styleReference, aspectRatio: '9:16', seed});
  const qc = inspectImageBuffer(generated.buffer);
  await writeFile(destination, generated.buffer);
  return {generated, qc};
}

async function main() {
  const story = validateStory(JSON.parse(await readFile(storyPath, 'utf8')));
  const styleReference = (await readFile(stylePath, 'utf8')).trim();
  const outputRoot = path.join(ROOT, 'public', 'generated', story.slug);
  await mkdir(outputRoot, {recursive: true});
  await mkdir(path.dirname(reportPath), {recursive: true});
  const report = {version: 2, mode: layerMode ? 'four-layer' : 'composite', slug: story.slug, title: story.title, startedAt: new Date().toISOString(), results: []};

  for (let index = 0; index < story.scenes.length; index += 1) {
    const scene = story.scenes[index];
    if (selectedIds.size && !selectedIds.has(scene.id)) continue;
    const started = Date.now();
    scene.layerImages = scene.layerImages && typeof scene.layerImages === 'object' ? scene.layerImages : {};
    try {
      if (layerMode && scene.layers) {
        const layerResults = [];
        for (let layerIndex = 0; layerIndex < layerNames.length; layerIndex += 1) {
          const layer = layerNames[layerIndex];
          const cached = await reusable(scene.layerImages[layer]);
          if (cached) {layerResults.push({layer, status: 'skipped', image: scene.layerImages[layer], qc: cached.qc}); continue;}
          const baseName = `${scene.id}-${layer}`;
          const tempDestination = path.join(outputRoot, `${baseName}.png`);
          const {generated, qc} = await generateOne({prompt: layerPrompt(story, scene, index, layer), styleReference, seed: 1868 + index * 401 + layerIndex * 37, destination: tempDestination});
          const finalName = `${baseName}.${generated.extension}`;
          const finalDestination = path.join(outputRoot, finalName);
          if (finalDestination !== tempDestination) {
            const buffer = await readFile(tempDestination);
            await writeFile(finalDestination, buffer);
          }
          scene.layerImages[layer] = `generated/${story.slug}/${finalName}`;
          layerResults.push({layer, status: 'success', provider: generated.provider, model: generated.model, image: scene.layerImages[layer], qc});
          await persist(story, report);
        }
        report.results.push({sceneId: scene.id, status: 'success', mode: 'layers', layers: layerResults, durationMs: Date.now() - started});
      } else {
        const cached = await reusable(scene.image);
        if (cached) report.results.push({sceneId: scene.id, status: 'skipped', image: scene.image, qc: cached.qc, durationMs: Date.now() - started});
        else {
          const destination = path.join(outputRoot, `${scene.id}.png`);
          const {generated, qc} = await generateOne({prompt: compositePrompt(story, scene, index), styleReference, seed: 1868 + index * 97, destination});
          const filename = `${scene.id}.${generated.extension}`;
          scene.image = `generated/${story.slug}/${filename}`;
          report.results.push({sceneId: scene.id, status: 'success', mode: 'composite', provider: generated.provider, model: generated.model, image: scene.image, qc, durationMs: Date.now() - started});
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.results.push({sceneId: scene.id, status: 'failed', error: message, durationMs: Date.now() - started});
    }
    await persist(story, report);
  }

  report.finishedAt = new Date().toISOString();
  report.summary = {total: report.results.length, generated: report.results.filter((item) => item.status === 'success').length, reused: report.results.filter((item) => item.status === 'skipped').length, failed: report.results.filter((item) => item.status === 'failed').length};
  await persist(story, report);
  console.log(JSON.stringify(report.summary, null, 2));
  if (report.summary.failed) throw new Error(`${report.summary.failed} scene image set(s) failed. Rerun to resume cached layers.`);
}

main().catch((error) => {console.error(error); process.exitCode = 1;});
