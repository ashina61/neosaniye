import { config } from '../config.js';

/**
 * CTA SEÇİCİ — deterministik (seed'li) editoryal karar.
 *
 * Aynı videoId/seed + aynı config → aynı seçim (tekrar render tutarlı).
 * CTA gereksizse {applied:false, reason} döner. Kurallar config.motion.cta'dan.
 */

// Tip → şablon eşlemesi (6 özgün şablon). save → follow-compact görseli, KAYDET etiketi.
const TYPE_TEMPLATES = {
  subscribe: ['neo_subscribe_minimal', 'neo_subscribe_pulse'],
  like: ['neo_like_pop'],
  bell: ['neo_bell_ring'],
  comment: ['neo_comment_slide'],
  follow: ['neo_follow_compact'],
  save: ['neo_follow_compact'],
};

/** 32-bit string hash (deterministik seed üretimi). */
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — deterministik PRNG. */
function mulberry32(a) {
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

/**
 * @param {object} input
 * @param {string} input.seed  videoId veya içerik seed'i (deterministik)
 * @param {number} input.durationSec
 * @param {number} [input.outroStartSec] outro başlangıcı (varsa)
 * @param {string[]} [input.recentCtaTypes] son videolarda kullanılan tipler (anti-tekrar)
 * @param {object} [cfg=config.motion.cta]
 * @returns {{applied:boolean, reason:string, type?:string, templateId?:string,
 *   startSec?:number, durationSec?:number, position?:string, seed:string}}
 */
export function selectCta(input, cfg = config.motion.cta) {
  const seed = String(input.seed || 'video');
  const base = { applied: false, seed };
  if (!config.motion.enabled || !cfg.enabled || cfg.mode === 'off') {
    return { ...base, reason: 'disabled' };
  }
  const duration = Number(input.durationSec) || 0;
  const compactAlways = cfg.mode === 'always' && duration >= (cfg.alwaysMinVideoDurationSec || 10) && duration < cfg.minVideoDurationSec;
  if (duration < cfg.minVideoDurationSec && !compactAlways) {
    return { ...base, reason: 'video-too-short' };
  }

  const rng = cfg.seededRandom ? mulberry32(hashSeed(seed)) : Math.random;
  // Olasılık kapısı (editorial modda). always modda her uygun videoya.
  if (cfg.mode === 'editorial' && rng() > cfg.probability) {
    return { ...base, reason: 'probability-skip' };
  }

  // Tip seçimi — mümkünse son kullanılanı tekrar etme (anti-tekrar).
  const allowed = (cfg.allowedTypes || []).filter((t) => TYPE_TEMPLATES[t]);
  if (!allowed.length) return { ...base, reason: 'editorial-skip' };
  const recent = new Set((input.recentCtaTypes || []).slice(0, 1));
  const fresh = allowed.filter((t) => !recent.has(t));
  const type = pick(rng, fresh.length ? fresh : allowed);
  const templateId = pick(rng, TYPE_TEMPLATES[type]);

  // Süre + başlangıç (seed'li). İlk earliestStart sn ve son latestEndBuffer sn yasak.
  const [normalMin, normalMax] = cfg.durationRangeSec;
  // A 10–15s video has no room for the normal 1.8–2.8s card after its hook.
  // In explicit always mode use a compact 1.2–1.6s card, positioned so its
  // ending remains 2–3 seconds before the video end.
  const [dMin, dMax] = compactAlways ? [1.2, 1.6] : [normalMin, normalMax];
  const durSec = +(dMin + rng() * (dMax - dMin)).toFixed(2);
  const earliest = compactAlways ? 5 : Math.max(cfg.earliestStartSec, 5); // ilk 5sn kesin yasak
  const latestStart = duration - cfg.latestEndBufferSec - durSec;
  if (latestStart <= earliest) {
    return { ...base, reason: 'timeline-conflict' };
  }
  let startSec = compactAlways
    ? +(Math.max(earliest, duration - cfg.latestEndBufferSec - durSec - 0.4)).toFixed(2)
    : +(earliest + rng() * (latestStart - earliest)).toFixed(2);

  // Outro çakışması: CTA penceresi outro'ya taşarsa geri çek; sığmazsa atla.
  if (cfg.avoidOutro && Number.isFinite(input.outroStartSec)) {
    const outroStart = input.outroStartSec;
    if (startSec + durSec > outroStart) {
      startSec = +(outroStart - durSec - 0.3).toFixed(2);
      if (startSec < earliest) return { ...base, reason: 'timeline-conflict' };
    }
  }

  return {
    applied: true,
    reason: 'editorial-rule',
    type,
    templateId,
    startSec,
    durationSec: durSec,
    position: cfg.position,
    seed,
  };
}
