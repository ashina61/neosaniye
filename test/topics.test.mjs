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
 * FOTOĞRAF ÖNCESİ DÖNEME FOTOĞRAF İSTENMEZ.
 *
 * Konu havuzu tek döneme (1971, 1963) bağlıyken malzeme cümlesi sabitti ve
 * kimse fark etmiyordu. Havuz ona çıkınca promt şunu yazmaya başladı:
 *
 *   "A warship … Period-accurate for 1628 … Black and white archival
 *    halftone photograph"
 *
 * 1628'de fotoğraf yok (1839), gazetede halftone tramı yok (1880'ler). Model
 * ne üretirse üretsin sonuç yanlış ve koşu BAŞARILI biter — otomatik üretimi
 * sessizce bozan sınıftan bir hata, tam da bu kapının varlık sebebi.
 *
 * Kapı havuzun KENDİSİNİ tarıyor, örnek yılları değil: yarın 1600'lerden yeni
 * bir konu eklendiğinde de tutar.
 */
test('fotoğraf öncesi konular fotoğraf istemiyor', async () => {
  const {pieceMaterial} = await import('../pipeline/collage-prompt.mjs');
  const {searchFor} = await import('../pipeline/subject.mjs');

  // Sınırlar tek tek: kayarlarsa aşağıdaki havuz taraması bunu göstermez.
  assert.match(pieceMaterial('1885'), /halftone photograph/);
  assert.doesNotMatch(pieceMaterial('1884'), /halftone/);
  assert.match(pieceMaterial('1884'), /collodion/);
  assert.match(pieceMaterial('1838'), /engraving/);
  assert.match(pieceMaterial(undefined), /halftone photograph/, 'dönem yoksa kanalın varsayılanı');

  for (const f of await topicFiles()) {
    const raw = JSON.parse(await readFile(path.join(ROOT, 'content', f), 'utf8'));
    const year = Number.parseInt(String(raw.era ?? '').replace(/\D+/g, ''), 10);
    if (!Number.isFinite(year) || year >= 1839) continue;

    assert.doesNotMatch(
      pieceMaterial(raw.era),
      /photograph/,
      `${f} (${raw.era}): fotoğraf öncesi döneme fotoğraf malzemesi isteniyor`,
    );
    const q = searchFor(raw.narration, raw.era);
    if (q) {
      assert.doesNotMatch(q, /photograph/, `${f} (${raw.era}): arşiv sorgusu fotoğraf arıyor — "${q}"`);
    }
  }

  /**
   * SÖZLÜĞÜN `style` METNİ MALZEME ADI VERMEZ.
   *
   * Asıl sızıntı buradaydı ve üstteki kapı onu ortaya çıkardı: malzeme cümlesi
   * döneme göre gravür derken, ailenin kendi `style`ı hâlâ "documentary
   * photograph" diyordu. Aynı promtta iki farklı malzeme — model hangisini
   * dinlerse dinlesin biri yanlış.
   *
   * Ayrım: `style` BAKIŞI söyler (yandan, dörtte üç, düz), `pieceMaterial`
   * MALZEMEYİ. 25 ailenin 22'sinde ikisi karışmıştı.
   */
  const {CONCRETE} = await import('../pipeline/subject.mjs');
  const leaky = CONCRETE.filter((c) => /photograph|halftone|engraving|painting|print\b/i.test(c.style));
  assert.deepEqual(
    leaky.map((c) => `${c.shape}: ${c.style}`),
    [],
    'aile `style` metni malzeme adı veriyor — malzeme yalnızca pieceMaterial()in işi',
  );
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
