/**
 * THE RUNTIME HALF OF THE CONTRACT — plain JavaScript on purpose.
 *
 * The validator script and the render bundle must run the SAME validation. An
 * earlier draft kept this in TypeScript and had the validator strip the types
 * with regexes at load time; that works right up until someone writes a generic
 * the regex does not expect, and then a config passes validation and crashes
 * the render. Plain JS here, types in schema.ts, one implementation.
 */

export const DEFAULT_GRADE = {
  saturate: 0.86,
  contrast: 1.08,
  sepia: 0.16,
  brightness: 0.95,
};

export const DEFAULT_FILM = {
  grain: true,
  grunge: true,
  scanlines: true,
  vignette: true,
  gateWeave: true,
  grainOpacity: 0.55,
  grungeOpacity: 0.16,
  scanlineOpacity: 0.16,
  scanlinePeriod: 8,
  vignetteStrength: 0.5,
  weavePx: 5,
  weaveScale: 1.012,
};

export const DEFAULT_LOOK = {
  posterizeFps: 12,
  grade: DEFAULT_GRADE,
  film: DEFAULT_FILM,
};

/**
 * The templates the engine ships with.
 *
 * An episode may register more of its own under `scenes/`, so an unknown type
 * is not automatically an error — but a typo'd one is the most common way a
 * scene silently goes missing, so the validator uses this list to tell the two
 * apart. `test/registry.test.mjs` keeps it in step with the registry.
 */
export const BUILT_IN_SCENE_TYPES = [
  'portal-zoom-reveal',
  'parallax-punch',
  'stacked-reveal',
  'split-shift',
  'title-slate',
  'evidence-board',
];

/** Scene start frames, by accumulation. The config never states them twice. */
export function sceneOffsets(config) {
  const offsets = [];
  let cursor = 0;
  for (const scene of config.scenes) {
    offsets.push(cursor);
    cursor += Math.max(1, Math.round(scene.durationInFrames));
  }
  return offsets;
}

export function totalDurationInFrames(config) {
  return Math.max(
    1,
    config.scenes.reduce((total, scene) => total + Math.max(1, Math.round(scene.durationInFrames)), 0),
  );
}

/**
 * RUNTIME VALIDATION.
 *
 * Returns every problem it can find rather than throwing on the first, because
 * a person fixing a config wants the whole list, not one error per run. Asset
 * EXISTENCE is checked by the validator script — this function has no file
 * system and deliberately keeps none, so it also runs inside the browser
 * bundle.
 */
export function validateEpisodeConfig(config) {
  const problems = [];
  const push = (message) => problems.push(message);

  if (typeof config !== 'object' || config === null) return ['config must be an object'];
  const c = config;

  if (typeof c.id !== 'string' || !c.id.trim()) push('id: required, non-empty string');
  for (const key of ['fps', 'width', 'height']) {
    if (typeof c[key] !== 'number' || !Number.isFinite(c[key]) || c[key] <= 0) {
      push(`${key}: required, positive number`);
    }
  }

  if (typeof c.look !== 'object' || c.look === null) {
    push('look: required object');
  } else {
    const look = c.look;
    if (typeof look.posterizeFps !== 'number' || look.posterizeFps <= 0) {
      push('look.posterizeFps: required, positive number');
    }
    if (typeof look.grade !== 'object' || look.grade === null) {
      push('look.grade: required object');
    } else {
      for (const key of ['saturate', 'contrast', 'sepia', 'brightness']) {
        if (typeof look.grade[key] !== 'number') push(`look.grade.${key}: required number`);
      }
    }
    if (typeof look.film !== 'object' || look.film === null) {
      push('look.film: required object');
    } else {
      for (const key of ['grain', 'grunge', 'scanlines', 'vignette', 'gateWeave']) {
        if (typeof look.film[key] !== 'boolean') push(`look.film.${key}: required boolean`);
      }
    }
  }

  if (!Array.isArray(c.scenes) || c.scenes.length === 0) {
    push('scenes: required, at least one scene');
    return problems;
  }

  const seenIds = new Set();
  c.scenes.forEach((scene, index) => {
    const where = `scenes[${index}]`;
    if (typeof scene !== 'object' || scene === null) {
      push(`${where}: must be an object`);
      return;
    }
    if (typeof scene.id !== 'string' || !scene.id.trim()) push(`${where}.id: required, non-empty string`);
    else if (seenIds.has(scene.id)) push(`${where}.id: duplicate id "${scene.id}"`);
    else seenIds.add(scene.id);

    if (typeof scene.sceneType !== 'string' || !scene.sceneType.trim()) {
      push(`${where}.sceneType: required, non-empty string`);
    }
    if (typeof scene.durationInFrames !== 'number' || !Number.isFinite(scene.durationInFrames) || scene.durationInFrames < 1) {
      push(`${where}.durationInFrames: required, >= 1`);
    }
    if (scene.voText !== undefined && typeof scene.voText !== 'string') {
      push(`${where}.voText: must be a string when present`);
    }
    if (scene.assets !== undefined) {
      if (typeof scene.assets !== 'object' || scene.assets === null || Array.isArray(scene.assets)) {
        push(`${where}.assets: must be an object of role -> file path`);
      } else {
        for (const [role, file] of Object.entries(scene.assets)) {
          if (typeof file !== 'string' || !file.trim()) push(`${where}.assets.${role}: must be a non-empty path`);
          // Episode-relative on purpose: the renderer points Remotion's public
          // directory at the episode folder, so an absolute or climbing path
          // would resolve outside the episode and break the isolation.
          else if (file.startsWith('/') || file.includes('..')) {
            push(`${where}.assets.${role}: must be episode-relative (got "${file}")`);
          }
        }
      }
    }
    for (const [order, text] of (scene.onScreenText ?? []).entries()) {
      const at = `${where}.onScreenText[${order}]`;
      if (typeof text?.text !== 'string' || !text.text.trim()) push(`${at}.text: required, non-empty string`);
      if (typeof text?.atFrame !== 'number' || text.atFrame < 0) push(`${at}.atFrame: required, >= 0`);
      else if (typeof scene.durationInFrames === 'number' && text.atFrame >= scene.durationInFrames) {
        push(`${at}.atFrame: ${text.atFrame} starts after the scene ends (${scene.durationInFrames})`);
      }
    }
  });

  return problems;
}
