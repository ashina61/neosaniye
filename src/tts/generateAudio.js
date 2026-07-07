import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);

/**
 * Faz 2 — Ses (TTS).
 * edge-tts (ücretsiz, Microsoft, API key gerekmez) ile script'i .mp3'e çevirir.
 * edge-tts kelime bazlı zaman damgalarını (WordBoundary) altyazı olarak da
 * üretir; bu sayede Faz 4'teki karaoke altyazılar için AYRICA whisper'a gerek
 * kalmaz (whisper opsiyonel bir yedek olarak düşünülebilir).
 *
 * Ön koşul: sistemde `edge-tts` CLI kurulu olmalı (pip install edge-tts).
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

/** "00:00:01,250" -> 1.25 (saniye) */
function srtTimeToSeconds(t) {
  const m = t.trim().match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
  if (!m) return 0;
  const [, hh, mm, ss, ms] = m;
  return Number(hh) * 3600 + Number(mm) * 60 + Number(ss) + Number(ms) / 1000;
}

/** edge-tts'in ürettiği SRT altyazısını [{ word, start, end }] dizisine çevirir. */
export function parseSrt(srt) {
  const blocks = srt.replace(/\r/g, '').trim().split(/\n\n+/);
  const out = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const timeLine = lines.find((l) => l.includes('-->'));
    if (!timeLine) continue;
    const [start, end] = timeLine.split('-->');
    const text = lines
      .slice(lines.indexOf(timeLine) + 1)
      .join(' ')
      .trim();
    if (!text) continue;
    out.push({
      word: text,
      start: srtTimeToSeconds(start),
      end: srtTimeToSeconds(end),
    });
  }
  return out;
}

/**
 * Script'i seslendirir.
 * @param {object} script - generateScript çıktısı (veya en az {hook,body,cta}).
 * @param {object} [opts]
 * @param {string} [opts.outDir='output'] - Çıktı klasörü.
 * @param {string} [opts.basename] - Dosya adı kökü (varsayılan: normalizedTopic).
 * @param {string} [opts.voice] - edge-tts sesi (varsayılan config.tts.voice).
 * @param {string} [opts.rate]  - Konuşma hızı (varsayılan config.tts.rate).
 * @param {string} [opts.pitch] - Ton (varsayılan config.tts.pitch).
 * @returns {Promise<{audioPath:string, subtitlePath:string, wordTimings:Array, text:string, durationEstimate:number}>}
 */
export async function generateAudio(script, opts = {}) {
  const {
    outDir = 'output',
    basename = script.normalizedTopic || 'script',
    voice = config.tts.voice,
    rate = config.tts.rate,
    pitch = config.tts.pitch,
  } = opts;

  await mkdir(outDir, { recursive: true });

  const text = scriptToNarration(script);
  const textPath = path.join(outDir, `${basename}.txt`);
  const audioPath = path.join(outDir, `${basename}.mp3`);
  const subtitlePath = path.join(outDir, `${basename}.srt`);

  await writeFile(textPath, text, 'utf8');

  const args = [
    '--voice', voice,
    '--rate', rate,
    '--pitch', pitch,
    '--file', textPath,
    '--write-media', audioPath,
    '--write-subtitles', subtitlePath,
  ];

  try {
    await execFileAsync('edge-tts', args, { maxBuffer: 10 * 1024 * 1024 });
  } catch (err) {
    const hint =
      'edge-tts başarısız. Kurulu mu? (pip install edge-tts). ' +
      'Datacenter IP\'lerinde Microsoft 403 verebilir — yerelde/ev IP\'sinde deneyin.';
    throw new Error(`${hint}\n${err.stderr || err.message}`);
  } finally {
    await rm(textPath, { force: true });
  }

  const srt = await readFile(subtitlePath, 'utf8').catch(() => '');
  const wordTimings = parseSrt(srt);
  const durationEstimate = wordTimings.length
    ? wordTimings[wordTimings.length - 1].end
    : 0;

  return { audioPath, subtitlePath, wordTimings, text, durationEstimate };
}
