import { mkdir } from 'node:fs/promises';
import { config } from '../config.js';
import { synthesizeEdge } from './edgeTts.js';
import { synthesizePiper } from './piper.js';
import { alignWords } from './align.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { prepareNarrationForTts, validateNarrationPhrasing } from './phrasing.js';

const run = promisify(execFile);

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

/** Anlatı script'inin seslendirilecek metin parçalarını sırayla döndürür.
 *  Yalnızca sahne anlatımları seslendirilir — cta (abone ol) SESLENDİRİLMEZ;
 *  o yalnızca açıklama metninde ve görsel abone pilinde kullanılır. */
export function scriptSegments(script) {
  if (Array.isArray(script.scenes) && script.scenes.length) {
    return script.scenes.map((s) => (s.narration || '').trim()).filter(Boolean);
  }
  return [script.hook, script.body].filter(Boolean).map((s) => s.trim());
}

/** Bir script nesnesini seslendirilecek tek düz metne çevirir. */
export function scriptToNarration(script) {
  return scriptSegments(script).join(' ').replace(/\s+/g, ' ').trim();
}

/** Konu tipine göre TTS taban hızını ayarlar.
 *  - Heyecanlı/aksiyon konuları (mystery, history, nature + story/facts3/whatif):
 *    +rateExcitedDelta (%10) → daha enerjik tempo.
 *  - Bilimsel/açıklayıcı konular (science, space, human body, technology +
 *    howworks/process): +rateScientificDelta (-%5) → daha anlaşılır tempo.
 *  Diğer durumlarda taban hız korunur.
 *  @returns {string} edge-tts rate ("+18%", "+3%" gibi)
 */
export function ttsRateForTopic(script, baseRate = config.tts.rate) {
  const base = Number.parseInt(String(baseRate).replace('%', ''), 10) || 0;
  const category = String(script?.category || '').toLowerCase();
  const format = String(script?.format || '').toLowerCase();
  const EXCITED = ['mystery', 'history', 'nature'];
  const SCIENTIFIC = ['science', 'space', 'human body', 'technology'];
  const EXCITED_FMT = ['story', 'facts3', 'whatif'];
  const SCIENTIFIC_FMT = ['howworks', 'process'];
  let delta = 0;
  if (EXCITED.includes(category) || EXCITED_FMT.includes(format)) {
    delta = config.tts.rateExcitedDelta;
  } else if (SCIENTIFIC.includes(category) || SCIENTIFIC_FMT.includes(format)) {
    delta = config.tts.rateScientificDelta;
  }
  const total = base + delta;
  return `${total >= 0 ? '+' : ''}${total}%`;
}

async function probeDuration(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  return Number.parseFloat(stdout) || 0;
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
  const language = script.language || config.content?.language || 'en';
  const rawText = scriptToNarration(script);
  const segmentTexts = scriptSegments(script).map((segment) => prepareNarrationForTts(segment, { language }));
  const text = segmentTexts.join(' ').replace(/\s+/g, ' ').trim();
  // Konu tipine göre TTS hızı (heyecanlı +%10 / bilimsel -%5). edge-tts yolu
  // bu hızı kullanır; Piper (çevrimdışı yedek) sabit hızda çalışır.
  const topicRate = ttsRateForTopic(script);
  if (topicRate !== config.tts.rate) {
    console.log(`[tts] konu hızı: ${config.tts.rate} → ${topicRate} (kategori: ${script.category || '-'}, format: ${script.format || '-'})`);
  }
  const base = { outDir, basename, rate: topicRate };

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

  const measuredDuration = await probeDuration(result.audioPath).catch(() => 0);
  const durationEstimate = measuredDuration || (result.wordTimings.length
    ? result.wordTimings[result.wordTimings.length - 1].end
    : 0);
  const timingSource = result.engine === 'edge-tts'
    ? 'edge-srt-segment-interpolated'
    : result.wordTimings.length ? 'whisper-word-alignment' : 'estimated-word-count-fallback';

  return {
    ...result,
    text,
    rawText,
    segmentTexts,
    duration: durationEstimate,
    durationEstimate,
    timingSource,
    phrasingIssues: validateNarrationPhrasing(text),
  };
}
