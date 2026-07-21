const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

/** Count speakable words rather than whitespace tokens. */
export function narrationWordCount(scenes = []) {
  return scenes.reduce((total, scene) => total + (String(scene?.narration || '').match(WORD_RE) || []).length, 0);
}

/** Editorial runtime policy. Measured TTS duration remains the final authority. */
export function evaluateNarrationLength(scenes = [], { minWords = 105, maxWords = 135 } = {}) {
  const words = narrationWordCount(scenes);
  if (words < minWords) return { ok: false, words, code: 'NARRATION_TOO_SHORT', direction: 'expand' };
  if (words > maxWords) return { ok: false, words, code: 'NARRATION_TOO_LONG', direction: 'shorten' };
  return { ok: true, words, code: null, direction: null };
}

export function evaluateMeasuredDuration(duration, { minSeconds = 35, maxSeconds = 58 } = {}) {
  const seconds = Number(duration) || 0;
  if (seconds < minSeconds) return { ok: false, seconds, code: 'AUDIO_TOO_SHORT' };
  if (seconds > maxSeconds) return { ok: false, seconds, code: 'AUDIO_TOO_LONG' };
  return { ok: true, seconds, code: null };
}
