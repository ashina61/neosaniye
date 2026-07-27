import path from 'node:path';
import {mkdir, writeFile} from 'node:fs/promises';

const FPS = 30;
const TEMPLATE_SFX = {
  'hook-reveal': ['whoosh-entrance', 'camera-shutter'],
  'portrait-dossier': ['focus-hunt', 'paper'],
  document: ['paper', 'stamp'],
  'map-route': ['whoosh-long'],
  'stat-slot': ['focus-hunt', 'impact'],
  'explainer-diagram': ['whoosh-pan'],
  transaction: ['whoosh-entrance', 'cash'],
  consequence: ['focus-hunt', 'heartbeat'],
  'final-twist': ['whoosh-long', 'final-boom'],
  'collage-generic': ['whoosh-pan'],
};

const TRANSITION_MAP = {
  cut: 'cut',
  flash: 'whip-flash',
  whip: 'whip-flash',
  zoom: 'long-zoom',
  blur: 'shutter',
  glitch: 'shutter',
  tear: 'paper-tear',
};

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function extractStat(text) {
  const match = normalizeText(text).match(/(?:\$|£|€)?\d[\d,.]*(?:\s?(?:million|billion|trillion|thousand|tons?|people|years?|times?))?/i);
  if (!match) return null;
  const raw = match[0].trim();
  const label = raw.replace(/^(?:\$|£|€)?\d[\d,.]*\s*/i, '').trim();
  const number = raw.slice(0, raw.length - label.length).trim();
  return {number: number || raw, label: label || null};
}

function titleCaseWords(text, maxWords = 7) {
  return normalizeText(text)
    .split(' ')
    .slice(0, maxWords)
    .join(' ')
    .toUpperCase();
}

export function classifyRemotionTemplate(scene, index, total) {
  const text = `${scene?.narration || ''} ${scene?.image_prompt || ''} ${(scene?.keywords || []).join(' ')}`.toLowerCase();
  if (index === 0) return 'hook-reveal';
  if (index === total - 1) return 'final-twist';
  if (/\b(document|letter|passport|certificate|contract|newspaper|official|sealed|stamp|evidence|classified)\b/.test(text)) return 'document';
  if (/\b(map|route|voyage|sailed|travelled|traveled|from .+ to|across the|crossed the|journey|border|ocean)\b/.test(text)) return 'map-route';
  if (extractStat(text)) return 'stat-slot';
  if (/\b(sold|bought|paid|payment|money|cash|deal|auction|price|bribe|profit|fortune|bank|bond)\b/.test(text)) return 'transaction';
  if (/\b(how|inside|mechanism|works|because|caused|process|step|system|engine|diagram)\b/.test(text)) return 'explainer-diagram';
  if (/\b(died|death|collapsed|failed|disaster|disease|starved|lost|destroyed|caught|exposed|panic|shame)\b/.test(text)) return 'consequence';
  if (/\b(man|woman|leader|general|king|queen|scientist|inventor|conman|soldier|named|called)\b/.test(text)) return 'portrait-dossier';
  return 'collage-generic';
}

function sceneStartSeconds(timelineScene, fallbackStart) {
  const value = timelineScene?.start ?? timelineScene?.startSeconds ?? timelineScene?.from ?? fallbackStart;
  return Number.isFinite(Number(value)) ? Number(value) : fallbackStart;
}

function sceneDurationSeconds(timelineScene, fallbackDuration) {
  const value = timelineScene?.duration ?? timelineScene?.durationSeconds ?? fallbackDuration;
  return Math.max(0.5, Number.isFinite(Number(value)) ? Number(value) : fallbackDuration);
}

function chooseHeadline({script, scene, index, total, template}) {
  if (index === 0) return titleCaseWords(script.hook_text || scene.narration || script.title, 7);
  if (index === total - 1) return titleCaseWords(script.finale_text || scene.narration || 'THE FINAL TWIST', 7);
  const emph = (script.emphasis_words || []).find((word) => normalizeText(scene.narration).toLowerCase().includes(String(word).toLowerCase()));
  if (template === 'stat-slot') return titleCaseWords(scene.narration, 6);
  if (emph) return titleCaseWords(emph, 4);
  return titleCaseWords(scene.narration, 6);
}

function normalizeTransition(editPlan, index) {
  const raw = editPlan?.boundaries?.[index]?.transition || 'whip';
  return TRANSITION_MAP[String(raw).toLowerCase()] || 'whip-flash';
}

function mediaForScene(mediaItems, sceneIndex, publicPathForAsset) {
  return (mediaItems || [])
    .filter((item) => Number(item.scene) === sceneIndex)
    .slice(0, 2)
    .map((item, assetIndex) => ({
      path: publicPathForAsset ? publicPathForAsset(item.path, item, sceneIndex) : normalizeText(item.publicPath || item.path),
      type: item.type === 'video' ? 'video' : 'image',
      role: assetIndex === 0 ? 'hero' : 'evidence',
    }))
    .filter((asset) => asset.path);
}

function sfxForTemplate(template, sfxLibrary) {
  return (TEMPLATE_SFX[template] || [])
    .map((family, i) => {
      const asset = sfxLibrary?.[family];
      if (!asset) return null;
      return {
        path: typeof asset === 'string' ? asset : asset.path,
        family,
        atFrame: i === 0 ? 0 : 18 + i * 8,
        durationInFrames: typeof asset === 'object' ? asset.durationInFrames : undefined,
        volume: typeof asset === 'object' ? asset.volume : undefined,
      };
    })
    .filter(Boolean);
}

export function buildRemotionSpec({
  script,
  audio,
  timeline,
  mediaItems = [],
  editPlan = null,
  fps = FPS,
  width = 1080,
  height = 1920,
  publicPathForAsset,
  voicePath = null,
  musicPath = null,
  ambiencePath = null,
  sfxLibrary = {},
} = {}) {
  if (!script || !Array.isArray(script.scenes) || script.scenes.length === 0) {
    throw new Error('REMOTION_SPEC_SCENES_REQUIRED');
  }

  let fallbackStart = 0;
  const fallbackDuration = Math.max(1, Number(audio?.duration || 40) / script.scenes.length);
  const scenes = script.scenes.map((scene, index) => {
    const timelineScene = timeline?.scenes?.[index];
    const startSeconds = sceneStartSeconds(timelineScene, fallbackStart);
    const durationSeconds = sceneDurationSeconds(timelineScene, fallbackDuration);
    fallbackStart = startSeconds + durationSeconds;
    const template = classifyRemotionTemplate(scene, index, script.scenes.length);
    const stat = extractStat(scene.narration);
    const emphasis = (script.emphasis_words || [])
      .filter((word) => normalizeText(scene.narration).toLowerCase().includes(String(word).toLowerCase()))
      .slice(0, 4);

    return {
      id: `scene-${String(index + 1).padStart(2, '0')}`,
      template,
      fromFrame: Math.max(0, Math.round(startSeconds * fps)),
      durationInFrames: Math.max(15, Math.round(durationSeconds * fps)),
      narration: normalizeText(scene.narration),
      headline: chooseHeadline({script, scene, index, total: script.scenes.length, template}),
      kicker: index === script.scenes.length - 1
        ? titleCaseWords(script.finale_text || scene.narration, 7)
        : emphasis.slice(0, 2).join(' · '),
      stat: stat?.number || null,
      statLabel: stat?.label ? stat.label.toUpperCase() : null,
      emphasis,
      transition: normalizeTransition(editPlan, index),
      dark: template === 'consequence' || template === 'final-twist',
      assets: mediaForScene(mediaItems, index, publicPathForAsset),
      sfx: sfxForTemplate(template, sfxLibrary),
    };
  });

  const durationInFrames = Math.max(
    Math.round(Number(audio?.duration || fallbackStart) * fps),
    ...scenes.map((scene) => scene.fromFrame + scene.durationInFrames),
  );

  return {
    version: 1,
    meta: {
      topic: normalizeText(script.topic || script.normalizedTopic || 'NeoSaniye story'),
      title: normalizeText(script.title || script.topic || 'NeoSaniye story'),
      language: normalizeText(script.language || process.env.CONTENT_LANGUAGE || 'en'),
      fps,
      width,
      height,
      durationInFrames,
    },
    audio: {
      voicePath,
      musicPath,
      ambiencePath,
      voiceVolume: 1,
      musicVolume: 0.14,
    },
    theme: {
      family: 'neosaniye-collage',
      accent: 'gold',
      paper: 'cream',
      dark: 'navy',
    },
    scenes,
    globalSfx: [],
  };
}

export async function writeRemotionSpec(spec, outputPath) {
  if (!spec?.meta || !Array.isArray(spec?.scenes)) throw new Error('REMOTION_SPEC_INVALID');
  await mkdir(path.dirname(outputPath), {recursive: true});
  await writeFile(outputPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
  return outputPath;
}
