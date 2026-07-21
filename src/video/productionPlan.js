export const VARIANT_PROFILES = Object.freeze({
  'fast-cut': { transitionEvery: 6, musicSeedSuffix: 'fast', swapAbScenes: true },
  balanced: { transitionEvery: 4, musicSeedSuffix: 'balanced', swapAbScenes: false },
  cinematic: { transitionEvery: 2, musicSeedSuffix: 'cinematic', swapAbScenes: true },
});

export function orderVariantMedia(items = [], variant = 'balanced') {
  const profile = VARIANT_PROFILES[variant] || VARIANT_PROFILES.balanced;
  const grouped = new Map();
  items.forEach((item, index) => {
    const scene = Number.isInteger(item.scene) ? item.scene : index;
    if (!grouped.has(scene)) grouped.set(scene, []);
    grouped.get(scene).push(item);
  });
  const out = [];
  for (const [scene, sceneItems] of grouped) {
    const ordered = profile.swapAbScenes && scene % 2 === 1 && sceneItems.length > 1
      ? [sceneItems[1], sceneItems[0], ...sceneItems.slice(2)]
      : sceneItems;
    out.push(...ordered);
  }
  return out;
}

export function buildVariantEditPlan(items = [], variant = 'balanced') {
  const profile = VARIANT_PROFILES[variant] || VARIANT_PROFILES.balanced;
  const accents = ['shimmer', 'riser', 'whoosh'];
  let accent = 0;
  const boundaries = items.slice(1).map((item, index) => {
    const boundaryNumber = index + 1;
    const sameScene = item.scene === items[index]?.scene;
    if (sameScene) return { transition: 'cut', sfx: accents[accent++ % accents.length] };
    if (boundaryNumber % profile.transitionEvery === 0) {
      return { transition: variant === 'cinematic' ? 'fade' : 'slideleft', sfx: accents[accent++ % accents.length] };
    }
    return { transition: 'cut', sfx: accent < 2 ? accents[accent++] : 'none' };
  });
  return { boundaries, subscribeScene: Math.max(0, items.length - 1), musicMood: variant === 'cinematic' ? 'cinematic' : null };
}

export function inspectProductionPlan(items = [], timeline = null) {
  const moving = items.filter((x) => x.type === 'video').length;
  let staticRun = 0;
  let maxStaticRun = 0;
  for (const item of items) {
    staticRun = item.type === 'video' ? 0 : staticRun + 1;
    maxStaticRun = Math.max(maxStaticRun, staticRun);
  }
  const counts = new Map();
  items.forEach((x) => counts.set(x.scene, (counts.get(x.scene) || 0) + 1));
  const unsplitLongScenes = (timeline?.scenes || [])
    .filter((scene) => scene.duration > 2.5 && (counts.get(scene.scene) || 0) < 2)
    .map((scene) => scene.scene);
  const failures = [];
  if (moving < 3) failures.push('MOVING_SEGMENTS_LT_3');
  if (maxStaticRun > 2) failures.push('STATIC_SCENE_RUN_GT_2');
  if (unsplitLongScenes.length) failures.push('LONG_SCENE_NOT_AB_SPLIT');
  return { ok: failures.length === 0, movingSegments: moving, maxConsecutiveStatic: maxStaticRun, unsplitLongScenes, failures };
}
