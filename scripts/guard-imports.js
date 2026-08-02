#!/usr/bin/env node
/**
 * KORUMA BEKÇİSİ — src/ altındaki HER modülü parse + import eder.
 *
 * Neden: 07-23'te bir ajan generateScript.js'i geçersiz UTF-8 + escape'siz
 * apostrofla, viewerFirstValidation.js'i kapanmayan regex'le bozdu; import
 * zinciri çöktü ve daily-short cron ~15 koşu boyunca video ÜRETMEDEN patladı.
 * Bu bekçi tam o sınıf hatayı (SyntaxError / "missing /" / bozuk bayt / kırık
 * import) her push'ta SANİYELER içinde yakalar — CI kırmızı yanar, hiçbir bozuk
 * dosya production cron'a ulaşamaz. ffmpeg/ağ YOK; hızlı ve deterministik.
 *
 * Çıkış kodu: bir modül bile parse/import edilemezse 1 (CI'ı kırar), yoksa 0.
 */
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT = 'src';

/** src/ altındaki tüm .js dosyalarını topla. */
function collect(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...collect(p));
    else if (e.isFile() && p.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = collect(ROOT).sort();
const failures = [];

for (const f of files) {
  // 1) Sözdizimi (node --check bazı regex/derleme hatalarını kaçırabilir —
  //    bu yüzden 2. adım da şart).
  try {
    execFileSync('node', ['--check', f], { stdio: 'pipe' });
  } catch (err) {
    failures.push({ file: f, stage: 'parse', message: String(err.stderr || err.message).split('\n').find((l) => l.includes('Error')) || 'parse error' });
    continue;
  }
  // 2) Gerçek ESM import (regex literal / import-time hataları + kırık bağımlılık
  //    zinciri buradan yakalanır).
  try {
    await import(pathToFileURL(path.resolve(f)).href);
  } catch (err) {
    failures.push({ file: f, stage: 'import', message: String(err.message).split('\n')[0].slice(0, 160) });
  }
}

if (failures.length) {
  console.error(`\n❌ KORUMA BEKÇİSİ: ${failures.length}/${files.length} modül parse/import edilemedi:\n`);
  for (const x of failures) console.error(`  [${x.stage}] ${x.file}\n         → ${x.message}`);
  console.error('\nBu dosyalar production import zincirini kırar (video üretilmez). Push reddedilmeli.');
  process.exit(1);
}

console.log(`✅ KORUMA BEKÇİSİ: ${files.length} src modülünün tümü temiz parse+import ediyor.`);
