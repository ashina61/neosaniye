import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WHISPER_HELPER = path.resolve(HERE, '../../scripts/whisper_align.py');

/**
 * Bir ses dosyasından faster-whisper ile kelime bazlı zaman damgaları çıkarır.
 * Yalnızca Piper yolunda gerekir (edge-tts zaten zaman damgası verir).
 *
 * Ön koşul: `pip install faster-whisper`.
 *
 * @returns {Promise<Array<{word:string,start:number,end:number}>>}
 */
export async function alignWords(audioPath, model = config.tts.whisperModel) {
  const { stdout } = await execFileAsync(
    'python3',
    [WHISPER_HELPER, audioPath, model],
    { maxBuffer: 20 * 1024 * 1024 },
  );
  return JSON.parse(stdout);
}
