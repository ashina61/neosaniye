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
const cameras = ['locked', 'locked', 'locked', 'impact-push'];
const sfx = ['none', 'snap', 'chime', 'impact'];

const STYLE_BLOCK = 'hand-cut documentary paper collage on aged newsprint and archival map surfaces, black and white halftone photograph cutouts with rough scissor-cut edges and offset accent strokes, torn paper edges, masking tape fragments, typewriter caption strips, rubber stamp marks, red string and brass pins only where the story calls for connections, desaturated archival palette of tan, ink black and halftone gray with ONE hot red signal accent and restrained mustard yellow secondary, visible print grain and paper fiber, matte flat documentary lighting with soft cutout drop shadows';
const CLOSER = 'Every element must appear physically hand-cut and layered from real paper, with visible cutout edges, halftone print texture and soft shadow separation between layers. Clean minimal editorial composition with generous negative space. NOT digital illustration, NOT cartoon, NOT 3D render, NOT glossy, no gradients, no clutter, no watermark, no logos, no text beyond the specified label. Premium documentary collage aesthetic, vertical 9:16, ultra-detailed.';

const slugify = (value) => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || 'neosaniye-story';
const words = (value) => String(value || '').trim().split(/\s+/).filter(Boolean);
const clean = (value) => String(value || '').trim();

function prompt() {
  const languageRule = language.startsWith('tr') ? 'Write all narration, title, headlines and labels in natural Turkish.' : 'Write all narration, title, headlines and labels in natural English.';
  return `You are the editorial director of NeoSaniye. Follow the Crime Documentary Paper Engine rules exactly.

Create a factual 40-45 second documentary story about: ${topic}
${facts ? `Use these verified facts as the factual source of truth:\n${facts}` : 'Avoid invented quotations and unsupported precise claims. Use broadly established facts.'}
${languageRule}

Writing DNA:
- Cold open begins inside a precise moment, preferably date, named place and concrete action.
- Calm, precise documentary voice. No rhetorical questions, no viewer address, no exclamation.
- One pictureable idea per sentence. Temporal and causal connective tissue.
- Real tragedy restraint, no gore or suffering close-ups.
- Final line is 12 words or fewer and ends on an unresolved object, date, missing piece, contradiction or flat price line.

Return ONLY valid JSON with this shape:
{
  "title": "short documentary title",
  "hook": "one-sentence hook",
  "subjectBible": ["exact recurring description of each recurring person, object or place"],
  "scenes": [{
    "voiceover": "one narration beat",
    "headline": "2 to 5 words",
    "label": "optional 1 to 4 word date, place, name or number",
    "visualPrompt": "complete finished-frame composition",
    "layers": {
      "background": "empty aged paper or archival surface, fixed scaffolding only",
      "support": "maximum 2 supporting paper elements, full-canvas transparent background",
      "hero": "one dominant hero cutout carrying about 70 percent of visual weight, full-canvas transparent background",
      "foreground": "maximum 2 narrative finishing elements such as tape, stamp, pin, string or underline, full-canvas transparent background"
    },
    "camera": "locked | impact-push",
    "sfx": "none | snap | chime | impact"
  }]
}

Requirements:
- Aim for ${sceneCount} scenes, 8-12 accepted. Combined narration 90-132 words.
- One hero element per beat at about 70 percent visual weight, maximum 2-3 supporting elements, about 10 percent background interest, generous negative space.
- Default NO text. A meaningful date, name or number may use ONE label of 1-4 words only.
- Repeat every recurring subject description word-for-word across scenes. Put canonical wording in subjectBible.
- Each layer prompt must describe only that physical layer but preserve exact full-frame placement so layers align when stacked.
- Transparent layers contain no background, no floor, no rectangle, no border and no baked-in text unless specified.
- The final visualPrompt and every layer belong to this exact medium: ${STYLE_BLOCK}.
- Finish every visualPrompt with: ${CLOSER}
- Keep critical subjects outside bottom 16 percent and top 10 percent interface zones.
- Use impact SFX at most twice. Camera is normally locked because paper pieces animate independently.`;
}

function normalize(raw, provider) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.scenes)) throw new Error('Story output has no scenes array.');
  if (raw.scenes.length < 8 || raw.scenes.length > 12) throw new Error(`Expected 8-12 scenes; received ${raw.scenes.length}.`);
  const slug = slugify(raw.title || topic);
  const scenes = raw.scenes.map((scene, index) => {
    const voiceover = clean(scene.voiceover);
    const headline = clean(scene.headline);
    const visualPrompt = clean(scene.visualPrompt);
    if (!voiceover || !headline || !visualPrompt) throw new Error(`Scene ${index + 1} is incomplete.`);
    const incoming = scene.layers && typeof scene.layers === 'object' ? scene.layers : {};
    const layers = {
      background: clean(incoming.background) || `Empty aged newsprint background plate for this scene, subtle paper fiber and restrained archival stains, no story subject. ${STYLE_BLOCK}`,
      support: clean(incoming.support) || `Supporting archival paper scraps derived from this composition: ${visualPrompt}. Isolated on a fully transparent canvas.`,
      hero: clean(incoming.hero) || `Dominant hero subject derived from this composition: ${visualPrompt}. Isolated on a fully transparent canvas, rough cut edges and soft paper shadow.`,
      foreground: clean(incoming.foreground) || `Minimal final narrative paper details derived from this composition: ${visualPrompt}. Isolated on a fully transparent canvas.`,
    };
    return {
      id: `scene-${String(index + 1).padStart(2, '0')}`,
      voiceover,
      headline,
      ...(clean(scene.label) ? {label: words(scene.label).slice(0, 4).join(' ')} : {}),
      visualPrompt: `${visualPrompt}\n${STYLE_BLOCK}. ${CLOSER}`,
      layers,
      camera: ['locked', 'impact-push'].includes(scene.camera) ? scene.camera : cameras[index % cameras.length],
      sfx: sfx.includes(scene.sfx) ? scene.sfx : 'none',
      image: '',
      layerImages: {},
    };
  });
  const narration = scenes.map((scene) => scene.voiceover).join(' ');
  const count = words(narration).length;
  if (count < 90 || count > 132) throw new Error(`Narration must be 90-132 words; received ${count}.`);
  return validateStory({
    version: 2,
    slug,
    topic,
    title: clean(raw.title || topic),
    hook: clean(raw.hook || scenes[0].voiceover),
    subjectBible: Array.isArray(raw.subjectBible) ? raw.subjectBible.map(clean).filter(Boolean) : [],
    language,
    targetDurationSeconds: 42,
    minimumDurationSeconds: 40,
    maximumDurationSeconds: 45,
    artDirection: `${STYLE_BLOCK}. ${CLOSER}`,
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
  console.log(JSON.stringify({output: path.relative(ROOT, output), provider: generated.provider, title: story.title, scenes: story.scenes.length, words: words(story.narration).length, layered: true}, null, 2));
}

main().catch((error) => {console.error(error); process.exitCode = 1;});
