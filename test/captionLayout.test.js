import test from 'node:test';
import assert from 'node:assert/strict';
import {
  requiredFontPx,
  splitBeforeShrink,
  layoutGroup,
  groupCaptionWords,
  checkCaptionSafeArea,
  analyzeCaptionLayout,
} from '../src/video/captionLayout.js';
import { evaluateRetention } from '../src/pipeline/retentionQC.js';
import { config } from '../src/config.js';

/** Kelime dizisini zaman damgalı gruba çevirir (0.5s aralıklı akış). */
function toWords(list, gap = 0.1) {
  let t = 0.3;
  return list.map((word) => {
    const w = { word, start: t, end: t + 0.4 };
    t = w.end + gap;
    return w;
  });
}

const BASE = {
  usableW: 900,
  baseSize: 52,
  minSize: 30,
  charFactor: 0.56,
  wordFactor: 0.62,
  splitRatio: 0.72,
};

test('kısa grup bölünmez ve taban boyutta kalır', () => {
  const g = toWords(['the', 'old', 'ship']);
  const parts = splitBeforeShrink(g, BASE);
  assert.equal(parts.length, 1);
  const [ev] = layoutGroup(g, BASE);
  assert.equal(ev.fontSize, 52);
  assert.equal(ev.lines, 1);
  assert.equal(ev.belowFloor, false);
});

test('SPLIT-BEFORE-SHRINK: uzun grup fontu ezmek yerine önce bölünür', () => {
  const g = toWords(['extraordinarily', 'incomprehensible', 'misunderstanding']);
  // Bölünmeden gerekli font, bölme eşiğinin altında olmalı (yoksa test anlamsız).
  assert.ok(requiredFontPx(g, BASE) < BASE.baseSize * BASE.splitRatio);
  const parts = splitBeforeShrink(g, BASE);
  assert.ok(parts.length >= 2, 'grup bölünmedi');
  // Bölünmüş her parça, bölünmemiş bütünden daha büyük fontla sığar.
  const events = layoutGroup(g, BASE);
  const unsplitFont = Math.max(BASE.minSize, requiredFontPx(g, BASE));
  for (const ev of events) {
    assert.ok(ev.fontSize >= unsplitFont, `bölme fontu iyileştirmedi (${ev.fontSize} < ${unsplitFont})`);
  }
});

test('hiçbir olay iki satırı aşmaz (tek satır garantisi)', () => {
  const long = toWords(['this', 'is', 'an', 'unusually', 'elaborate', 'caption', 'sequence']);
  const groups = groupCaptionWords(long, { perLine: 3 });
  for (const g of groups) {
    for (const ev of layoutGroup(g, BASE)) {
      assert.ok(ev.lines <= 2);
      assert.equal(ev.lines, 1);
    }
  }
});

test('font asla minimum tabanın altına inmez; sığmayan kelime işaretlenir', () => {
  const monster = toWords(['pneumonoultramicroscopicsilicovolcanoconiosisandmore']);
  const [ev] = layoutGroup(monster, BASE);
  assert.ok(ev.fontSize >= BASE.minSize, `font ${ev.fontSize} tabanın altında`);
  assert.equal(ev.belowFloor, true, 'taşan kelime belowFloor işaretlenmedi');
});

test('vurgu koşusu (sayı+birim) asla bölünmez', () => {
  const words = toWords(['100,000', 'acres']);
  const res = analyzeCaptionLayout(words, { emphasisWords: ['acres'] });
  assert.equal(res.eventCount, 1, 'sayı+birim ikilisi bölündü');
  assert.equal(res.events[0].words.length, 2);
});

test('güvenli alan: varsayılan yerleşim güvenli, düşük marginV ihlal', () => {
  const okArea = checkCaptionSafeArea({ height: 1920, marginV: 460, maxFontPx: 78 });
  assert.equal(okArea.ok, true);
  const lowArea = checkCaptionSafeArea({ height: 1920, marginV: 100, maxFontPx: 78 });
  assert.equal(lowArea.ok, false);
  assert.equal(lowArea.bottomOk, false, 'alt Shorts UI bandı ihlali yakalanmadı');
  const highArea = checkCaptionSafeArea({ height: 1920, marginV: 820, maxFontPx: 200 });
  assert.equal(highArea.topOk, false, 'üst güvenli alan ihlali yakalanmadı');
});

test('safe area ihlali retention QC tarafında KRİTİK HATA üretir (strict fail yolu)', () => {
  const cfg = {
    mode: 'strict', minScore: 85, maxStaticSegmentSeconds: 4.5,
    targetVisualEventInterval: 3.4, firstSpeechDeadlineMs: 900,
    maxHookChars: 30, minCaptionPx: 50, maxCaptionWords: 4,
  };
  const input = {
    script: { hook_text: 'This shouldn\'t exist', finale_text: 'End.', scenes: [{ narration: 'But it does.' }] },
    wordTimings: toWords(['but', 'it', 'does']),
    itemSeconds: [3], itemTypes: ['video'], itemSources: ['stock'],
    editPlan: null, duration: 3, lufs: -14, audioPresent: true,
  };
  const origMargin = config.video.captionMarginV;
  config.video.captionMarginV = 100; // Shorts UI bandının içine sokuyoruz
  try {
    const r = evaluateRetention(input, cfg);
    assert.ok(
      r.failures.some((f) => f.includes('güvenli alan')),
      'güvenli alan ihlali failure üretmedi',
    );
  } finally {
    config.video.captionMarginV = origMargin;
  }
});

test('analyzeCaptionLayout deterministiktir', () => {
  const words = toWords(['the', 'machine', 'counted', 'stars', 'until', 'it', 'stopped']);
  const a = analyzeCaptionLayout(words, {});
  const b = analyzeCaptionLayout(words, {});
  assert.deepEqual(
    { ...a, events: a.events.map((e) => e.text) },
    { ...b, events: b.events.map((e) => e.text) },
  );
});

test('noktalama ve doğal duraklar grubu kapatır', () => {
  const words = [
    { word: 'First.', start: 0.3, end: 0.7 },
    { word: 'then', start: 0.8, end: 1.1 },
    { word: 'silence', start: 1.2, end: 1.6 },
    { word: 'after', start: 3.5, end: 3.9 }, // >0.28s boşluk — yeni grup
  ];
  const groups = groupCaptionWords(words, { perLine: 3 });
  assert.equal(groups.length, 3);
  assert.equal(groups[0].length, 1); // "First." noktalamayla kapandı
  assert.equal(groups[2][0].word, 'after');
});
