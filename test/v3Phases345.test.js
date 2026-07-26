import test from 'node:test';
import assert from 'node:assert/strict';
import { selectSceneMotion } from '../src/video/motionPlan.js';
import { planScene } from '../src/crew/storyPlanner.js';
import { assessVisualNarration } from '../src/pipeline/visualNarrationQC.js';

const cam = (narration) => ({ narration, camera_plan: planScene({ narration }).camera_plan });

// ================= FAZ 3: KAMERANIN GEREKÇESİ =================
test('kamera hikâyeden türer, gerekçesi raporlanır', () => {
  const m = selectSceneMotion(cam('Warm air rises through the interior chamber'),
    { type: 'photo' }, { index: 3 });
  assert.match(m.reason, /^story:/, 'kamera gerekçesi hikâyeden gelmiyor');
});

test('OKUMA gereken şablonlarda kamera BİLİNÇLİ DURUR', () => {
  // Audit: "kamera hareket ediyor ama amacı yok". Karşılaştırma ve adım
  // zincirinde hareket okumayla yarışır → durmalı.
  const karsilastirma = selectSceneMotion(cam('Reef fish are twice as fast as their predators'),
    { type: 'photo' }, { index: 2 });
  assert.equal(karsilastirma.type, 'static-hold', 'karşılaştırmada kamera hareket ediyor');
  assert.equal(karsilastirma.maxZoom, 1);
});

test('ölçek/miktar şablonu GERİ ÇEKİLİR (büyüklük hissi)', () => {
  const m = selectSceneMotion(cam('The nest is as tall as a two storey house'),
    { type: 'photo' }, { index: 3 });
  assert.equal(m.type, 'slow-pull-out');
});

test('inşa şablonu YUKARI yükselir', () => {
  const m = selectSceneMotion(cam('Workers build the tower layer by layer'),
    { type: 'photo' }, { index: 2 });
  assert.equal(m.type, 'slow-pan-up');
});

test('aynı şablon tekrarında yön çevrilir (monotonluk kırılır)', () => {
  const s = cam('A termite walks out and marks the ground');
  const a = selectSceneMotion(s, { type: 'photo' }, { index: 2 });
  const b = selectSceneMotion(s, { type: 'photo' }, { index: 3 });
  assert.notEqual(a.type, b.type, 'aynı şablon üst üste aynı kamerayı verdi');
});

test('hikâye planı yoksa eski davranış korunur', () => {
  const m = selectSceneMotion({ narration: 'a wide landscape' }, { type: 'photo' }, { index: 2 });
  assert.ok(m.reason && !m.reason.startsWith('story:'), 'plansız sahne story gerekçesi aldı');
});

// ================= FAZ 5: SESSİZ ANLAŞILIRLIK =================
const okItems = (n) => Array.from({ length: n }, (_, i) => ({
  visualHash: ((BigInt(i) * 0x9E3779B97F4A7C15n) % (2n ** 64n)).toString(16), assetId: `a${i}`,
}));
const okBeats = [
  { kind: 'behavior', index: 0, start: 1 }, { kind: 'number', index: 2, start: 8 },
  { kind: 'process', index: 4, start: 15 }, { kind: 'compare', index: 6, start: 22 },
];

test('QC: mikro plan azsa uyarır', () => {
  const r = assessVisualNarration({
    items: okItems(12), beats: okBeats, motionPlan: new Array(12).fill({}), duration: 40,
  });
  assert.ok(r.metrics.microShots === 12);
  assert.ok(r.warnings.some((w) => /mikro plan/.test(w)), JSON.stringify(r.warnings));
});

test('QC: mikro plan hedefteyse uyarı YOK', () => {
  const r = assessVisualNarration({
    items: okItems(21), beats: okBeats, motionPlan: new Array(21).fill({}), duration: 40,
  });
  assert.ok(!r.warnings.some((w) => /mikro plan/.test(w)));
});

test('QC: aktörlü sahne oranı ölçülür ve düşükse uyarır', () => {
  const r = assessVisualNarration({
    items: okItems(20), beats: okBeats, motionPlan: new Array(10).fill({}), duration: 40,
    actorStats: { actorScenes: 2, cardScenes: 8 },   // %20
  });
  assert.equal(r.metrics.actorRatio, 0.2);
  assert.ok(r.warnings.some((w) => /aktörlü sahne/.test(w)), JSON.stringify(r.warnings));
});

test('QC: aktör oranı hedefteyse uyarı YOK', () => {
  const r = assessVisualNarration({
    items: okItems(20), beats: okBeats, motionPlan: new Array(10).fill({}), duration: 40,
    actorStats: { actorScenes: 7, cardScenes: 3 },   // %70
  });
  assert.equal(r.metrics.actorRatio, 0.7);
  assert.ok(!r.warnings.some((w) => /aktörlü sahne/.test(w)));
});

test('QC: izleyici görevi sayılır', () => {
  const scenes = [{ viewer_task: 'Follow the trail' }, { viewer_task: 'Find the odd one' }, {}];
  const r = assessVisualNarration({
    items: okItems(20), beats: okBeats, motionPlan: new Array(10).fill({}), duration: 40, scenes,
  });
  assert.equal(r.metrics.viewerTasks, 2);
  assert.ok(r.warnings.some((w) => /izleyici görevi/.test(w)));
});

test('QC: sahnelerin çoğu hikâyesizse BAŞARISIZ', () => {
  // Hepsi 'atmosphere' → video hikâye anlatmıyor, sadece güzel resim gösteriyor.
  const scenes = Array.from({ length: 10 }, () => ({ story_template: 'atmosphere' }));
  const r = assessVisualNarration({
    items: okItems(20), beats: okBeats, motionPlan: new Array(10).fill({}), duration: 40, scenes,
  });
  assert.equal(r.passed, false);
  assert.ok(r.failures.some((f) => f.startsWith('STORY_TEMPLATES_TOO_THIN')), JSON.stringify(r.failures));
});

test('QC: hikâyeli sahne dağılımı GEÇER', () => {
  const scenes = [
    { story_template: 'mechanism', viewer_task: 'x' }, { story_template: 'flow', viewer_task: 'x' },
    { story_template: 'quantity', viewer_task: 'x' }, { story_template: 'comparison', viewer_task: 'x' },
    { story_template: 'atmosphere' },
  ];
  const r = assessVisualNarration({
    items: okItems(21), beats: okBeats, motionPlan: new Array(10).fill({}), duration: 40,
    scenes, actorStats: { actorScenes: 7, cardScenes: 3 },
  });
  assert.equal(r.passed, true, JSON.stringify(r.failures));
  assert.equal(r.metrics.atmosphereOnly, 1);
  assert.equal(r.metrics.storyTemplates.mechanism, 1);
});

test('QC: V3 alanları verilmezse eski davranış bozulmaz', () => {
  const r = assessVisualNarration({
    items: okItems(20), beats: okBeats, motionPlan: new Array(10).fill({}), duration: 40,
  });
  assert.equal(r.metrics.actorRatio, null);
  assert.equal(r.metrics.viewerTasks, 0);
  assert.equal(r.passed, true, JSON.stringify(r.failures));
});
