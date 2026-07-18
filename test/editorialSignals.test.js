import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countPatternInterrupts,
  detectMechanismCoverage,
  classifyFactualCertainty,
  sfxQuality,
} from '../src/pipeline/editorialSignals.js';
import {
  semanticRelevanceScore,
  isAssetRelevant,
  summarizeRelevance,
} from '../src/media/semanticRelevance.js';
import { assessHookReadability, assessCaptionReadability, hookFontPx, previewPx } from '../src/video/readability.js';
import { evaluateRetention } from '../src/pipeline/retentionQC.js';

const CFG = {
  mode: 'warning', minScore: 85, maxStaticSegmentSeconds: 4.0, targetVisualEventInterval: 3.2,
  minVisualEvents: 10, minPatternInterrupts: 3, idealPatternInterrupts: 5, firstSpeechDeadlineMs: 900,
  maxHookChars: 30, maxHookWords: 7, minCaptionPx: 50, maxCaptionWords: 4, minAudibleSfx: 3,
  maxAudibleSfx: 6, minSfxGapSeconds: 3.0, ctaEarliestRatio: 0.7, minSemanticRelevance: 0.34,
  hookMinPreviewPx: 20, captionMinPreviewPx: 15,
};

// ---- 12) pattern interrupt sayımı ----
test('pattern interrupt: kaynak/motion/gfx/sfx değişimleri sayılır, aynı-kaynak cut sayılmaz', () => {
  // Viking videosu: 6 uzun plan, hepsi farklı kaynak → 6 interrupt.
  const viking = countPatternInterrupts({
    itemSources: ['stock', 'stock', 'stock', 'ai', 'ai', 'ai'],
    itemTypes: ['video', 'photo', 'photo', 'photo', 'photo', 'photo'],
    editPlan: { boundaries: [{ sfx: 'none' }, { sfx: 'none' }, { sfx: 'none' }, { sfx: 'none' }, { sfx: 'none' }] },
  });
  // idx0 +1; idx1 same source, no motion/sfx → no; idx2 same → no; idx3 ai≠stock → +1; idx4 same → no; idx5 same → no = 2
  assert.equal(viking.count, 2);
  // Aynı görselin tempo için bölünmesi (aynı kaynak, cut, sfx none) sayılmaz.
  const split = countPatternInterrupts({
    itemSources: ['ai', 'ai', 'ai'], itemTypes: ['photo', 'photo', 'photo'],
    editPlan: { boundaries: [{ sfx: 'none' }, { sfx: 'none' }] },
  });
  assert.equal(split.count, 1); // sadece açılış
  // gfx + sfx + yeni kaynak sayılır.
  const rich = countPatternInterrupts({
    itemSources: ['stock', 'gfx', 'archive', 'ai'], itemTypes: ['video', 'photo', 'photo', 'video'],
    editPlan: { boundaries: [{ sfx: 'whoosh' }, { sfx: 'none' }, { sfx: 'impact' }] },
  });
  assert.equal(rich.count, 4);
});

// ---- 5) mekanizma → açıklayıcı görsel zorunlu ----
test('mekanizma: "how it works" anlatısı gfx yoksa ok=false', () => {
  const script = { format: 'story', scenes: [{ narration: 'The crystal splits the light into two beams.' }] };
  assert.equal(detectMechanismCoverage(script, ['stock', 'ai']).ok, false);
  assert.equal(detectMechanismCoverage(script, ['stock', 'gfx']).ok, true);
  // Mekanizma yoksa gfx gerekmez.
  const plain = { format: 'story', scenes: [{ narration: 'The ship sailed north for weeks.' }] };
  assert.equal(detectMechanismCoverage(plain, ['stock']).ok, true);
});

// ---- 13) olgusal kesinlik ----
test('factual certainty: mutlak dil + hedge yok → overclaim', () => {
  assert.equal(classifyFactualCertainty('Vikings definitely used this crystal.').overclaim, true);
  assert.equal(classifyFactualCertainty('Vikings may have used this crystal.').overclaim, false);
  assert.equal(classifyFactualCertainty('Experiments suggest it could have worked, though historians debate it.').level, 'debated');
});

// ---- 7,8,9) sfx yeterlilik/aralık/çeşitlilik ----
test('sfx quality: sayı, aralık ve çeşitlilik doğru hesaplanır', () => {
  const secs = [3, 3, 3, 3, 3, 3, 3, 3];
  const good = sfxQuality({ boundaries: [
    { sfx: 'whoosh' }, { sfx: 'none' }, { sfx: 'impact' }, { sfx: 'none' }, { sfx: 'shimmer' }, { sfx: 'none' }, { sfx: 'none' },
  ] }, secs, { minGap: 3.0 });
  assert.equal(good.count, 3);
  assert.equal(good.distinctCount, 3);
  assert.equal(good.spacedOk, true);
  // Birbirine çok yakın iki sfx → spacedOk false.
  const close = sfxQuality({ boundaries: [{ sfx: 'whoosh' }, { sfx: 'impact' }] }, [1, 1, 1], { minGap: 3.0 });
  assert.equal(close.spacedOk, false);
});

// ---- 4) semantik alaka ----
test('semantik alaka: konuyla ilgili yüksek, alakasız/yasak düşük', () => {
  const nar = 'Vikings used a special crystal to navigate the ship across the sea.';
  const good = semanticRelevanceScore(nar, ['viking ship sailing sea', 'crystal navigation']);
  assert.ok(good.score >= 0.34);
  const bad = semanticRelevanceScore(nar, ['man riding bicycle countryside road']);
  assert.ok(bad.score < 0.34);
  // Yasak-uyumsuzluk tavanı 0.2.
  const forbidden = semanticRelevanceScore(nar, ['bicycle cyclist'], { forbiddenMismatches: ['bicycle', 'cyclist'] });
  assert.ok(forbidden.mismatch && forbidden.score <= 0.2);
});

test('isAssetRelevant: düşük skor/yasak asset reddedilir', () => {
  const nar = 'Vikings used a sunstone crystal to find the hidden sun.';
  assert.equal(isAssetRelevant(nar, 'viking sunstone crystal sky', { minScore: 0.34 }).accepted, true);
  assert.equal(isAssetRelevant(nar, 'person drinking milk kitchen', { minScore: 0.34 }).accepted, false);
  assert.equal(isAssetRelevant(nar, 'cyclist road', { forbiddenMismatches: ['cyclist'] }).accepted, false);
});

// ---- 10) hook mobil okunabilirlik ----
test('hook readability: kısa hook geçer, çok uzun hook ön izlemede küçük kalır', () => {
  const short = assessHookReadability('VIKINGS FOUND THE SUN', { minPreviewPx: 20, maxWords: 7 });
  assert.equal(short.ok, true);
  assert.ok(short.previewPx >= 20);
  // Çok uzun hook → font küçülür → ön izleme px düşer VEYA kelime sınırı aşılır.
  const long = assessHookReadability(
    'This is an extremely long hook line that will never fit and shrinks a lot on mobile', { minPreviewPx: 20, maxWords: 7 });
  assert.equal(long.ok, false);
  assert.equal(previewPx(hookFontPx('SHORT')), previewPx(hookFontPx('SHORT'))); // deterministik
});

// ---- 11) caption güvenli alanda olsa bile düşük okunabilirlik ----
test('caption readability: güvenli alanda olsa bile küçük font yakalanır', () => {
  assert.equal(assessCaptionReadability({ minFontPx: 52, outlinePx: 2.6, minPreviewPx: 15 }).ok, true);
  const small = assessCaptionReadability({ minFontPx: 30, outlinePx: 2.6, minPreviewPx: 15 }); // 30*640/1920=10px
  assert.equal(small.ok, false);
  assert.ok(small.reason.includes('küçük'));
  // Zayıf kenarlık → düşük kontrast.
  assert.equal(assessCaptionReadability({ minFontPx: 60, outlinePx: 1.0 }).ok, false);
});

test('summarizeRelevance: mismatch sayımı ve ortalama', () => {
  assert.deepEqual(summarizeRelevance([]), { count: 0, min: null, mean: null, mismatchCount: 0 });
  const s = summarizeRelevance([0.8, 0.1, 0.5]);
  assert.equal(s.mismatchCount, 1);
  assert.equal(s.min, 0.1);
});

// ---- QC ENTEGRASYONU: Viking-tipi kötü video vs düzeltilmiş ----
/** Viking videosunun raporlanan yapısı: 6 uzun plan, 5.79s ort, 7.26s statik. */
function vikingBad() {
  return {
    script: {
      hook_text: 'Secret Viking compass', // zayıf kontrast değil ama kısa
      finale_text: '', // payoff eksik
      format: 'howworks',
      scenes: [
        { narration: 'Vikings sailed when the sun was hidden by clouds.' },
        { narration: 'They may have used a special crystal called a sunstone.' },
        { narration: 'The crystal splits the light into two beams.' }, // mekanizma — ama gfx yok
        { narration: 'A man rides a bicycle on a country road.' },
        { narration: 'A modern man holds the crystal.' },
        { narration: 'The sun sets over the sea.' },
      ],
    },
    wordTimings: Array.from({ length: 30 }, (_, i) => ({ word: `w${i}`, start: 0.3 + i, end: 0.3 + i + 0.5 })),
    itemSeconds: [6.0, 6.0, 6.0, 6.0, 6.0, 5.0], // ort 5.83s, statik 6s
    itemTypes: ['photo', 'photo', 'photo', 'photo', 'photo', 'photo'],
    itemSources: ['stock', 'stock', 'ai', 'stock', 'ai', 'stock'],
    editPlan: { boundaries: [{ sfx: 'whoosh' }, { sfx: 'none' }, { sfx: 'none' }, { sfx: 'none' }, { sfx: 'none' }], subscribeScene: 3 },
    duration: 35, lufs: -14, audioPresent: true,
    itemRelevance: [0.6, 0.7, 0.5, 0.05, 0.4, 0.5], // 4. sahne (bisiklet) alakasız
  };
}

test('1,3) uzun statik/az plan pacing cezası alır ve fix üretir', () => {
  const r = evaluateRetention(vikingBad(), CFG);
  assert.ok(r.parts.visualPacing < 12, `pacing ${r.parts.visualPacing} çok yüksek`);
  assert.ok(r.recommendedFixes.some((f) => f.includes('statik plan')));
  assert.ok(r.metrics.averageVisualEventInterval > 3.2);
  assert.ok(r.metrics.longestStaticSegment > 4.0);
});

test('2) sıkı tempolu video pacing tam puana yaklaşır', () => {
  const good = { ...vikingBad(),
    itemSeconds: [3.0, 3.2, 3.0, 3.2, 3.0, 3.2, 3.0, 3.2, 3.0, 3.2, 3.0],
    itemTypes: ['video', 'photo', 'photo', 'video', 'photo', 'video', 'photo', 'video', 'photo', 'video', 'photo'],
    itemSources: ['stock', 'archive', 'gfx', 'stock', 'ai', 'stock', 'archive', 'stock', 'ai', 'stock', 'ai'],
    editPlan: { boundaries: Array.from({ length: 10 }, (_, i) => ({ sfx: i % 3 === 0 ? 'whoosh' : 'none' })), subscribeScene: 9 },
    duration: 34,
    itemRelevance: [],
  };
  const r = evaluateRetention(good, CFG);
  assert.ok(r.metrics.averageVisualEventInterval <= 3.2);
  assert.ok(r.parts.visualPacing >= 17, `pacing ${r.parts.visualPacing}`);
  assert.ok(r.metrics.patternInterrupts >= 5);
});

test('4) alakasız görsel semantic mismatch olarak yakalanır', () => {
  const r = evaluateRetention(vikingBad(), CFG);
  assert.equal(r.metrics.semanticRelevance.mismatchCount, 1);
  assert.ok(r.recommendedFixes.some((f) => f.includes('alakasız')));
});

test('5) mekanizma videosu diagram yoksa merak/bütünlük puanı düşer + fix', () => {
  const r = evaluateRetention(vikingBad(), CFG);
  assert.equal(r.metrics.mechanism.isMechanism, true);
  assert.equal(r.metrics.mechanism.hasExplanatoryVisual, false);
  assert.ok(r.recommendedFixes.some((f) => f.includes('açıklayıcı görsel')));
});

test('6) erken CTA payoff puanı düşürür', () => {
  const r = evaluateRetention(vikingBad(), CFG); // subscribeScene 3 / 6 = 0.5 < 0.7
  assert.ok(r.recommendedFixes.some((f) => f.includes('CTA') || f.includes('Abone')));
});

test('7) tek sfx audioDesign hedefini geçemez', () => {
  const oneSfx = { ...vikingBad(),
    editPlan: { boundaries: [{ sfx: 'whoosh' }, { sfx: 'none' }, { sfx: 'none' }, { sfx: 'none' }, { sfx: 'none' }], subscribeScene: 5 } };
  const r = evaluateRetention(oneSfx, CFG);
  assert.equal(r.metrics.sfxCount, 1);
  assert.ok(r.parts.audioDesign < 8);
  assert.ok(r.recommendedFixes.some((f) => f.includes('sfx')));
});

test('8) 3-5 zamanlı sfx audioDesign puanı kazandırır', () => {
  const r = evaluateRetention(vikingBad(), CFG); // whoosh tek → düşük
  const goodSfx = { ...vikingBad(),
    itemSeconds: [6, 6, 6, 6, 6, 5],
    editPlan: { boundaries: [{ sfx: 'whoosh' }, { sfx: 'shimmer' }, { sfx: 'none' }, { sfx: 'impact' }, { sfx: 'none' }], subscribeScene: 5 } };
  const rg = evaluateRetention(goodSfx, CFG);
  assert.equal(rg.metrics.sfxCount, 3);
  assert.ok(rg.parts.audioDesign > r.parts.audioDesign);
});

test('13) tartışmalı iddia kesin dille yazılırsa factual certainty fix', () => {
  const overclaim = { ...vikingBad() };
  overclaim.script = { ...overclaim.script,
    scenes: [...overclaim.script.scenes, { narration: 'Vikings definitely used this crystal, it is proven.' }] };
  const r = evaluateRetention(overclaim, CFG);
  assert.equal(r.metrics.factualCertainty.overclaim, true);
  assert.ok(r.recommendedFixes.some((f) => f.includes('yumuşat')));
});

test('12) patternInterrupts metriği rapora yazılır', () => {
  const r = evaluateRetention(vikingBad(), CFG);
  assert.equal(typeof r.metrics.patternInterrupts, 'number');
  assert.ok(Array.isArray(r.metrics.patternInterruptIndices));
  assert.ok(Array.isArray(r.metrics.sfxCues));
});
