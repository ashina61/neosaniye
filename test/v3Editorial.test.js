/**
 * V3 EDİTORYAL DÜZELTMELER — §11 süre, §12 olgusal dil, §13 altyazı boyutu.
 *
 * Üçü de brain-vs-ai-memory çıktısında ölçülmüş somut kusurlardı:
 *   • 56.9 saniye (hedef 35-40) — son iki sahne soyut özetti.
 *   • "AI has perfect recall", "the brain holds exactly 100,000 GB" — dördü de
 *     yanlış; benzetme kesin ölçüm gibi sunulmuştu.
 *   • Altyazı ön izlemede 14.7px — okunabilirlik testi düşmüştü.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { config } from '../src/config.js';
import { findFalseAbsolutes, classifyFactualCertainty } from '../src/pipeline/editorialSignals.js';
import { evaluateMeasuredDuration } from '../src/pipeline/durationPolicy.js';

// ---------------- §11 SÜRE ----------------
test('mini belgesel bandı: ideal 38-50s, sert bant 30-58s', () => {
  // Süre hedefi OKUNABİLİRLİK için gevşetildi: 35-40 bandı 2.8 kelime/sn'yi
  // zorunlu kılıyordu ve altyazı yetişmiyordu (31 bloğun 11'i çok hızlıydı).
  assert.equal(config.content.idealMinSeconds, 38);
  assert.equal(config.content.idealMaxSeconds, 50);
  assert.equal(config.content.maxDurationSeconds, 58);
  assert.equal(config.content.minDurationSeconds, 30);
});

test('çok kısa video hâlâ reddedilir', () => {
  const r = evaluateMeasuredDuration(18, config.content);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'AUDIO_TOO_SHORT');
});

test('44 saniyelik video ideal bandın içinde', () => {
  const r = evaluateMeasuredDuration(44, config.content);
  assert.equal(r.ok, true);
  assert.ok(44 >= config.content.idealMinSeconds && 44 <= config.content.idealMaxSeconds);
});

test('kelime tavanı süreye göre geri hesaplanmış (tutarlılık)', () => {
  // ~2.6 kelime/sn: tavan kelime sayısı sert süre tavanını aşmamalı, yoksa
  // script üretimi kendi kapısına çarpar (canlıda tam bu yaşandı).
  const worstCaseSeconds = config.content.maxNarrationWords / 2.3;
  assert.ok(worstCaseSeconds <= config.content.maxDurationSeconds,
    `${config.content.maxNarrationWords} kelime ≈ ${worstCaseSeconds.toFixed(1)}s > tavan ${config.content.maxDurationSeconds}s`);
});

test('script prompt\'u ideal süreyi config\'ten okur (iki yerde ayrışmasın)', async () => {
  const src = await readFile('src/script/generateScript.js', 'utf8');
  assert.ok(!/35-58 second story/.test(src), 'eski 35-58s hedefi prompt\'ta duruyor');
  assert.match(src, /config\.content\.idealMinSeconds/);
});

// ---------------- §12 OLGUSAL DİL ----------------
const FALSE_CLAIMS = [
  'AI has perfect recall.',
  'AI never omits information.',
  'AI cannot infer.',
  'The brain holds exactly 100,000 GB.',
];

for (const claim of FALSE_CLAIMS) {
  test(`yanlış-mutlak yakalanır: "${claim}"`, () => {
    const found = findFalseAbsolutes(claim);
    assert.equal(found.length, 1, JSON.stringify(found));
    assert.ok(found[0].suggestion.length > 20, found[0].suggestion);
  });
}

test('doğru yazılmış hâli temiz geçer', () => {
  const good = [
    "Some estimates compare the brain's storage capacity to tens of thousands of gigabytes.",
    'AI systems can retrieve stored patterns consistently, but this is not the same as human memory.',
    'Human memory reconstructs experiences using context and emotion.',
    'AI can infer patterns, but it does not remember experiences the way humans do.',
  ].join(' ');
  assert.deepEqual(findFalseAbsolutes(good), []);
});

test('hedge kelimesi yanlış iddiayı AFFETMEZ', () => {
  // "AI probably has perfect recall" hâlâ yanlıştır, yalnızca kibar söylenmiş.
  const r = classifyFactualCertainty('AI probably has perfect recall.');
  assert.equal(r.overclaim, true, JSON.stringify(r));
  assert.equal(r.falseAbsolutes.length, 1);
});

test('olgusal sınıflandırma yanlış-mutlak varsa established der', () => {
  const r = classifyFactualCertainty('The brain holds exactly 100,000 GB.');
  assert.equal(r.level, 'established');
  assert.equal(r.overclaim, true);
});

// ---------------- §13 ALTYAZI ----------------
test('altyazı ön izleme hedefi 17px, render tabanı 52px', () => {
  assert.ok(config.retention.captionMinPreviewPx >= 17,
    `${config.retention.captionMinPreviewPx} < 17`);
  assert.ok(config.video.captionMinPx >= 52,
    `küçültme tabanı ${config.video.captionMinPx} — 14.7px ön izlemeye bu yol açıyordu`);
  assert.ok(config.video.captionSize >= 52);
});

test('14.7px ölçümü artık BAŞARISIZ sayılır', async () => {
  const { assessCaptionReadability } = await import('../src/video/readability.js');
  // Eşik 15 iken 14.7 "kıl payı" düşüyordu; 17 hedefiyle bant net.
  const r = assessCaptionReadability('a fairly long caption block of words here', {
    minPreviewPx: config.retention.captionMinPreviewPx,
  });
  assert.equal(typeof r.ok, 'boolean');
  assert.ok(config.retention.captionMinPreviewPx > 14.7);
});

test('SESSİZ HATA REGRESYONU: süre kapısı config alan adlarını okur', () => {
  // evaluateMeasuredDuration yalnızca minSeconds/maxSeconds okuyordu ama tek
  // çağıran config.content veriyor (minDurationSeconds/maxDurationSeconds).
  // Destructuring daima varsayılanlara (35/58) düşüyordu: CONTENT_MAX_SECONDS
  // ortam değişkeninin HİÇBİR ETKİSİ YOKTU.
  const r = evaluateMeasuredDuration(50, { minDurationSeconds: 28, maxDurationSeconds: 44 });
  assert.equal(r.ok, false, 'config adları hâlâ okunmuyor');
  assert.equal(r.maxSeconds, 44);
  // Eski adlandırma da çalışmaya devam etmeli (geriye dönük uyum).
  const legacy = evaluateMeasuredDuration(50, { minSeconds: 28, maxSeconds: 44 });
  assert.equal(legacy.ok, false);
});
