import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { directScenes } from '../src/pipeline/sceneDirector.js';
import { buildEditorCritique, attentionForecast } from '../src/pipeline/editorCritique.js';
import { evaluateRetention, runRetentionQC } from '../src/pipeline/retentionQC.js';
import { config } from '../src/config.js';

const CFG = {
  mode: 'warning', minScore: 85, qualityTarget: 90, maxStaticSegmentSeconds: 4.0,
  targetVisualEventInterval: 3.2, minVisualEvents: 10, minPatternInterrupts: 3, idealPatternInterrupts: 5,
  firstSpeechDeadlineMs: 900, maxHookChars: 30, maxHookWords: 7, minCaptionPx: 50, maxCaptionWords: 4,
  minAudibleSfx: 3, maxAudibleSfx: 6, minSfxGapSeconds: 3.0, ctaEarliestRatio: 0.7, minSemanticRelevance: 0.34,
  hookMinPreviewPx: 20, captionMinPreviewPx: 15,
};

function badInput() {
  return {
    script: {
      hook_text: 'How did they vanish',
      finale_text: 'the sea took them',
      format: 'story',
      scenes: [
        { narration: 'How did the whole crew vanish overnight?' },
        { narration: 'The ship drifted for weeks near the coast.' },
        { narration: 'Investigators found the crew simply gone.' },
        { narration: 'A random bird flies over a field.' },
        { narration: 'The sea took them and never gave them back.' },
      ],
    },
    wordTimings: Array.from({ length: 20 }, (_, i) => ({ word: `w${i}`, start: 0.3 + i, end: 0.3 + i + 0.6 })),
    itemSeconds: [7.0, 7.0, 6.5, 6.5, 6.0], // uzun statik
    itemTypes: ['photo', 'photo', 'photo', 'photo', 'photo'],
    itemSources: ['ai', 'ai', 'ai', 'stock', 'ai'], // AI ağırlıklı
    itemRelevance: [0.6, 0.6, 0.6, 0.05, 0.6], // 4. sahne alakasız
    editPlan: { boundaries: [{ sfx: 'whoosh' }, { sfx: 'none' }, { sfx: 'none' }, { sfx: 'none' }], subscribeScene: 2 },
    duration: 33, lufs: -14, audioPresent: true,
  };
}

// ---- Sahne Yönetmeni ----
test('directScenes: her plan için amaç/duygu/risk/interrupt üretir', () => {
  const cards = directScenes(badInput());
  assert.equal(cards.length, 5);
  assert.equal(cards[0].purpose, 'hook/question');
  assert.ok(['low', 'medium', 'high'].includes(cards[0].retentionRisk));
  // Uzun statik + kesintisiz + alakasız 4. plan yüksek risk.
  assert.equal(cards[3].retentionRisk, 'high');
  assert.equal(cards[0].startSeconds, 0);
  assert.ok(cards[1].startSeconds > 0);
});

// ---- İnsan gözü simülasyonu ----
test('attentionForecast: uzun statik sahne yüksek kaydırma riski, reveal şaşırtır', () => {
  const cards = directScenes(badInput());
  const f = attentionForecast(cards, { twistScenes: new Set() });
  assert.equal(f.length, 5);
  assert.ok(f.some((x) => x.swipeRisk >= 0.7), 'hiç yüksek kaydırma riski yok');
  assert.ok(f.every((x) => x.boredomRisk >= 0 && x.boredomRisk <= 1));
});

// ---- Editör eleştirisi ----
test('buildEditorCritique: en sıkıcı an, görsel/anlatım tekrarı, en iyi iyileştirme', () => {
  const input = badInput();
  const r = evaluateRetention(input, CFG);
  const { editorCritique, attentionForecast: fc } = buildEditorCritique(input, r);
  assert.ok(editorCritique.mostBoringMoment, 'en sıkıcı an bulunamadı');
  assert.equal(editorCritique.visualRepetition.aiShare, 0.8); // 4/5 AI
  assert.ok(editorCritique.weakestScene.plan === 3, `zayıf sahne ${editorCritique.weakestScene.plan}`);
  assert.ok(typeof editorCritique.bestImprovement === 'string' && editorCritique.bestImprovement.length > 0);
  assert.ok(['low', 'medium', 'high'].includes(editorCritique.overallRetentionRisk));
  assert.equal(fc.length, 5);
});

test('görsel tekrar: 4/5 AI yüksek aiShare, düşük distinctSources', () => {
  const r = evaluateRetention(badInput(), CFG);
  assert.equal(r.metrics.visualRepetition.aiShare, 0.8);
  assert.ok(r.recommendedFixes.some((f) => f.includes('Görsel çeşitlilik')));
});

// ---- Loop (film yapısı) ----
test('loop: finale hook kelimesini kapatırsa closed=true', () => {
  const looped = badInput();
  looped.script.hook_text = 'Why did the sea swallow them';
  looped.script.finale_text = 'the sea took them all';
  const r = evaluateRetention(looped, CFG);
  assert.equal(r.metrics.loop.closed, true);
  // Kapanmayan loop fix üretir.
  const broken = badInput();
  broken.script.hook_text = 'A strange machine';
  broken.script.finale_text = 'nobody ever knew';
  const rb = evaluateRetention(broken, CFG);
  assert.equal(rb.metrics.loop.closed, false);
  assert.ok(rb.recommendedFixes.some((f) => f.includes('Loop yok')));
});

// ---- Kalite hedefi 90 + iyileştirme planı (upload kapısı DEĞİL) ----
test('qualityTarget 90 altı: improvementPlan üretir ama upload kapısını değiştirmez', async () => {
  const orig = { ...config.retention };
  const dir = await mkdtemp(path.join(os.tmpdir(), 'qc-qt-'));
  try {
    config.retention.mode = 'warning';
    config.retention.minScore = 85;
    config.retention.qualityTarget = 90;
    const res = await runRetentionQC(badInput(), dir, { technicalPassed: true, uploadRequested: true, platforms: {} });
    const json = JSON.parse(await readFile(path.join(dir, 'production-report.json'), 'utf8'));
    assert.equal(json.qualityTarget, 90);
    assert.equal(json.belowQualityTarget, json.retentionScore < 90);
    if (json.belowQualityTarget) assert.ok(json.improvementPlan.length > 0);
    // Editör eleştirisi + dikkat tahmini rapora yazıldı.
    assert.ok(json.editorCritique, 'editorCritique raporda yok');
    assert.ok(Array.isArray(json.attentionForecast));
    // warning modda düşük skor upload'u ENGELLEMEZ (kapı değişmedi).
    assert.equal(res.blockUpload, false);
    // production-report.md editör bölümünü içerir.
    const md = await readFile(path.join(dir, 'production-report.md'), 'utf8');
    assert.ok(md.includes('Editör Eleştirisi'));
  } finally {
    Object.assign(config.retention, orig);
    await rm(dir, { recursive: true, force: true });
  }
});

test('yüksek skorlu video kalite hedefini geçer, improvementPlan boş', async () => {
  const orig = { ...config.retention };
  const dir = await mkdtemp(path.join(os.tmpdir(), 'qc-hi-'));
  try {
    Object.assign(config.retention, { mode: 'warning', minScore: 85, qualityTarget: 90 });
    // Güçlü fixture (retention.test.js'teki yapı) — 90+ almalı.
    const strong = {
      script: {
        hook_text: "This machine shouldn't exist",
        finale_text: 'one gear still keeps its machine secret',
        format: 'story',
        scenes: Array.from({ length: 7 }, (_, i) => ({ narration: `Detail ${i} but the truth turns out stranger until revealed.` })),
      },
      wordTimings: Array.from({ length: 40 }, (_, i) => ({ word: `w${i}`, start: 0.3 + i * 0.8, end: 0.3 + i * 0.8 + 0.5 })),
      itemSeconds: [3.0, 3.2, 3.0, 3.2, 3.0, 3.2, 3.0, 3.2, 3.0, 3.0, 3.4],
      itemTypes: ['video', 'photo', 'photo', 'video', 'photo', 'video', 'photo', 'video', 'photo', 'video', 'photo'],
      itemSources: ['stock', 'archive', 'gfx', 'stock', 'ai', 'stock', 'archive', 'stock', 'ai', 'stock', 'archive'],
      editPlan: { boundaries: Array.from({ length: 10 }, (_, i) => ({ sfx: i === 0 ? 'whoosh' : i === 3 ? 'impact' : i === 6 ? 'shimmer' : 'none' })), subscribeScene: 10 },
      duration: 34, lufs: -14, audioPresent: true, itemRelevance: [],
    };
    const res = await runRetentionQC(strong, dir, { technicalPassed: true, uploadRequested: true, platforms: {} });
    assert.ok(res.score >= 90, `skor ${res.score} < 90`);
    assert.equal(res.report.belowQualityTarget, false);
    assert.equal(res.report.improvementPlan.length, 0);
  } finally {
    Object.assign(config.retention, orig);
    await rm(dir, { recursive: true, force: true });
  }
});
