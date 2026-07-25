/**
 * GÖRSEL AKTİVİTE QC (V2) — videonun "aktif görsel anlatı" mı yoksa "slayt" mı
 * olduğunu ÖLÇER. Efekt planı + sahne kesme zamanlarından bir visualActivityScore
 * ve kalite kapısı ihlalleri üretir.
 */

/**
 * @param {object} o
 * @param {Array}  o.effects  directVideo çıktısı (start/end/type)
 * @param {number[]} o.cutTimes sahne kesme zamanları (absolute)
 * @param {number} o.duration toplam süre (sn)
 * @param {number} o.sceneCount sahne (item) sayısı
 * @param {number} o.basicCameraOnlyScenes yalnızca zoom/pan olan sahne sayısı
 * @param {object} cfg config.motion.visualStorytelling
 */
export function visualActivityReport(o = {}, cfg = {}) {
  const effects = o.effects || [];
  const cuts = (o.cutTimes || []).slice().sort((a, b) => a - b);
  const duration = Math.max(1, Number(o.duration) || 1);
  const sceneCount = Math.max(1, Number(o.sceneCount) || 1);

  // Tüm "görsel değişim" anları: sahne kesmeleri + efekt başlangıçları (0 dahil).
  const changes = Array.from(new Set([0, ...cuts, ...effects.map((e) => +Number(e.start).toFixed(2))]))
    .filter((t) => t >= 0 && t <= duration).sort((a, b) => a - b);

  // En uzun pasif aralık + ortalama değişim aralığı.
  let longestPassive = 0;
  for (let i = 1; i < changes.length; i += 1) longestPassive = Math.max(longestPassive, changes[i] - changes[i - 1]);
  longestPassive = Math.max(longestPassive, duration - (changes.at(-1) || 0));
  const avgInterval = duration / Math.max(1, changes.length - 1 + 1);

  // Semantik vurgu içeren sahne sayısı (efekti olan benzersiz sahne indexleri).
  const scenesWithFx = new Set(effects.map((e) => e._scene).filter((x) => x != null));
  const semanticHighlightScenes = scenesWithFx.size;
  const staticOnlyScenes = Math.max(0, (Number(o.basicCameraOnlyScenes ?? (sceneCount - semanticHighlightScenes))));

  // Aynı efekt arka arkaya (tip bazında ardışık tekrar).
  const repeatedEffectWarnings = [];
  const byType = {};
  for (const e of effects) byType[e.type] = (byType[e.type] || 0) + 1;
  for (const [type, n] of Object.entries(byType)) {
    if (n > 5) repeatedEffectWarnings.push(`${type} used in ${n} scenes`);
  }

  const firstThreeSecondsEvents = effects.filter((e) => Number(e.start) < 3).length;
  const subtitleCollisionWarnings = effects.filter((e) => e._subtitleCollision).map((e) => e.type);
  const passiveRatio = staticOnlyScenes / sceneCount;

  // SKOR (0-100): pasiflik cezası + semantik ödül + ilk-3sn + tekrar cezası.
  let score = 100;
  score -= Math.min(35, Math.max(0, (longestPassive - (cfg.maxPassiveIntervalSeconds || 2.5)) * 12));
  score -= Math.min(25, passiveRatio * 60);
  score -= Math.min(15, repeatedEffectWarnings.length * 8);
  if (firstThreeSecondsEvents < (cfg.minFirstThreeSecondsEvents || 2)) score -= 12;
  score += Math.min(10, semanticHighlightScenes * 1.5);
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    visualActivityScore: score,
    averageVisualChangeInterval: +avgInterval.toFixed(2),
    longestPassiveInterval: +longestPassive.toFixed(2),
    staticOnlyScenes,
    semanticHighlightScenes,
    firstThreeSecondsEvents,
    repeatedEffectWarnings,
    subtitleCollisionWarnings,
    passiveRatio: +passiveRatio.toFixed(2),
  };
}

/**
 * Kalite kapıları — ihlal listesi döner (boş = geçti). Eşikler config'ten.
 * @returns {string[]} ihlaller
 */
export function visualQualityGate(report, cfg = {}) {
  const v = [];
  if (report.visualActivityScore < (cfg.minActivityScore ?? 70)) v.push('VISUAL_ACTIVITY_SCORE_LOW');
  if (report.longestPassiveInterval > (cfg.maxPassiveIntervalSeconds ?? 2.5) + 0.5) v.push('PASSIVE_INTERVAL_TOO_LONG');
  if (report.passiveRatio > (cfg.maxStaticOnlySceneRatio ?? 0.3)) v.push('STATIC_ONLY_RATIO_HIGH');
  if (report.firstThreeSecondsEvents < (cfg.minFirstThreeSecondsEvents ?? 2)) v.push('FIRST_3S_NO_MOTION');
  if (report.subtitleCollisionWarnings.length) v.push('SUBTITLE_COLLISION');
  if (report.repeatedEffectWarnings.length) v.push('EFFECT_REPETITION');
  return v;
}
