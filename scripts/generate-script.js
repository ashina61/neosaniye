#!/usr/bin/env node
/**
 * Faz 1 test aracı.
 *
 * Kullanım:
 *   node scripts/generate-script.js [adet] [--save]
 *
 *   node scripts/generate-script.js         -> 1 script üretir, ekrana yazar
 *   node scripts/generate-script.js 3       -> 3 script üretir
 *   node scripts/generate-script.js 1 --save-> üretir ve Firestore'a konuyu işaretler
 *
 * .env dosyasında ANTHROPIC_API_KEY gereklidir. FIREBASE_SERVICE_ACCOUNT
 * verilmezse Firestore devre dışı kalır (konu tekrar kontrolü atlanır).
 */
import { generateScript } from '../src/script/generateScript.js';
import { markTopicUsed } from '../src/lib/firestore.js';

const args = process.argv.slice(2);
const save = args.includes('--save');
const count = Number(args.find((a) => /^\d+$/.test(a)) || 1);

for (let i = 0; i < count; i += 1) {
  const script = await generateScript();
  console.log(JSON.stringify(script, null, 2));
  if (save) {
    await markTopicUsed(script.topic, { scriptPreview: script.hook });
    console.log(`[kaydedildi] used_topics -> ${script.normalizedTopic}`);
  }
  if (i < count - 1) console.log('\n----------------------------------------\n');
}

process.exit(0);
