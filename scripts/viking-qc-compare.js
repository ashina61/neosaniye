#!/usr/bin/env node
import { evaluateRetention } from '../src/pipeline/retentionQC.js';
import { config } from '../src/config.js';

/**
 * Viking sunstone videosu: ESKİ (6 uzun plan, raporlanan 74/100) yapısı vs
 * ÖNERİLEN YENİ AKIŞ (11-12 anlamlı görsel olay) — deterministik QC karşılaştırması.
 * Ağ gerektirmez; gerçek render bir sonraki üretimde yapılır.
 */
const cfg = config.retention;

// ---- ESKİ: raporlanan yapı (0-6 gemi, 6-12 el/kristal, ... 30-35 gün batımı) ----
const OLD = {
  script: {
    hook_text: 'Secret Viking compass',
    finale_text: '',
    format: 'howworks',
    scenes: [
      { narration: 'Vikings sailed even when clouds hid the sun.' },
      { narration: 'They may have used a crystal called a sunstone.' },
      { narration: 'The crystal splits sunlight into two beams.' },
      { narration: 'A man rides a bicycle down a country road.' },
      { narration: 'A modern man holds the crystal up.' },
      { narration: 'The sun sets over a calm sea.' },
    ],
  },
  wordTimings: Array.from({ length: 30 }, (_, i) => ({ word: `w${i}`, start: 0.3 + i, end: 0.3 + i + 0.6 })),
  itemSeconds: [6.0, 6.0, 6.0, 6.0, 6.0, 5.0],
  itemTypes: ['photo', 'photo', 'photo', 'photo', 'photo', 'photo'],
  itemSources: ['stock', 'stock', 'ai', 'stock', 'ai', 'stock'],
  editPlan: { boundaries: [{ sfx: 'whoosh' }, { sfx: 'none' }, { sfx: 'none' }, { sfx: 'none' }, { sfx: 'none' }], subscribeScene: 3 },
  duration: 35, lufs: -14, audioPresent: true,
  itemRelevance: [0.6, 0.7, 0.5, 0.05, 0.4, 0.5],
};

// ---- YENİ: önerilen akış, ~11 görsel olay, diagram + oklar + loop + 4 sfx ----
const NEW = {
  script: {
    hook_text: 'Vikings found the hidden sun',
    finale_text: 'by finding the sun they could not see',
    format: 'howworks',
    scenes: [
      { narration: 'How did Vikings find the sun through thick clouds?' },
      { narration: 'For days, heavy cloud hid the sun over the open sea.' },
      { narration: 'They may have used a special crystal, a sunstone.' },
      { narration: 'Light enters the crystal and bends inside it.' },
      { narration: 'Inside, the beam splits into two separate images.' },
      { narration: 'Turning the crystal changes which image looks brighter.' },
      { narration: 'When both match, an arrow points to the hidden sun.' },
      { narration: 'A Viking navigator reads the sky and sets the course.' },
      { narration: 'On the map, a line traces the true heading north.' },
      { narration: 'Modern experiments suggest the method could have worked.' },
      { narration: 'The ship turns onto its route as the story comes full circle.' },
    ],
  },
  wordTimings: Array.from({ length: 44 }, (_, i) => ({ word: `w${i}`, start: 0.25 + i * 0.72, end: 0.25 + i * 0.72 + 0.45 })),
  // 11 plan / 34.5s → ort 3.14s; en uzun statik 3.6s.
  itemSeconds: [3.0, 3.2, 3.0, 3.4, 3.6, 3.0, 3.2, 3.0, 3.2, 3.0, 3.9],
  itemTypes: ['photo', 'video', 'photo', 'photo', 'photo', 'photo', 'photo', 'video', 'photo', 'video', 'video'],
  // gfx = ışık→ikiye ayrılma→yön diagramı (mekanizma açıklayıcı görseli)
  itemSources: ['ai', 'stock', 'archive', 'gfx', 'gfx', 'gfx', 'gfx', 'stock', 'gfx', 'stock', 'stock'],
  editPlan: {
    boundaries: [
      { sfx: 'whoosh' }, { sfx: 'none' }, { sfx: 'shimmer' }, { sfx: 'none' }, { sfx: 'none' },
      { sfx: 'none' }, { sfx: 'riser' }, { sfx: 'none' }, { sfx: 'none' }, { sfx: 'impact' },
    ],
    subscribeScene: null, // CTA kaldırıldı (payoff/loop öncelikli)
  },
  duration: 34.5, lufs: -14, audioPresent: true,
  itemRelevance: [0.7, 0.6, 0.6, 0.9, 0.9, 0.9, 0.9, 0.7, 0.8, 0.6, 0.7],
};

function show(label, input) {
  const r = evaluateRetention(input, cfg);
  console.log(`\n===== ${label} =====`);
  console.log(`SKOR: ${r.score}/100  (${r.score >= cfg.minScore ? '✅ ≥85' : '⚠️ <85'})`);
  console.log('kategoriler:', JSON.stringify(r.parts));
  const m = r.metrics;
  console.log(`sahne: ${input.script.scenes.length} | ort. görsel olay aralığı: ${m.averageVisualEventInterval}s | en uzun statik: ${m.longestStaticSegment}s`);
  console.log(`pattern interrupts: ${m.patternInterrupts} | sfx: ${m.sfxCount} | semantik mismatch: ${m.semanticRelevance.mismatchCount}`);
  console.log(`mekanizma açıklayıcı görsel: ${m.mechanism.hasExplanatoryVisual} | overclaim: ${m.factualCertainty.overclaim} | finale: ${input.script.finale_text ? 'var' : 'YOK'}`);
  console.log('sfx cue planı (sn):', JSON.stringify(m.sfxCues));
  if (r.recommendedFixes.length) console.log('fixler:\n  - ' + r.recommendedFixes.join('\n  - '));
  return r;
}

const oldR = show('ESKİ (raporlanan yapı ≈ 74/100)', OLD);
const newR = show('YENİ (önerilen akış)', NEW);
console.log('\n===== KARŞILAŞTIRMA =====');
const row = (k, o, n) => console.log(`${k.padEnd(30)} ESKİ: ${String(o).padEnd(10)} YENİ: ${n}`);
row('skor', oldR.score, newR.score);
row('sahne/plan', OLD.itemSeconds.length, NEW.itemSeconds.length);
row('ort. görsel olay aralığı', oldR.metrics.averageVisualEventInterval, newR.metrics.averageVisualEventInterval);
row('en uzun statik segment', oldR.metrics.longestStaticSegment, newR.metrics.longestStaticSegment);
row('pattern interrupts', oldR.metrics.patternInterrupts, newR.metrics.patternInterrupts);
row('sfx sayısı', oldR.metrics.sfxCount, newR.metrics.sfxCount);
row('semantik mismatch', oldR.metrics.semanticRelevance.mismatchCount, newR.metrics.semanticRelevance.mismatchCount);
row('mekanizma görseli', oldR.metrics.mechanism.hasExplanatoryVisual, newR.metrics.mechanism.hasExplanatoryVisual);
