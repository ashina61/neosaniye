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
  'composite',
];

/**
 * THE DRAWN MOTIFS.
 *
 * The layer that acts out the sentence — gold arriving, a route being walked, a
 * count going up. A scene asks for one by name in `params.motif`, and a name
 * that is not on this list is a typo that would otherwise draw NOTHING and say
 * nothing about it, which is the same failure as an unknown scene type.
 */
export const MOTIF_KINDS = ['coins', 'rise', 'route', 'embers', 'rays', 'tally'];

/**
 * OPTIONAL ASSET ROLES.
 *
 * A role written `?character` means "use this if it is on disk". The validator
 * does not fail on it and the template simply never receives it.
 *
 * This exists because of one specific and repeated failure: a scene that wants
 * a figure in it is worthless without one, but making the figure REQUIRED means
 * that the day the generator hands back an empty room instead, the whole reel
 * stops rendering. The choice was between a shot that could be great and a reel
 * that always works — and it turns out not to be a choice. The scene degrades:
 * with the cut-out it is a parallax punch, without it a slow push on a plate,
 * and either way the episode renders.
 */
/**
 * WHAT A PROP CAN BE — objects the engine draws instead of fetching.
 *
 *   plaque     a museum caption in engraved brass. The reference kit opens on
 *              one, under the framed photograph.
 *   newspaper  a front page: masthead, headline, rules, columns. Three of them
 *              landing one at a time is the reference's third scene.
 *   card       an index card with a heading and a line or two, optionally
 *              rubber-stamped.
 *   print      a photographic print's white border, with a caption below it.
 *   wire       a hand-drawn wireframe that draws itself on — the diamonds the
 *              reference frames its props inside.
 *   beam       a shaft of light with a soft edge, for a window or a lamp.
 */
export const PROP_KINDS = ['plaque', 'newspaper', 'card', 'print', 'wire', 'beam'];

export const OPTIONAL_ROLE = '?';

/**
 * role -> file, with `?` stripped and absent optionals left out.
 *
 * @param {Record<string, string>} [assets]
 * @param {(file: string) => boolean} [isMissing]
 * @returns {Record<string, string>}
 */
export function resolveAssets(assets, isMissing) {
  const out = {};
  for (const [role, file] of Object.entries(assets ?? {})) {
    const optional = role.startsWith(OPTIONAL_ROLE);
    const name = optional ? role.slice(1) : role;
    if (optional && isMissing?.(file)) continue;
    out[name] = file;
  }
  return out;
}

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

  if (c.audio !== undefined) {
    if (typeof c.audio !== 'string' || !c.audio.trim()) push('audio: must be a non-empty path when present');
    // Same isolation rule as every asset: the public directory IS the episode
    // folder, so a climbing path resolves outside it.
    else if (c.audio.startsWith('/') || c.audio.includes('..')) {
      push(`audio: must be episode-relative (got "${c.audio}")`);
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
    // A motif that does not exist draws nothing and reports nothing, which is
    // exactly how a shot ends up being a still picture with a caption on it.
    const motif = scene.params?.motif;
    if (motif !== undefined && motif !== '' && !MOTIF_KINDS.includes(motif)) {
      push(`${where}.params.motif: "${motif}" is not one of ${MOTIF_KINDS.join(', ')}`);
    }
    if (scene.transition !== undefined) {
      const kinds = ['cut', 'slam', 'slip', 'flare', 'rack', 'blinds'];
      const kind = scene.transition?.kind;
      if (typeof scene.transition !== 'object' || scene.transition === null) {
        push(`${where}.transition: must be an object`);
      } else if (kind !== undefined && !kinds.includes(kind)) {
        push(`${where}.transition.kind: "${kind}" is not one of ${kinds.join(', ')}`);
      }
    }
    if (scene.layers !== undefined) {
      if (!Array.isArray(scene.layers)) push(`${where}.layers: must be an array`);
      else {
        scene.layers.forEach((layer, i) => {
          const at = `${where}.layers[${i}]`;
          if (typeof layer !== 'object' || layer === null) return push(`${at}: must be an object`);
          if (layer.role !== undefined && typeof layer.role !== 'string') push(`${at}.role: must be a string`);
          // Depth is the whole parallax law; a value outside 0..1 is a layer
          // that moves the wrong way relative to everything around it.
          if (layer.depth !== undefined && (typeof layer.depth !== 'number' || layer.depth < 0 || layer.depth > 1)) {
            push(`${at}.depth: must be a number between 0 and 1`);
          }
          if (layer.flicker !== undefined) {
            // Hold keyframes are [on, off] pairs. A bare list of numbers reads
            // as valid, draws nothing, and says nothing about it.
            const bad =
              !Array.isArray(layer.flicker) ||
              layer.flicker.some(
                (span) =>
                  !Array.isArray(span) || span.length !== 2 || span.some((n) => typeof n !== 'number') || span[1] <= span[0],
              );
            if (bad) push(`${at}.flicker: must be [on, off] frame pairs with off greater than on`);
          }
          if (layer.role !== undefined && !(scene.assets ?? {})[layer.role] &&
              !(scene.assets ?? {})[`?${layer.role}`]) {
            push(`${at}.role: "${layer.role}" is not a role in this scene's assets`);
          }
        });
      }
    }
    /**
     * PROPS — the things in the room that are DRAWN rather than photographed.
     *
     * Law 2 of this repo: people and places are photographs, everything else is
     * drawn. The reference reel's twenty assets are about four backdrops and
     * sixteen other things, and most of those sixteen are graphics — a museum
     * plaque, three newspaper front pages, hand-drawn wireframe diamonds, a
     * frame, a beam of light. This pipeline spent a fortnight searching a photo
     * library for them while the code to draw every one already sat in
     * `engine/draw/`, wired into nothing.
     *
     * A prop is a layer that needs no file. It takes the same depth and the
     * same anchor as a plate, because it is an object standing in the same
     * room — unlike a motif, which is pinned to the frame because it is a
     * graphic ABOUT the sentence rather than a thing inside it.
     */
    /**
     * AN ASSET PATH STAYS INSIDE THE EPISODE.
     *
     * The episode folder is the render's public directory. A path that climbs
     * out of it does not fail, it RESOLVES — and pulls whatever it lands on
     * into the bundle. `audio` has been guarded against this since the
     * beginning and the asset roles never were, which is the kind of gap that
     * only shows up when somebody writes a brief by hand.
     */
    for (const [role, file] of Object.entries(scene.assets ?? {})) {
      if (typeof file !== 'string' || !file.trim()) {
        push(`${where}.assets["${role}"]: must be a non-empty path`);
      } else if (file.startsWith('/') || file.includes('..')) {
        push(`${where}.assets["${role}"]: must stay inside the episode (got "${file}")`);
      }
    }

    if (scene.props !== undefined) {
      if (!Array.isArray(scene.props)) push(`${where}.props: must be an array`);
      else {
        scene.props.forEach((prop, i) => {
          const at = `${where}.props[${i}]`;
          if (typeof prop !== 'object' || prop === null) return push(`${at}: must be an object`);
          // A kind nobody draws is the same failure as an unknown scene type,
          // and law 13 says it is never skipped in silence.
          if (!PROP_KINDS.includes(prop.kind)) {
            push(`${at}.kind: "${prop.kind}" is not one of ${PROP_KINDS.join(', ')}`);
          }
          if (prop.depth !== undefined && (typeof prop.depth !== 'number' || prop.depth < 0 || prop.depth > 1)) {
            push(`${at}.depth: must be a number between 0 and 1`);
          }
          if (prop.enter !== undefined && !['left', 'right', 'top', 'bottom'].includes(prop.enter)) {
            push(`${at}.enter: must be left, right, top or bottom`);
          }
        });
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
