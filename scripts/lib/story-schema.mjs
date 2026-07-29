const CAMERAS = new Set(['locked', 'impact-push', 'slow-push-in', 'slow-push-out', 'pan-left', 'pan-right', 'drift-up', 'drift-down']);
const SFX = new Set(['none', 'snap', 'chime', 'impact']);
const LAYERS = ['background', 'support', 'hero', 'foreground'];

const words = (value) => String(value || '').trim().split(/\s+/).filter(Boolean);
function requiredText(value, field) {if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be a non-empty string.`);}
function safePublicPath(value, field) {
  requiredText(value, field);
  if (value.startsWith('/') || value.split('/').includes('..')) throw new Error(`${field} must stay inside public/.`);
}

export function validateStory(story, {requireImages = false} = {}) {
  if (!story || typeof story !== 'object') throw new Error('Story must be an object.');
  requiredText(story.slug, 'story.slug');
  requiredText(story.title, 'story.title');
  requiredText(story.language, 'story.language');
  requiredText(story.narration, 'story.narration');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(story.slug)) throw new Error('story.slug must be URL-safe kebab-case.');
  if (!Number.isFinite(story.targetDurationSeconds) || story.targetDurationSeconds < 40 || story.targetDurationSeconds > 45) throw new Error('story.targetDurationSeconds must be between 40 and 45.');
  const narrationWords = words(story.narration).length;
  if (narrationWords < 90 || narrationWords > 132) throw new Error(`story.narration must contain 90-132 words; received ${narrationWords}.`);
  if (!Array.isArray(story.scenes) || story.scenes.length < 8 || story.scenes.length > 12) throw new Error('story.scenes must contain 8-12 scenes.');

  const ids = new Set();
  for (const [index, scene] of story.scenes.entries()) {
    const field = `story.scenes[${index}]`;
    if (!scene || typeof scene !== 'object') throw new Error(`${field} must be an object.`);
    requiredText(scene.id, `${field}.id`);
    requiredText(scene.voiceover, `${field}.voiceover`);
    requiredText(scene.headline, `${field}.headline`);
    requiredText(scene.visualPrompt, `${field}.visualPrompt`);
    if (!/^scene-\d{2}$/.test(scene.id)) throw new Error(`${field}.id must match scene-XX.`);
    if (ids.has(scene.id)) throw new Error(`Duplicate scene id: ${scene.id}.`);
    ids.add(scene.id);
    const headlineWords = words(scene.headline).length;
    if (headlineWords < 2 || headlineWords > 5) throw new Error(`${field}.headline must contain 2-5 words.`);
    if (scene.label && words(scene.label).length > 4) throw new Error(`${field}.label must contain at most 4 words.`);
    if (!CAMERAS.has(scene.camera)) throw new Error(`${field}.camera is unsupported: ${scene.camera}.`);
    if (!SFX.has(scene.sfx)) throw new Error(`${field}.sfx is unsupported: ${scene.sfx}.`);
    if (scene.layers) {
      for (const layer of LAYERS) requiredText(scene.layers[layer], `${field}.layers.${layer}`);
    }
    if (requireImages) {
      const layerPaths = scene.layerImages && typeof scene.layerImages === 'object' ? LAYERS.map((layer) => scene.layerImages[layer]).filter(Boolean) : [];
      if (layerPaths.length === LAYERS.length) layerPaths.forEach((value, layerIndex) => safePublicPath(value, `${field}.layerImages.${LAYERS[layerIndex]}`));
      else safePublicPath(scene.image, `${field}.image`);
    }
  }
  return story;
}
