/**
 * KONU SIRASI KAPISI
 *
 * `pipeline/pick-topic.mjs` Actions'ta tek başına karar veriyor: hangi konunun
 * video olacağını artık insan yazmıyor, bu betik seçiyor. O yüzden iki şeyin
 * denetlenmesi gerekiyor ve ikisi de gözle görünmüyor:
 *
 *   1. TASLAK KONU KENDİLİĞİNDEN SEÇİLMEMELİ. Depodaki sekiz konu
 *      `status: "draft"` ve olguları doğrulanmadı. Varsayılan seçim onları
 *      alırsa, doğrulanmamış bir anlatı kendiliğinden videoya döner — bu
 *      kanalın tek iddiasını ("belgesel") çürütür.
 *
 *   2. HER KONU DERLENEBİLMELİ. Anlatısı boş ya da JSON'u bozuk bir dosya
 *      sıraya girerse hata, 20 dakikalık koşunun ortasında görünür.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');

async function topicFiles() {
  return (await readdir(path.join(ROOT, 'content')))
    .filter((f) => /^story-.+\.json$/.test(f))
    .sort();
}

test('her konu dosyası derlenebilir alanları taşıyor', async () => {
  const files = await topicFiles();
  assert.ok(files.length >= 2, 'depoda konu dosyası yok');
  for (const f of files) {
    const raw = JSON.parse(await readFile(path.join(ROOT, 'content', f), 'utf8'));
    assert.ok(raw.title, `${f}: title yok`);
    const words = String(raw.narration ?? '').trim().split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 60, `${f}: anlatı çok kısa (${words} kelime)`);
    if (raw.status !== undefined) {
      assert.ok(['ready', 'draft'].includes(raw.status), `${f}: bilinmeyen status "${raw.status}"`);
    }
  }
});

test('seçici taslak konuyu kendiliğinden seçmez', async () => {
  const files = await topicFiles();
  const drafts = [];
  for (const f of files) {
    const raw = JSON.parse(await readFile(path.join(ROOT, 'content', f), 'utf8'));
    if (raw.status === 'draft') drafts.push(`content/${f}`);
  }
  if (!drafts.length) return; // Hepsi doğrulanmışsa denetlenecek bir şey yok.

  const {stdout} = await run('node', ['pipeline/pick-topic.mjs'], {cwd: ROOT});
  const chosen = stdout.trim().split('\n').pop().trim();
  assert.ok(
    !drafts.includes(chosen),
    `seçici TASLAK konu seçti: ${chosen} — status kapısı çalışmıyor`,
  );
});

test('--any taslakları da adaya alır', async () => {
  const {stdout} = await run('node', ['pipeline/pick-topic.mjs', '--any', '--list'], {cwd: ROOT});
  const m = stdout.match(/(\d+) konu üretilebilir/);
  assert.ok(m, 'liste özeti basılmadı');
  const files = await topicFiles();
  assert.equal(Number(m[1]), files.length, '--any ile tüm konular aday olmalıydı');
});

/**
 * ROTASYON GERÇEKTEN DÖNMELİ.
 *
 * Actions'ta tekrarı önleyen tek mekanizma bu (defter commit edilemiyor).
 * Sessizce hep aynı konuyu döndürürse kanal tek bir videoyu tekrar tekrar
 * üretir ve bunu kimse fark etmez — çıktı her koşuda geçerli bir MP4'tür.
 */
test('rotasyon ardışık koşularda konu değiştirir', async () => {
  const seen = new Set();
  for (const n of [0, 1, 2, 3]) {
    const {stdout} = await run('node', ['pipeline/pick-topic.mjs', '--any', `--rotate=${n}`], {cwd: ROOT});
    seen.add(stdout.trim().split('\n').pop().trim());
  }
  assert.equal(seen.size, 4, `rotasyon dönmüyor: 4 koşuda ${seen.size} farklı konu`);
});
