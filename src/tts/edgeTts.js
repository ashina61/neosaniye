import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);

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
 * edge-tts ile seslendirme. Başarısız olursa (kurulu değil / 403 / ağ) hata fırlatır;
 * orkestratör bu durumda Piper'a düşer.
 *
 * @returns {Promise<{engine:'edge-tts', audioPath:string, subtitlePath:string, wordTimings:Array}>}
 */
export async function synthesizeEdge(text, {
  outDir,
  basename,
  voice = config.tts.voice,
  rate = config.tts.rate,
  pitch = config.tts.pitch,
} = {}) {
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
  } finally {
    await rm(textPath, { force: true });
  }

  const srt = await readFile(subtitlePath, 'utf8').catch(() => '');
  return {
    engine: 'edge-tts',
    audioPath,
    subtitlePath,
    wordTimings: parseSrt(srt),
  };
}
