import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { evaluateRetention, runRetentionQC } from '../src/pipeline/retentionQC.js';
import { config } from '../src/config.js';

/**
 * Retention QC birim testleri (node:test — sıfır ek bağımlılık).
 * evaluateRetention saf fonksiyondur: aynı girdi her zaman aynı skoru verir,
 * bu yüzden fixture'lar üzerinde kesin/deterministik iddialar kurulabilir.
 */

// Testler config.retention varsayılanlarından bağımsız olsun diye eşikler
// açıkça verilir (env'de RETENTION_* set olsa bile testler değişmez).
const CFG = {
  mode: 'warning',
  minScore: 85,
  maxStaticSegmentSeconds: 4.5,
  targetVisualEventInterval: 3.4,
  firstSpeechDeadlineMs: 900,
  maxHookChars: 30,
  minCaptionPx: 50,
  maxCaptionWords: 4,
};

/** Yüksek skor alması gereken "iyi kurgulanmış video" fixture'ı. */
function strongInput(overrides = {}) {
  const narrations = [
    'This machine counted the stars.', // hook sahnesi — kısa, net
    'Divers found it in a shipwreck, but no one knew what it was.',
    'Inside were thirty bronze gears, until X-rays revealed more.',
    'It predicted eclipses decades ahead.',
    'Turns out the Greeks built a computer.',
    'Nothing this complex appears again for a thousand years.',
    'And one gear still keeps a secret.',
  ];
  return {
    script: {
      hook_text: "This machine shouldn't exist", // 28 karakter, vaat kalıbı var
      finale_text: 'One gear still keeps its secret.',
      format: 'story',
      scenes: narrations.map((n) => ({ narration: n })),
    },
    // İlk kelime 300ms'de, kelimeler arası boşluk < 1.5s.
    wordTimings: Array.from({ length: 40 }, (_, i) => ({
      word: `w${i}`,
      start: 0.3 + i * 0.8,
      end: 0.3 + i * 0.8 + 0.5,
    })),
    // 10 plan / 34s → ort. 3.4s; en uzun statik 4.0s; video payı ~%38.
    itemSeconds: [3.0, 3.4, 4.0, 3.2, 3.6, 3.4, 3.4, 3.4, 3.2, 3.4],
    itemTypes: ['video', 'photo', 'photo', 'video', 'photo', 'photo', 'video', 'photo', 'video', 'photo'],
    itemSources: ['stock', 'archive', 'ai', 'stock', 'gfx', 'ai', 'stock', 'archive', 'stock', 'ai'],
    editPlan: {
      boundaries: [
        { transition: 'cut', sfx: 'whoosh' },
        { transition: 'fade', sfx: 'none' },
        { transition: 'cut', sfx: 'impact' },
        { transition: 'cut', sfx: 'whoosh' },
      ],
      subscribeScene: 7, // 10 planın %70'i — geç CTA ✓
    },
    duration: 34,
    lufs: -14,
    audioPresent: true,
    ...overrides,
  };
}

test('deterministik: aynı girdi aynı skoru verir', () => {
  const a = evaluateRetention(strongInput(), CFG);
  const b = evaluateRetention(strongInput(), CFG);
  assert.equal(a.score, b.score);
  assert.deepEqual(a.parts, b.parts);
});

test('güçlü hook + iyi tempo yüksek skor alır, kritik hata yok', () => {
  const r = evaluateRetention(strongInput(), CFG);
  assert.ok(r.score >= 90, `beklenen ≥90, gelen ${r.score}`);
  assert.equal(r.failures.length, 0);
  assert.equal(r.parts.hook, 25);
  assert.equal(r.parts.visualPacing, 20);
});

test('"Did you know" tarzı zayıf hook puan kaybettirir ve fix önerilir', () => {
  const weak = strongInput();
  weak.script.hook_text = 'Did you know the sea is deep';
  weak.script.scenes[0].narration = 'Did you know the sea is deep?';
  const r = evaluateRetention(weak, CFG);
  const strong = evaluateRetention(strongInput(), CFG);
  assert.ok(r.parts.hook < strong.parts.hook);
  assert.ok(r.recommendedFixes.some((f) => f.includes('Zayıf hook')));
});

test('hook_text yoksa kritik hata (failure) üretilir', () => {
  const noHook = strongInput();
  noHook.script.hook_text = '';
  const r = evaluateRetention(noHook, CFG);
  assert.ok(r.failures.includes('hook_text yok'));
});

test('geç başlayan konuşma uyarı üretir ve hook puanı düşer', () => {
  const late = strongInput({
    wordTimings: Array.from({ length: 40 }, (_, i) => ({
      word: `w${i}`,
      start: 2.0 + i * 0.8,
      end: 2.0 + i * 0.8 + 0.5,
    })),
  });
  const r = evaluateRetention(late, CFG);
  assert.equal(r.metrics.firstSpeechMs, 2000);
  assert.ok(r.warnings.some((w) => w.includes('ilk konuşma')));
  assert.ok(r.parts.hook < 25);
});

test('uzun statik plan tespit edilir ve tempo puanı düşer', () => {
  const slow = strongInput({
    itemSeconds: [8.0, 8.0, 9.0, 9.0],
    itemTypes: ['photo', 'photo', 'photo', 'photo'],
    itemSources: ['ai', 'ai', 'ai', 'ai'],
  });
  const r = evaluateRetention(slow, CFG);
  assert.equal(r.metrics.longestStaticSegment, 9);
  assert.ok(r.parts.visualPacing < 10);
  assert.ok(r.recommendedFixes.some((f) => f.includes('statik plan')));
});

test('placeholder görsel kritik hata sayılır', () => {
  const ph = strongInput();
  ph.itemSources = [...ph.itemSources];
  ph.itemSources[3] = 'placeholder';
  const r = evaluateRetention(ph, CFG);
  assert.ok(r.failures.some((f) => f.includes('placeholder')));
});

test('ses akışı yoksa kritik hata sayılır', () => {
  const mute = strongInput({ audioPresent: false });
  const r = evaluateRetention(mute, CFG);
  assert.ok(r.failures.includes('ses akışı yok'));
});

test('konuşmadaki ölü boşluklar sayılır ve uyarı üretir', () => {
  const gappy = strongInput({
    wordTimings: [
      { word: 'a', start: 0.3, end: 0.6 },
      { word: 'b', start: 2.5, end: 2.8 }, // 1.9s boşluk
      { word: 'c', start: 5.0, end: 5.3 }, // 2.2s boşluk
    ],
  });
  const r = evaluateRetention(gappy, CFG);
  assert.equal(r.metrics.deadAirCount, 2);
  assert.ok(r.warnings.some((w) => w.includes('ölü boşluk')));
});

test('erken abone kartı uyarı üretir', () => {
  const early = strongInput();
  early.editPlan = { ...early.editPlan, subscribeScene: 2 }; // 10 planın %20'si
  const r = evaluateRetention(early, CFG);
  assert.ok(r.warnings.some((w) => w.includes('abone kartı')));
});

// ---- runRetentionQC: mod davranışı + rapor dosyaları ----
// config.retention modül genelinde paylaşıldığı için test sonrası geri yüklenir.

async function withMode(mode, minScore, fn) {
  const orig = { ...config.retention };
  config.retention.mode = mode;
  config.retention.minScore = minScore;
  const dir = await mkdtemp(path.join(os.tmpdir(), 'qc-test-'));
  try {
    return await fn(dir);
  } finally {
    Object.assign(config.retention, orig);
    await rm(dir, { recursive: true, force: true });
  }
}

test('disabled modda hiçbir şey yapılmaz', async () => {
  await withMode('disabled', 85, async (dir) => {
    const res = await runRetentionQC(strongInput(), dir);
    assert.deepEqual(res, { score: null, ok: true, blockUpload: false, report: null });
  });
});

test('warning modda düşük skor bile upload engellemez', async () => {
  await withMode('warning', 85, async (dir) => {
    const bad = strongInput({ audioPresent: false }); // kritik hata → fail
    const res = await runRetentionQC(bad, dir);
    assert.equal(res.blockUpload, false);
    assert.equal(res.report.status, 'fail');
  });
});

test('strict modda kritik hata / düşük skor upload engeller', async () => {
  await withMode('strict', 85, async (dir) => {
    const bad = strongInput({ audioPresent: false });
    const res = await runRetentionQC(bad, dir);
    assert.equal(res.blockUpload, true);
  });
});

test('strict modda eşiği geçen video engellenmez', async () => {
  await withMode('strict', 85, async (dir) => {
    const res = await runRetentionQC(strongInput(), dir);
    assert.equal(res.blockUpload, false, `skor ${res.score} beklenmedik şekilde engellendi`);
    assert.equal(res.report.productionReady, true);
  });
});

test('production-report.json ve .md yazılır, şema beklenen alanları içerir', async () => {
  await withMode('warning', 85, async (dir) => {
    const res = await runRetentionQC(strongInput(), dir);
    const json = JSON.parse(await readFile(path.join(dir, 'production-report.json'), 'utf8'));
    for (const key of [
      'retentionScore', 'status', 'productionReady', 'mode', 'minScore',
      'scores', 'metrics', 'warnings', 'failures', 'recommendedFixes', 'createdAt',
    ]) {
      assert.ok(key in json, `production-report.json '${key}' alanı eksik`);
    }
    assert.equal(json.retentionScore, res.score);
    assert.equal(json.mode, 'warning');
    const md = await readFile(path.join(dir, 'production-report.md'), 'utf8');
    assert.ok(md.includes('Retention QC Raporu'));
    assert.ok(md.includes(`${res.score}/100`));
  });
});

test('kategori puanları üst sınırlara sabitlenir (clamp)', () => {
  const r = evaluateRetention(strongInput(), CFG);
  assert.ok(r.parts.hook <= 25);
  assert.ok(r.parts.visualPacing <= 20);
  assert.ok(r.parts.curiosity <= 15);
  for (const k of ['captions', 'visualVariety', 'audioDesign', 'payoffAndLoop']) {
    assert.ok(r.parts[k] <= 10);
  }
  const total = Object.values(r.parts).reduce((a, b) => a + b, 0);
  assert.equal(r.score, total);
  assert.ok(r.score <= 100);
});

test('boş/eksik girdilerde çökmez, düşük skor + hata döner', () => {
  const r = evaluateRetention({ script: {}, duration: 0 }, CFG);
  assert.ok(Number.isFinite(r.score));
  assert.ok(r.score < 50);
  assert.ok(r.failures.includes('hook_text yok'));
  assert.ok(r.failures.includes('ses akışı yok'));
});
