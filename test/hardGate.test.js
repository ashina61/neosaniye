import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateHardGate } from '../src/pipeline/hardGate.js';
import { verifyCtaOutput } from '../src/pipeline/outputVerify.js';

// ---- SERT KAPI ----
test('temiz durum → block yok', () => {
  const r = evaluateHardGate({
    sfxVerification: { ok: true, failures: [] },
    ctaVerification: { ok: true, failures: [] },
    ctaApplied: true, ctaLanguageMatch: true,
    music: { repeatedFallback: false, poolExhausted: false, silentFallback: false },
    channelTruth: { expectedChannels: 2, actualChannels: 2 },
  });
  assert.equal(r.block, false);
  assert.deepEqual(r.failures, []);
});

test('İngilizce içerikte Türkçe CTA → editoryal uyarı', () => {
  const r = evaluateHardGate({ ctaApplied: true, ctaLanguageMatch: false });
  assert.equal(r.block, false);
  assert.ok(r.failures.includes('CTA_WRONG_LANGUAGE'));
});

test('SFX final videoda doğrulanamadı → raporlanır', () => {
  const r = evaluateHardGate({ sfxVerification: { ok: false, failures: ['SFX_INAUDIBLE'] } });
  assert.equal(r.block, false);
  assert.ok(r.failures.includes('SFX_INAUDIBLE'));
});

test('müzik havuzu tükendi + tekrar → raporlanır', () => {
  const r = evaluateHardGate({ music: { poolExhausted: true, repeatedFallback: true, silentFallback: false } });
  assert.equal(r.block, false);
  assert.ok(r.failures.includes('MUSIC_POOL_EXHAUSTED'));
});

test('müzik havuzu tükendi ama tek fit değil (repeat yok) → raporlanır yok', () => {
  const r = evaluateHardGate({ music: { poolExhausted: true, repeatedFallback: false, silentFallback: false } });
  assert.equal(r.block, false);
});

test('kanal mono çıktı → CHANNEL_METADATA_MISMATCH', () => {
  const r = evaluateHardGate({ channelTruth: { expectedChannels: 2, actualChannels: 1 } });
  assert.equal(r.block, false);
  assert.ok(r.failures.includes('CHANNEL_METADATA_MISMATCH'));
});

test('CTA uygulanmadıysa dil kapısı tetiklenmez', () => {
  const r = evaluateHardGate({ ctaApplied: false, ctaLanguageMatch: false });
  assert.equal(r.block, false);
});

test('CTA doğrulama başarısızlıkları sert kapıya taşınır', () => {
  const r = evaluateHardGate({
    ctaApplied: true, ctaLanguageMatch: true,
    ctaVerification: { ok: false, failures: ['CTA_CAPTION_OVERLAP', 'CTA_OUTSIDE_SAFE_MARGIN'] },
  });
  assert.equal(r.block, false);
  assert.ok(r.failures.includes('CTA_CAPTION_OVERLAP'));
  assert.ok(r.failures.includes('CTA_OUTSIDE_SAFE_MARGIN'));
});

// ---- CTA ÇIKTI DOĞRULAMASI ----
test('verifyCtaOutput: dil uyuşmazlığı yakalanır', () => {
  const r = verifyCtaOutput({
    box: { x: 56, y: 900, w: 380, h: 112 }, width: 1080, height: 1920,
    layerPresent: true, requestedLanguage: 'en', resolvedLanguage: 'tr', label: 'BEĞEN',
    avoidZones: [], safeMarginPx: 40,
  });
  assert.equal(r.ok, false);
  assert.ok(r.failures.includes('CTA_LANGUAGE_MISMATCH'));
  assert.equal(r.report.languageMatch, false);
});

test('verifyCtaOutput: güvenli kenar payı dışı yakalanır', () => {
  const r = verifyCtaOutput({
    box: { x: 5, y: 900, w: 380, h: 112 }, width: 1080, height: 1920,
    layerPresent: true, requestedLanguage: 'en', resolvedLanguage: 'en',
    avoidZones: [], safeMarginPx: 40,
  });
  assert.ok(r.failures.includes('CTA_OUTSIDE_SAFE_MARGIN'));
  assert.equal(r.report.withinSafeMargin, false);
});

test('verifyCtaOutput: altyazı/UI çakışması yakalanır', () => {
  const r = verifyCtaOutput({
    box: { x: 56, y: 900, w: 380, h: 112 }, width: 1080, height: 1920,
    layerPresent: true, requestedLanguage: 'en', resolvedLanguage: 'en',
    avoidZones: [{ name: 'caption', x: 0, y: 850, w: 1080, h: 200 }],
    safeMarginPx: 40,
  });
  assert.ok(r.failures.includes('CTA_CAPTION_OVERLAP'));
  assert.equal(r.report.captionOverlap, true);
});

test('verifyCtaOutput: temiz yerleşim → ok', () => {
  const r = verifyCtaOutput({
    box: { x: 56, y: 900, w: 380, h: 112 }, width: 1080, height: 1920,
    layerPresent: true, requestedLanguage: 'en', resolvedLanguage: 'en', label: 'LIKE',
    avoidZones: [{ name: 'caption', x: 0, y: 1300, w: 1080, h: 200 }],
    safeMarginPx: 40,
  });
  assert.equal(r.ok, true);
  assert.equal(r.report.languageMatch, true);
  assert.equal(r.report.withinSafeMargin, true);
});
