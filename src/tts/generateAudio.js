import { mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
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

async function probeDuration(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  return Number.parseFloat(stdout) || 0;
}

export async function trimNarrationSilence(audioPath, wordTimings = []) {
  const duration = await probeDuration(audioPath);
  const { stderr = '' } = await run('ffmpeg', ['-hide_banner', '-i', audioPath, '-af', 'silencedetect=noise=-42dB:d=0.12', '-f', 'null', '-'])
    .catch((error) => ({ stderr: error.stderr || '' }));
  const starts = [...stderr.matchAll(/silence_start:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...stderr.matchAll(/silence_end:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  const trimStart = starts[0] <= 0.02 && ends.length ? ends[0] : 0;
  const lastStart = starts.at(-1);
  const trimEnd = Number.isFinite(lastStart) && lastStart > duration - 2 ? lastStart : duration;
  if (trimStart < 0.03 && duration - trimEnd < 0.03) return { audioPath, wordTimings, duration };
  const ext = path.extname(audioPath) || '.wav';
  const trimmed = audioPath.slice(0, -ext.length) + '.trimmed' + ext;
  await run('ffmpeg', ['-y', '-v', 'error', '-i', audioPath, '-af', `atrim=start=${trimStart.toFixed(4)}:end=${trimEnd.toFixed(4)},asetpts=PTS-STARTPTS`, trimmed]);
  await rename(trimmed, audioPath);
  return {
    audioPath,
    duration: Math.max(0, trimEnd - trimStart),
    wordTimings: wordTimings.map((w) => ({ ...w, start: Math.max(0, w.start - trimStart), end: Math.max(0.02, w.end - trimStart) })),
  };
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

  const trimmed = await trimNarrationSilence(result.audioPath, result.wordTimings);
  result.audioPath = trimmed.audioPath;
  result.wordTimings = trimmed.wordTimings;

  const measuredDuration = trimmed.duration || await probeDuration(result.audioPath).catch(() => 0);
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
