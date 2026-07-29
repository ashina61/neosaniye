import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {generateStoryJson} from './lib/provider-chain.mjs';
import {validateStory} from './lib/story-schema.mjs';

const ROOT = process.cwd();
const output = path.join(ROOT, 'content', 'generated', 'current-story.json');
const topic = String(process.env.VIDEO_TOPIC || 'The first traffic signal exploded').trim();
const facts = String(process.env.VIDEO_FACTS || '').trim();
const language = String(process.env.VIDEO_LANGUAGE || 'en').trim().toLowerCase();
const requested = Number(process.env.VIDEO_SCENE_COUNT || 10);
const sceneCount = Math.max(8, Math.min(12, Number.isFinite(requested) ? requested : 10));
const cameras = ['slow-push-in', 'slow-push-out', 'pan-left', 'pan-right', 'drift-up', 'drift-down', 'impact-push'];
const sfx = ['none', 'snap', 'chime', 'impact'];

const slugify = (value) => String(value)
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || 'neosaniye-story';

const words = (value) => String(value || '').trim().split(/\s+/).filter(Boolean);

function prompt() {
  const languageRule = language.startsWith('tr')
    ? 'Write all narration, title, headlines and labels in natural Turkish.'
    : 'Write all narration, title, headlines and labels in natural English.';
  return `You are the editorial director of NeoSaniye, a vertical documentary Shorts channel.

Create a factual 40-45 second documentary story about: ${topic}
${facts ? `Use these verified facts as the factual source of truth:\n${facts}` : 'Avoid invented quotations and unsupported precise claims. Use broadly established facts.'}
${languageRule}

Return ONLY valid JSON with this shape:
{
  "title": "short documentary title",
  "hook": "one-sentence hook",
  "scenes": [
    {
      "voiceover": "one narration beat",
      "headline": "2 to 5 words",
      "label": "optional short date, place or fact",
      "visualPrompt": "specific vertical scene composition",
      "camera": "slow-push-in | slow-push-out | pan-left | pan-right | drift-up | drift-down | impact-push",
      "sfx": "none | snap | chime | impact"
    }
  ]
}

Requirements:
- Aim for ${sceneCount} scenes; 8-12 are accepted.
- Combined narration should be 90-132 words.
- One clear visual idea per scene; first scene is a strong hook and final scene is a memorable payoff.
- Every visualPrompt must describe the dominant subject, context, foreground, background, composition, mood and period details.
- Every visualPrompt must request a vertical 9:16 editorial documentary collage using archival photography and illustration, rough torn-paper edges, aged cream paper, halftone grain, ink texture, muted charcoal, dark red, mustard yellow, dusty blue and sepia.
- Every visualPrompt must say: no readable text, no caption, no logo, no watermark, no modern UI, no glossy 3D, no cartoon.
- Headlines summarize the image and are not subtitles.
- Use impact SFX at most twice and vary camera presets.`;
}

function normalize(raw, provider) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.scenes)) throw new Error('Story output has no scenes array.');
  if (raw.scenes.length < 8 || raw.scenes.length > 12) throw new Error(`Expected 8-12 scenes; received ${raw.scenes.length}.`);
  const slug = slugify(raw.title || topic);
  const scenes = raw.scenes.map((scene, index) => {
    const voiceover = String(scene.voiceover || '').trim();
    const headline = String(scene.headline || '').trim();
    const visualPrompt = String(scene.visualPrompt || '').trim();
    if (!voiceover || !headline || !visualPrompt) throw new Error(`Scene ${index + 1} is incomplete.`);
    return {
      id: `scene-${String(index + 1).padStart(2, '0')}`,
      voiceover,
      headline,
      ...(String(scene.label || '').trim() ? {label: String(scene.label).trim()} : {}),
      visualPrompt,
      camera: cameras.includes(scene.camera) ? scene.camera : cameras[index % cameras.length],
      sfx: sfx.includes(scene.sfx) ? scene.sfx : 'none',
      image: '',
    };
  });
  const narration = scenes.map((scene) => scene.voiceover).join(' ');
  const count = words(narration).length;
  if (count < 90 || count > 132) throw new Error(`Narration must be 90-132 words; received ${count}.`);
  return validateStory({
    version: 1,
    slug,
    topic,
    title: String(raw.title || topic).trim(),
    hook: String(raw.hook || scenes[0].voiceover).trim(),
    language,
    targetDurationSeconds: 42,
    minimumDurationSeconds: 40,
    maximumDurationSeconds: 45,
    artDirection: 'Historical editorial cut-paper documentary collage with archival photography, torn paper, aged cream stock, halftone grain, charcoal, dark red, mustard and dusty blue.',
    narration,
    beats: scenes.map((scene) => ({id: scene.id, trigger: words(scene.voiceover).slice(0, 5).join(' '), label: scene.headline})),
    scenes,
    generator: {provider},
    generatedAt: new Date().toISOString(),
  });
}

async function main() {
  const generated = await generateStoryJson(prompt(), normalize);
  const story = generated.value;
  await mkdir(path.dirname(output), {recursive: true});
  await writeFile(output, `${JSON.stringify(story, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    output: path.relative(ROOT, output),
    provider: generated.provider,
    title: story.title,
    scenes: story.scenes.length,
    words: words(story.narration).length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
