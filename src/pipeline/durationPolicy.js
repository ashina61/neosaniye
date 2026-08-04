const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

/** Count speakable words rather than whitespace tokens. */
export function narrationWordCount(scenes = []) {
  return scenes.reduce((total, scene) => total + (String(scene?.narration || '').match(WORD_RE) || []).length, 0);
}

/**
 * Editorial runtime policy. Measured TTS duration remains the final authority.
 *
 * ============ THE WORD WINDOW MOVES WITH THE SPEAKING RATE ============
 *
 * The window (105–135 words) silently assumed a normal delivery. It is not:
 * `ttsRateForTopic` deliberately SLOWS explainer topics down for clarity, and a
 * script that is 130 words at 0% is the same script at −7% — only six seconds
 * longer. A live run hit exactly that: the word gate passed, the measured audio
 * came back at 61.0s against a 58s ceiling, and the whole production died in
 * phase two having produced nothing.
 *
 * So the window scales with the rate the topic will actually be read at. Slower
 * delivery means fewer words are allowed, which is the same runtime.
 *
 * @param {Array} scenes
 * @param {object} [options]
 * @param {number} [options.rateFactor] 1 = normal, 0.93 = 7% slower, 1.1 = faster
 */
export function evaluateNarrationLength(scenes = [], { minWords = 105, maxWords = 135, rateFactor = 1 } = {}) {
  const factor = Number.isFinite(Number(rateFactor)) && Number(rateFactor) > 0 ? Number(rateFactor) : 1;
  const adjustedMin = Math.round(minWords * factor);
  const adjustedMax = Math.round(maxWords * factor);
  const words = narrationWordCount(scenes);
  if (words < adjustedMin) {
    return {ok: false, words, code: 'NARRATION_TOO_SHORT', direction: 'expand', minWords: adjustedMin, maxWords: adjustedMax};
  }
  if (words > adjustedMax) {
    return {ok: false, words, code: 'NARRATION_TOO_LONG', direction: 'shorten', minWords: adjustedMin, maxWords: adjustedMax};
  }
  return {ok: true, words, code: null, direction: null, minWords: adjustedMin, maxWords: adjustedMax};
}

/** "+18%" / "-7%" → 1.18 / 0.93. The rate the topic will actually be read at. */
export function rateToFactor(rate) {
  const pct = Number.parseInt(String(rate ?? '').replace('%', ''), 10);
  if (!Number.isFinite(pct)) return 1;
  return 1 + pct / 100;
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
