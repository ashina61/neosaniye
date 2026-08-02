#!/usr/bin/env node
/**
 * Faz 2 test aracı: bir script üret (veya örnek dosyadan oku) ve seslendir.
 *
 * Kullanım:
 *   node scripts/generate-audio.js                     # yeni script üret + seslendir
 *   node scripts/generate-audio.js examples/foo.json   # var olan script'i seslendir
 *
 * Çıktılar output/ klasörüne yazılır: <ad>.mp3 ve <ad>.srt (kelime zaman damgaları).
 * Ön koşul: `pip install edge-tts` ve script üretimi için GEMINI_API_KEY.
 */
import { readFile } from 'node:fs/promises';
import { generateAudio } from '../src/tts/generateAudio.js';

const arg = process.argv[2];

let script;
if (arg) {
  script = JSON.parse(await readFile(arg, 'utf8'));
  if (!script.normalizedTopic) {
    const { normalizeTopic } = await import('../src/lib/firestore.js');
    script.normalizedTopic = normalizeTopic(script.topic || 'script');
  }
} else {
  const { generateScript } = await import('../src/script/generateScript.js');
  script = await generateScript();
  console.log(`Üretilen konu: ${script.topic}`);
}

const result = await generateAudio(script);
console.log('Ses üretildi:');
console.log('  mp3      :', result.audioPath);
console.log('  altyazı  :', result.subtitlePath);
console.log('  kelime   :', result.wordTimings.length, 'adet zaman damgası');
console.log('  süre~    :', result.durationEstimate.toFixed(1), 'sn');
console.log('  ilk 5 kelime:', result.wordTimings.slice(0, 5).map((w) => w.word).join(' '));

process.exit(0);
