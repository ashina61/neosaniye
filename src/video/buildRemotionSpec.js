import path from 'node:path';
import {mkdir, writeFile} from 'node:fs/promises';

const FPS = 30;

const TEMPLATE_SFX = {
  'hook-reveal': ['whoosh-entrance', 'camera-shutter', 'impact'],
  'portrait-dossier': ['focus-hunt', 'paper', 'stamp'],
  document: ['paper', 'stamp', 'focus-hunt'],
  'map-route': ['whoosh-long', 'whoosh-pan', 'impact'],
  'stat-slot': ['focus-hunt', 'impact', 'coin'],
  'explainer-diagram': ['whoosh-pan', 'focus-hunt', 'impact'],
  transaction: ['whoosh-entrance', 'cash', 'coin'],
  consequence: ['focus-hunt', 'heartbeat', 'impact'],
  'final-twist': ['whoosh-long', 'neon-buzz', 'final-boom'],
  'collage-generic': ['whoosh-pan', 'paper', 'impact'],
};

const TRANSITION_MAP = {
  cut: 'cut', flash: 'whip-flash', whip: 'whip-flash', zoom: 'long-zoom',
  blur: 'shutter', glitch: 'shutter', tear: 'paper-tear', shutter: 'shutter',
};

const STORY_TEMPLATE_MAP = {
  mechanism: 'explainer-diagram', chain: 'explainer-diagram', cause_effect: 'explainer-diagram',
  chain_reaction: 'explainer-diagram', problem_solution: 'explainer-diagram', filtering: 'explainer-diagram',
  reconstruct: 'explainer-diagram', retrieval: 'explainer-diagram', emotion_link: 'explainer-diagram',
  comparison: 'explainer-diagram', construction: 'explainer-diagram', map: 'map-route',
  navigation: 'map-route', flow: 'map-route', communication: 'map-route', quantity: 'stat-slot',
  scale: 'stat-slot', timeline: 'document', search_reveal: 'portrait-dossier', atmosphere: 'collage-generic',
};

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function extractStat(text) {
  const match = normalizeText(text).match(
    /(?:\$|£|€)?\d[\d,.]*(?:\s?(?:million|billion|trillion|thousand|tons?|people|years?|times?|percent|%))?/i,
  );
  if (!match) return null;
  const raw = match[0].trim();
  const label = raw.replace(/^(?:\$|£|€)?\d[\d,.]*\s*/i, '').trim();
  const number = raw.slice(0, raw.length - label.length).trim();
  return {number: number || raw, label: label || null};
}

function extractDate(text) {
  const m = normalizeText(text).match(/\b(?:1[5-9]\d{2}|20\d{2}|\d{1,2}(?:st|nd|rd|th)? century)\b/i);
  return m?.[0] || null;
}

function titleCaseWords(text, maxWords = 6) {
  return normalizeText(text).split(' ').filter(Boolean).slice(0, maxWords).join(' ').toUpperCase();
}

function cleanEditorialPhrase(text, maxWords = 5) {
  const cleaned = normalizeText(text)
    .replace(/^(and|but|so|then|because|however|meanwhile|in fact)\s+/i, '')
    .replace(/[.!?,;:]+$/g, '');
  return titleCaseWords(cleaned, maxWords);
}

function uniqueWords(words) {
  return [...new Set((words || []).map((w) => normalizeText(w).toUpperCase()).filter(Boolean))];
}

export function classifyRemotionTemplate(scene, index, total) {
  const text = `${scene?.narration || ''} ${scene?.image_prompt || ''} ${(scene?.keywords || []).join(' ')}`.toLowerCase();
  if (index === 0) return 'hook-reveal';
  if (index === total - 1) return 'final-twist';
  const planned = STORY_TEMPLATE_MAP[normalizeText(scene?.story_template).toLowerCase()];
  if (planned && planned !== 'collage-generic') return planned;
  if (/\b(document|letter|passport|certificate|contract|newspaper|official|sealed|stamp|evidence|classified|record|archive)\b/.test(text)) return 'document';
  if (extractStat(text)) return 'stat-slot';
  if (/\b(map|route|voyage|sailed|travelled|traveled|from .+ to|across the|crossed the|journey|border|ocean|island|country|city)\b/.test(text)) return 'map-route';
  if (/\b(sold|bought|paid|payment|money|cash|deal|auction|price|bribe|profit|fortune|bank|bond|market)\b/.test(text)) return 'transaction';
  if (/\b(how|inside|mechanism|works|because|caused|process|step|system|engine|diagram|gear|signal|cycle)\b/.test(text)) return 'explainer-diagram';
  if (/\b(died|death|collapsed|failed|disaster|disease|starved|lost|destroyed|caught|exposed|panic|shame|danger)\b/.test(text)) return 'consequence';
  if (/\b(man|woman|leader|general|king|queen|scientist|inventor|conman|soldier|named|called|artist|explorer)\b/.test(text)) return 'portrait-dossier';
  return planned || 'collage-generic';
}

function visualMotif(scene, template) {
  const text = `${scene?.narration || ''} ${(scene?.keywords || []).join(' ')} ${scene?.story_template || ''}`.toLowerCase();
  if (/\b(eye|vision|see|light|ultraviolet|color)\b/.test(text)) return 'eye';
  if (/\b(animal|bird|fish|flower|tree|forest|insect|plant|nature)\b/.test(text)) return 'nature';
  if (/\b(ship|ocean|sea|wave|island|coast)\b/.test(text)) return 'ocean';
  if (/\b(signal|radio|message|code|frequency|sound)\b/.test(text)) return 'signal';
  if (/\b(science|atom|space|planet|star|chemical|energy|light)\b/.test(text)) return 'science';
  if (/\b(machine|mechanism|gear|engine|computer|device|clock)\b/.test(text)) return 'machine';
  if (/\b(tower|bridge|building|monument|pyramid|statue|city)\b/.test(text)) return 'monument';
  if (/\b(money|cash|bank|bond|sold|paid|price|deal)\b/.test(text)) return 'money';
  if (/\b(document|letter|paper|record|contract|passport|newspaper)\b/.test(text)) return 'document';
  if (/\b(map|route|country|border|journey|travel)\b/.test(text)) return 'map';
  if (/\b(man|woman|person|leader|scientist|inventor|king|queen|general|named|called)\b/.test(text)) return 'person';
  if (template === 'final-twist' || /\b(secret|fake|mystery|unknown|hidden|twist)\b/.test(text)) return 'mystery';
  return 'generic';
}

function extractLocation(text) {
  const source = normalizeText(text);
  const patterns = [
    /\b(?:in|from|to|across)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/,
    /\b(Paris|London|Europe|America|Africa|Asia|Atlantic|Pacific|Rome|Egypt|Greece)\b/i,
  ];
  for (const pattern of patterns) {
    const m = source.match(pattern);
    if (m) return m[1] || m[0];
  }
  return null;
}

function chooseHeadline({script, scene, index, total, template}) {
  if (index === 0) return cleanEditorialPhrase(script.hook_text || scene.narration || script.title, 7);
  if (index === total - 1) return cleanEditorialPhrase(script.finale_text || scene.narration || 'THE FINAL TWIST', 7);
  const narration = normalizeText(scene.narration).toLowerCase();
  const emphasis = (script.emphasis_words || []).find((word) => narration.includes(String(word).toLowerCase()));
  if (template === 'stat-slot') {
    const stat = extractStat(scene.narration);
    return stat ? cleanEditorialPhrase(scene.narration.replace(stat.number, ''), 5) : cleanEditorialPhrase(scene.narration, 5);
  }
  if (emphasis) return cleanEditorialPhrase(emphasis, 4);
  const keywords = (scene.keywords || []).filter(Boolean);
  if (keywords.length) return cleanEditorialPhrase(keywords.slice(0, 3).join(' '), 5);
  return cleanEditorialPhrase(scene.narration, 5);
}

function chooseKicker(script, scene, index, total, stat) {
  if (index === total - 1) return cleanEditorialPhrase(script.finale_text || scene.narration, 8);
  if (stat?.label) return stat.label.toUpperCase();
  const narration = normalizeText(scene.narration).toLowerCase();
  const emphasis = uniqueWords((script.emphasis_words || []).filter((word) => narration.includes(String(word).toLowerCase())));
  if (emphasis.length) return emphasis.slice(0, 2).join(' · ');
  return uniqueWords(scene.keywords || []).slice(0, 2).join(' · ');
}

function normalizeTransition(editPlan, index) {
  const raw = editPlan?.boundaries?.[index]?.transition || (index % 3 === 0 ? 'shutter' : index % 2 ? 'whip' : 'zoom');
  return TRANSITION_MAP[String(raw).toLowerCase()] || 'whip-flash';
}

function sfxForTemplate(template, sfxLibrary, durationInFrames) {
  const families = TEMPLATE_SFX[template] || TEMPLATE_SFX['collage-generic'];
  return families.map((family, index) => {
    const asset = sfxLibrary?.[family];
    if (!asset) return null;
    const positions = [0, Math.max(8, Math.round(durationInFrames * 0.28)), Math.max(18, Math.round(durationInFrames * 0.62))];
    return {
      path: typeof asset === 'string' ? asset : asset.path,
      family,
      atFrame: positions[index] ?? 0,
      durationInFrames: typeof asset === 'object' ? asset.durationInFrames : undefined,
      volume: typeof asset === 'object' ? asset.volume : undefined,
    };
  }).filter(Boolean);
}

function sceneDurationSeconds(timelineScene, fallbackDuration) {
  const value = timelineScene?.duration ?? timelineScene?.durationSeconds ?? fallbackDuration;
  return Math.max(0.7, Number.isFinite(Number(value)) ? Number(value) : fallbackDuration);
}

export function buildRemotionSpec({
  script, audio, timeline, editPlan = null, fps = FPS, width = 1080, height = 1920,
  voicePath = null, musicPath = null, sfxLibrary = {},
} = {}) {
  if (!script || !Array.isArray(script.scenes) || script.scenes.length === 0) throw new Error('REMOTION_SPEC_SCENES_REQUIRED');

  const fallbackDuration = Math.max(1, Number(audio?.duration || 40) / script.scenes.length);
  let frameCursor = 0;
  const scenes = script.scenes.map((scene, index) => {
    const template = classifyRemotionTemplate(scene, index, script.scenes.length);
    const seconds = sceneDurationSeconds(timeline?.scenes?.[index], fallbackDuration);
    const durationInFrames = Math.max(21, Math.round(seconds * fps));
    const stat = extractStat(scene.narration);
    const narration = normalizeText(scene.narration);
    const emphasis = uniqueWords((script.emphasis_words || [])
      .filter((word) => narration.toLowerCase().includes(String(word).toLowerCase())))
      .slice(0, 4);
    const motif = visualMotif(scene, template);
    const subject = cleanEditorialPhrase(scene.subject || scene.keywords?.[0] || script.topic || script.title, 4);
    const secondary = cleanEditorialPhrase(scene.keywords?.slice(1, 3).join(' ') || scene.story_template || '', 4) || null;
    const symbols = uniqueWords([
      ...(scene.keywords || []).slice(0, 3),
      ...emphasis.slice(0, 2),
      extractDate(narration),
    ]).filter(Boolean).slice(0, 5);

    const result = {
      id: `scene-${String(index + 1).padStart(2, '0')}`,
      template,
      fromFrame: frameCursor,
      durationInFrames,
      narration,
      headline: chooseHeadline({script, scene, index, total: script.scenes.length, template}),
      kicker: chooseKicker(script, scene, index, script.scenes.length, stat),
      stat: stat?.number || null,
      statLabel: stat?.label ? stat.label.toUpperCase() : null,
      emphasis,
      transition: normalizeTransition(editPlan, index),
      dark: template === 'consequence' || template === 'final-twist',
      visual: {
        motif,
        subject,
        secondary,
        date: extractDate(narration),
        location: extractLocation(scene.narration),
        symbols,
        variant: (index % 4) + 1,
        intensity: index === 0 || index === script.scenes.length - 1 ? 'high' : template === 'document' ? 'calm' : 'medium',
      },
      sfx: sfxForTemplate(template, sfxLibrary, durationInFrames),
    };
    frameCursor += durationInFrames;
    return result;
  });

  const narrationFrames = Math.round(Number(audio?.duration || frameCursor / fps) * fps);
  const durationInFrames = Math.max(frameCursor, narrationFrames + Math.round(fps * 0.35));

  return {
    version: 2,
    meta: {
      topic: normalizeText(script.topic || script.normalizedTopic || 'NeoSaniye story'),
      title: normalizeText(script.title || script.topic || 'NeoSaniye story'),
      language: normalizeText(script.language || process.env.CONTENT_LANGUAGE || 'en'),
      fps, width, height, durationInFrames,
      visualPolicy: 'procedural-only',
      captionPolicy: 'none',
    },
    audio: {voicePath, musicPath, voiceVolume: 1, musicVolume: 0.18},
    theme: {family: 'neosaniye-premium-collage', accent: 'gold', paper: 'cream', dark: 'navy'},
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
