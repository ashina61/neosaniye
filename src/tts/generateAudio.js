import { mkdir } from 'node:fs/promises';
import { config } from '../config.js';
import { synthesizeEdge } from './edgeTts.js';
import { synthesizePiper } from './piper.js';
import { alignWords } from './align.js';

export { parseSrt } from './edgeTts.js';

/**
 * Faz 2 — Ses (TTS) orkestratörü.
 *
 * Motor stratejisi (config.tts.engine):
 *   - 'auto'  : önce edge-tts; başarısız olursa (403/ağ/kurulu değil) Piper'a düşer.
 *   - 'edge'  : sadece edge-tts.
 *   - 'piper' : sadece Piper (çevrimdışı).
 *
 * Kelime zamanlaması:
 *   - edge-tts kendi WordBoundary altyazısını verir (whisper gerekmez).
 *   - Piper vermez; bu durumda faster-whisper ile hizalama yapılır.
 */

/** Bir script nesnesini seslendirilecek düz metne çevirir. */
export function scriptToNarration(script) {
  return [script.hook, script.body, script.cta]
    .filter(Boolean)
    .map((s) => s.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {object} script - generateScript çıktısı (en az {hook,body,cta}).
 * @param {object} [opts]
 * @param {string} [opts.outDir='output']
 * @param {string} [opts.basename] - Dosya adı kökü (varsayılan normalizedTopic).
 * @param {'auto'|'edge'|'piper'} [opts.engine] - config.tts.engine'i geçersiz kılar.
 * @returns {Promise<{engine:string, audioPath:string, subtitlePath:(string|null), wordTimings:Array, text:string, durationEstimate:number}>}
 */
export async function generateAudio(script, opts = {}) {
  const {
    outDir = 'output',
    basename = script.normalizedTopic || 'script',
    engine = config.tts.engine,
  } = opts;

  await mkdir(outDir, { recursive: true });
  const text = scriptToNarration(script);
  const base = { outDir, basename };

  let result;

  if (engine === 'edge') {
    result = await synthesizeEdge(text, base);
  } else if (engine === 'piper') {
    result = await synthesizePiper(text, base);
  } else {
    // auto: edge-tts dene, olmazsa Piper'a düş.
    try {
      result = await synthesizeEdge(text, base);
    } catch (edgeErr) {
      console.warn(
        `[tts] edge-tts başarısız, Piper'a düşülüyor: ${
          (edgeErr.stderr || edgeErr.message || '').split('\n')[0]
        }`,
      );
      try {
        result = await synthesizePiper(text, base);
      } catch (piperErr) {
        throw new Error(
          `Her iki TTS motoru da başarısız.\n- edge-tts: ${
            edgeErr.stderr || edgeErr.message
          }\n- piper: ${piperErr.stderr || piperErr.message}`,
        );
      }
    }
  }

  // Piper yolunda kelime zamanlaması yok -> whisper ile çıkar.
  if (!result.wordTimings) {
    result.wordTimings = await alignWords(result.audioPath).catch((err) => {
      console.warn(
        `[tts] whisper hizalaması başarısız (altyazı zamanlaması boş): ${err.message}`,
      );
      return [];
    });
  }

  const durationEstimate = result.wordTimings.length
    ? result.wordTimings[result.wordTimings.length - 1].end
    : 0;

  return { ...result, text, durationEstimate };
}
