#!/usr/bin/env node
/**
 * Faz 3 test aracı: bir script'in visual_keywords'leri için Pexels'ten
 * dikey klip/foto indirir.
 *
 * Kullanım:
 *   node scripts/fetch-media.js examples/script-01-the-mystery-of-yawning.json
 *   node scripts/fetch-media.js            # yeni script üret + medya çek
 *
 * Ön koşul: .env içinde PEXELS_API_KEY (ücretsiz: pexels.com/api).
 * Çıktı: output/<ad>/media/*  ve  output/<ad>/media-manifest.json
 */
import { readFile } from 'node:fs/promises';
import { fetchMedia } from '../src/media/fetchMedia.js';

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

console.log('Anahtar kelimeler:', (script.visual_keywords || []).join(', '));
const result = await fetchMedia(script);
console.log(`\n${result.items.length} medya indirildi -> ${result.mediaDir}`);
console.log('Manifest:', result.manifestPath);

process.exit(0);
