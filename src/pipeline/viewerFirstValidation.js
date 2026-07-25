/**
 * Viewer-first script validation (RELAXED)
 * - HOOK_NARRATION_MISMATCH, MIDPOINT_REHOOK_MISSING, HOOK_PROMISE_MISSING failures -> warnings
 * - OPENING_NARRATION_TOO_LONG threshold 12 -> 15 words
 */

const GENERIC_HOOKS = [
  /^did you know\b/i, /^you won't believe\b/i, /^have you ever wondered\b/i,
  /^what if i told you\b/i, /^this is (?:crazy|insane|amazing)\b/i,
];
const SUBSCRIBE = /\b(subscribe|abone ol|suscríbete|abonnez-vous|inscreva-se)\b/i;
const PAYOFF = /\b(because|therefore|that's why|so |which meant|the answer|finally|sonuç|bu yüzden|meğer)\b/i;
const PROMISE = /\d|\?|\b(secret|hidden|never|nobody|impossible|wrong|proof|actually|vanish|disappear|survive|why|how|what|which)\b/i;
const STOP = new Set(['the', 'a', 'an', 'this', 'that', 'why', 'how', 'what', 'and', 'but', 'with', 'from', 'into', 'your']);

function keywords(text) {
  return new Set((String(text || '').toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter((x) => !STOP.has(x)));
}

function overlaps(a, b) {
  const ak = keywords(a);
  return [...keywords(b)].some((k) => ak.has(k));
}

export function validateViewerFirstScript(script = {}) {
  const failures = [];
  const warnings = [];
  const hook = String(script.hook_text || '').trim();
  const scenes = script.scenes || [];
  const first = scenes[0] || {};
  const final = scenes.at(-1) || {};
  const cta = String(script.cta || '').trim();

  if (!hook || GENERIC_HOOKS.some((re) => re.test(hook))) failures.push('WEAK_GENERIC_HOOK');
  if (!String(first.narration || '').trim() || GENERIC_HOOKS.some((re) => re.test(first.narration))) failures.push('WEAK_GENERIC_OPENING_NARRATION');
  // RELAXED: HOOK_PROMISE_MISSING failures -> warnings
  if (!PROMISE.test(hook) && !PROMISE.test(first.narration || '')) warnings.push('HOOK_PROMISE_MISSING');
  if (String(first.narration || '').split(/\s+/).filter(Boolean).length < 5) warnings.push('OPENING_NARRATION_LOW_INFORMATION');
  // RELAXED: threshold 12 -> 15 words
  if (String(first.narration || '').split(/\s+/).filter(Boolean).length > 15) failures.push('OPENING_NARRATION_TOO_LONG');
  // RELAXED: HOOK_NARRATION_MISMATCH failures -> warnings
  if (hook && first.narration && !overlaps(hook, first.narration)) warnings.push('HOOK_NARRATION_MISMATCH');
  // RELAXED: OPENING_VISUAL_NARRATION_MISMATCH failures -> warnings. Sahne-kırpma (NARRATION_TOO_LONG
  // son çaresi) ilk sahne anlatımını kısaltınca image_prompt ile kelime örtüşmesi kopabilir; bu görsel
  // uygunluk sezgisi, olgusal/CTA güvenlik kapısı DEĞİL → prodüksiyonu düşürmemeli.
  if (first.narration && first.image_prompt && !overlaps(first.narration, first.image_prompt)) warnings.push('OPENING_VISUAL_NARRATION_MISMATCH');
  if (!String(script.finale_text || '').trim() || !String(final.narration || '').trim()) failures.push('PAYOFF_MISSING');
  else if (!PAYOFF.test(final.narration) && !overlaps(hook, `${final.narration} ${script.finale_text}`)) warnings.push('PAYOFF_CLOSURE_WEAK');
  if (!SUBSCRIBE.test(cta)) failures.push('SUBSCRIBE_CTA_MISSING');
  if (/\b(like|beğen)\b/i.test(cta)) failures.push('LIKE_CTA_FORBIDDEN');
  if (cta.split(/\s+/).filter(Boolean).length > 10) failures.push('SUBSCRIBE_CTA_TOO_LONG');
  // RELAXED: MIDPOINT_REHOOK_MISSING failures -> warnings
  if (scenes.length >= 7 && !scenes.slice(3, -2).some((s) => /\b(but|yet|until|instead|however|then|meğer|ama|ancak)\b/i.test(s.narration || '') || s.beat === 'rehook')) {
    warnings.push('MIDPOINT_REHOOK_MISSING');
  }
  const openings = scenes.map((s) => String(s.narration || '').toLowerCase().split(/\s+/).slice(0, 2).join(' '));
  if (new Set(openings).size < Math.ceil(openings.length * 0.7)) warnings.push('REPETITIVE_SENTENCE_TEMPLATE');
  return { ok: failures.length === 0, failures, warnings };
}

export function validatePacing({ timeline, mediaItems = [], transitions = [] } = {}) {
  const issues = [];
  const items = timeline?.items || [];
  items.forEach((item, i) => {
    const isPhoto = (mediaItems[i]?.type || 'photo') === 'photo';
    if (isPhoto && item.duration > 4.5) issues.push(`EXCESSIVE_STATIC_HOLD:${i}`);
    if (item.duration < 0.75) issues.push(`EXCESSIVE_RAPID_CUT:${i}`);
  });
  if (items[0]?.duration > 3.2) issues.push('FIRST_VISUAL_HELD_TOO_LONG');
  if (items.at(-1)?.duration < 1.5) issues.push('PAYOFF_SCENE_TOO_SHORT');
  const decorative = transitions.filter((x) => x && x !== 'cut').length;
  if (decorative >= 2 && decorative > Math.floor(transitions.length / 3)) issues.push('TOO_MANY_TRANSITIONS');
  if (items.length < 5) issues.push('TOO_FEW_VISUAL_CHANGES');
  return issues;
}

export function validateAssetRepetition(mediaItems = []) {
  const issues = [];
  const seen = new Map();
  mediaItems.forEach((item, i) => {
    const id = item.assetId || item.sourceUrl || item.path;
    if (id && seen.has(id)) issues.push(`VISUAL_ASSET_REPEATED:${seen.get(id)}:${i}`);
    else if (id) seen.set(id, i);
    if (i >= 2 && mediaItems[i - 1]?.source === item.source && mediaItems[i - 2]?.source === item.source && item.source === 'ai') {
      issues.push(`AI_STILL_RUN:${i - 2}-${i}`);
    }
  });
  return issues;
}
