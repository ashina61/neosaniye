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

/**
 * Ölçülen TTS süresi kapısı.
 *
 * SESSİZ HATA (V3'te bulundu): imza yalnızca `minSeconds`/`maxSeconds`
 * okuyordu, ama tek çağıran `config.content` nesnesini veriyor ve orada alanlar
 * `minDurationSeconds`/`maxDurationSeconds` adıyla duruyor. Yani destructuring
 * daima varsayılanlara (35/58) düşüyordu: CONTENT_MIN_SECONDS ve
 * CONTENT_MAX_SECONDS ortam değişkenlerinin HİÇBİR ETKİSİ YOKTU ve 56.9
 * saniyelik video "geçerli süre" sayılıyordu. Hata sessizdi çünkü varsayılanlar
 * makul görünüyor ve kapı çalışıyormuş gibi duruyordu.
 *
 * Artık iki adlandırma da kabul edilir; config'in kendi adları önce gelir.
 *
 * @param {number} duration ölçülen saniye
 * @param {object} [policy] config.content ya da {minSeconds,maxSeconds}
 */
export function evaluateMeasuredDuration(duration, policy = {}) {
  const minSeconds = policy.minDurationSeconds ?? policy.minSeconds ?? 35;
  const maxSeconds = policy.maxDurationSeconds ?? policy.maxSeconds ?? 58;
  const seconds = Number(duration) || 0;
  if (seconds < minSeconds) return { ok: false, seconds, code: 'AUDIO_TOO_SHORT', minSeconds, maxSeconds };
  if (seconds > maxSeconds) return { ok: false, seconds, code: 'AUDIO_TOO_LONG', minSeconds, maxSeconds };
  return { ok: true, seconds, code: null, minSeconds, maxSeconds };
}
