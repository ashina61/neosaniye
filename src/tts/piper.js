import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);

/**
 * Piper (çevrimdışı neural TTS) ile seslendirme. edge-tts yedeği.
 * Ses modeli yoksa piper ilk çalıştırmada indirir (--data-dir'e cache'lenir).
 * Piper WAV üretir; kelime zamanlaması vermez — orkestratör bunu whisper ile çıkarır.
 *
 * Ön koşul: `pip install piper-tts`.
 *
 * @returns {Promise<{engine:'piper', audioPath:string, subtitlePath:null, wordTimings:null}>}
 */
export async function synthesizePiper(text, {
  outDir,
  basename,
  voice = config.tts.piperVoice,
  dataDir = config.tts.piperDataDir,
} = {}) {
  await mkdir(dataDir, { recursive: true });
  const audioPath = path.join(outDir, `${basename}.wav`);

  const args = [
    '--model', voice,
    '--data-dir', dataDir,
    '--download-dir', dataDir,
    '--output_file', audioPath,
  ];

  // Metin stdin üzerinden verilir (uzun metin + tırnak sorunlarını önler).
  await execFileAsync('piper', args, {
    input: text,
    maxBuffer: 10 * 1024 * 1024,
  });

  return { engine: 'piper', audioPath, subtitlePath: null, wordTimings: null };
}
