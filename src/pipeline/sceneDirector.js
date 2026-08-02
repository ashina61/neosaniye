import { countPatternInterrupts } from './editorialSignals.js';

/**
 * SAHNE YÖNETMENİ — saf, deterministik.
 *
 * Sistem artık yalnızca görüntü seçmiyor; her sahneyi bir editör gözüyle
 * analiz ediyor. Her plan için amaç/duygu/görsel hedef/pattern interrupt/
 * kamera hareketi/retention riski üretir. LLM tahmini YOK — plan verisinden
 * (kaynak, tip, süre, kurgu sınırı, anlatım) hesaplanır.
 *
 * Bu çıktı hem QC'yi (insan gözü simülasyonu) hem oto-eleştiriyi besler.
 */

const TWIST = /\b(but|until|then|instead|suddenly|turns out|except|yet|however|in fact|actually)\b/i;
const QUESTION_RE = /\?$|^(how|why|what|who|where|when|could|did|was|is)\b/i;
const REVEAL_RE = /\b(reveal|turns out|secret|hidden|actually|the truth|in fact|discovered)\b/i;

/** Bir cümlenin dramatik işlevini tahmin eder (film yapısı beat'i). */
function inferPurpose(narration, index, total) {
  const t = String(narration || '');
  if (index === 0 || QUESTION_RE.test(t)) return 'hook/question';
  if (REVEAL_RE.test(t)) return 'reveal';
  if (TWIST.test(t)) return 'twist';
  if (index >= total - 1) return 'payoff';
  if (index >= total - 2) return 'answer';
  return index < total / 2 ? 'mystery/build' : 'evidence';
}

/** Amaca göre hedeflenen izleyici duygusu. */
function inferEmotion(purpose) {
  return {
    'hook/question': 'curiosity',
    'mystery/build': 'intrigue',
    evidence: 'engagement',
    reveal: 'surprise',
    twist: 'shock',
    answer: 'satisfaction',
    payoff: 'resolution',
  }[purpose] || 'engagement';
}

/**
 * Her plan için sahne kartı üretir.
 * @param {object} input QC girdisi (script, itemSeconds, itemTypes, itemSources,
 *   itemRelevance, editPlan). itemScene[i] verilirse plan→sahne eşlemesi kullanılır.
 * @returns {Array<object>} plan başına sahne kartı
 */
export function directScenes(input) {
  const scenes = input.script?.scenes || [];
  const secs = input.itemSeconds || [];
  const types = input.itemTypes || [];
  const sources = input.itemSources || [];
  const rel = input.itemRelevance || [];
  const sceneIdx = input.itemScene || secs.map((_, i) => Math.min(i, scenes.length - 1));
  const { indices } = countPatternInterrupts({ itemSources: sources, itemTypes: types, editPlan: input.editPlan });
  const interruptSet = new Set(indices);
  const total = secs.length;

  let cum = 0;
  return secs.map((d, i) => {
    const start = cum;
    cum += d;
    const scene = scenes[sceneIdx[i]] || {};
    const narration = scene.narration || '';
    const purpose = inferPurpose(narration, sceneIdx[i], scenes.length);
    const isInterrupt = interruptSet.has(i);
    const isStaticLong = (types[i] || 'photo') === 'photo' && d > 4.0 && !isInterrupt;
    const relevance = Number.isFinite(rel[i]) ? rel[i] : null;
    // Retention riski: uzun statik + kesintisiz + alakasız = yüksek.
    let risk = 'low';
    if (isStaticLong || (relevance !== null && relevance < 0.34)) risk = 'high';
    else if (d > 3.6 && !isInterrupt) risk = 'medium';
    return {
      plan: i,
      scene: sceneIdx[i],
      startSeconds: +start.toFixed(1),
      durationSeconds: +d.toFixed(1),
      purpose,
      emotion: inferEmotion(purpose),
      visualGoal: sources[i] === 'gfx' ? 'explain (diagram/steps)' : sources[i] === 'archive' ? 'ground in reality (real artifact)' : sources[i] === 'stock' || types[i] === 'video' ? 'show motion' : 'illustrate',
      narrationGoal: purpose,
      patternInterrupt: isInterrupt,
      cameraMotion: (types[i] || 'photo') === 'video' ? 'live footage' : 'ken-burns',
      source: sources[i] || null,
      relevance,
      retentionRisk: risk,
    };
  });
}
