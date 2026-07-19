import { directScenes } from './sceneDirector.js';
import { extractKeywords } from '../media/semanticRelevance.js';

/**
 * RETENTION EDITÖRÜ — video sonrası ACIMASIZ oto-eleştiri + İNSAN GÖZÜ
 * SİMÜLASYONU. Saf, deterministik.
 *
 * "Bu sahneyi insanlar neden izlemeye devam etsin?" sorusuna sayısal cevap:
 * en zayıf/en güçlü sahne, en sıkıcı an, görsel/anlatım tekrarı, en iyi
 * iyileştirme. Ayrıca her plan için dikkat tahmini (sıkılır / kaydırır /
 * şaşırır / yeniden dikkat kesilir). LLM YOK — plan + kurgu + metrik verisi.
 */

/** Sahne başına dikkat tahmini (insan gözü heuristiği). */
export function attentionForecast(cards, { twistScenes = new Set() } = {}) {
  return cards.map((c) => {
    // Sıkılma: uzun + statik + pattern interrupt yok + düşük alaka.
    let boredom = 0;
    if (c.durationSeconds > 4.0) boredom += 0.4;
    if (c.durationSeconds > 5.5) boredom += 0.3;
    if (!c.patternInterrupt) boredom += 0.2;
    if (c.cameraMotion === 'ken-burns') boredom += 0.1;
    if (c.relevance !== null && c.relevance < 0.34) boredom += 0.3;
    boredom = Math.min(1, +boredom.toFixed(2));
    // Kaydırma riski: sıkılma yüksek + akışın erken/orta bölümünde (ilk 12s kritik).
    const swipeRisk = +Math.min(1, boredom + (c.startSeconds < 12 ? 0.15 : 0)).toFixed(2);
    // Şaşırma: reveal/twist amaçlı sahne ya da anlatımında dönüş kelimesi.
    const surprise = c.purpose === 'reveal' || c.purpose === 'twist' || twistScenes.has(c.scene);
    // Yeniden dikkat: pattern interrupt (yeni kaynak/diagram/harekete geçiş).
    const reengage = c.patternInterrupt;
    return {
      plan: c.plan,
      atSeconds: c.startSeconds,
      purpose: c.purpose,
      boredomRisk: boredom,
      swipeRisk,
      surpriseLikely: surprise,
      reengage,
      verdict: swipeRisk >= 0.7 ? 'HIGH swipe risk' : swipeRisk >= 0.45 ? 'attention dips' : surprise ? 'hooks attention' : 'holds',
    };
  });
}

/**
 * Tam editör eleştirisi. r = evaluateRetention çıktısı, input = QC girdisi.
 * @returns {{editorCritique:object, attentionForecast:Array}}
 */
export function buildEditorCritique(input, r) {
  const cards = directScenes(input);
  const scenes = input.script?.scenes || [];
  const twistScenes = new Set(
    scenes.map((s, i) => (/\b(but|until|then|instead|suddenly|turns out|except|yet|however|in fact|actually)\b/i.test(s.narration || '') ? i : -1)).filter((i) => i >= 0),
  );
  const forecast = attentionForecast(cards, { twistScenes });

  // En sıkıcı an: en yüksek boredom (uzun statik, kesintisiz).
  const boring = forecast.reduce((a, b) => (b.boredomRisk > (a?.boredomRisk ?? -1) ? b : a), null);
  // En zayıf / en güçlü sahne: risk + alaka + kesinti.
  const scored = cards.map((c) => ({
    plan: c.plan,
    scene: c.scene,
    weakness: (c.retentionRisk === 'high' ? 2 : c.retentionRisk === 'medium' ? 1 : 0) +
      (c.patternInterrupt ? 0 : 1) + (c.relevance !== null && c.relevance < 0.34 ? 2 : 0),
  }));
  const weakest = scored.reduce((a, b) => (b.weakness > a.weakness ? b : a), scored[0]);
  const strongest = scored.reduce((a, b) => (b.weakness < a.weakness ? b : a), scored[0]);

  // Görsel tekrar: en uzun aynı-kaynak dizisi + AI oranı.
  const sources = input.itemSources || [];
  let maxRun = 0;
  let run = 0;
  for (let i = 0; i < sources.length; i += 1) {
    run = i > 0 && sources[i] === sources[i - 1] ? run + 1 : 1;
    maxRun = Math.max(maxRun, run);
  }
  const aiShare = sources.length ? +(sources.filter((s) => s === 'ai').length / sources.length).toFixed(2) : 0;
  const distinctSources = new Set(sources).size;

  // Anlatım tekrarı: sahneler arası tekrarlanan anlamlı kelimeler.
  const allKw = scenes.flatMap((s) => extractKeywords(s.narration));
  const freq = {};
  for (const w of allKw) freq[w] = (freq[w] || 0) + 1;
  const repeatedWords = Object.entries(freq).filter(([, n]) => n >= 3).map(([w]) => w).slice(0, 6);

  const bestImprovement = (r.recommendedFixes && r.recommendedFixes[0]) || 'Belirgin bir zayıflık yok — çeşitliliği ve tempoyu koru.';

  const editorCritique = {
    overallRetentionRisk: r.score >= 90 ? 'low' : r.score >= 80 ? 'medium' : 'high',
    weakestScene: weakest ? { plan: weakest.plan, scene: weakest.scene, narration: scenes[weakest.scene]?.narration || null } : null,
    strongestScene: strongest ? { plan: strongest.plan, scene: strongest.scene, narration: scenes[strongest.scene]?.narration || null } : null,
    mostBoringMoment: boring ? { atSeconds: boring.atSeconds, boredomRisk: boring.boredomRisk, verdict: boring.verdict } : null,
    visualRepetition: { longestSameSourceRun: maxRun, aiShare, distinctSources },
    narrationRepetition: { repeatedWords, hasRepetition: repeatedWords.length > 0 },
    swipeRiskMoments: forecast.filter((f) => f.swipeRisk >= 0.7).map((f) => f.atSeconds),
    bestImprovement,
  };
  return { editorCritique, attentionForecast: forecast, sceneCards: cards };
}
