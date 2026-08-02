/**
 * FINAL VIDEO VALIDATOR — "tek gerçek kaynak çıkan MP4'tür."
 *
 * Bu dosyanın çekirdek testi SENTETİK ama GERÇEK bir MP4 üretir: içine bilerek
 * bir tekrar eden plan ve bir plan-dışı bindirme koyar, sonra doğrulayıcının
 * bunları bulduğunu kanıtlar. Yer gerçeği bizde olduğu için sonuç tartışmasız.
 *
 * Denetimde öğrenilen ve burada kilitlenen iki kural:
 *  1. ARDIŞIK benzer kareler aynı klibin kendisidir — kusur DEĞİL. Kusur,
 *     bir görüntünün ARADAN SONRA yeniden belirmesidir. (İlk denemede bu ayrım
 *     yapılmadığı için 14 "kopya" bulunmuştu; hepsi normal klipti.)
 *  2. Bindirme tespiti mutlak renk/parlaklık eşiğiyle YAPILAMAZ; kuşun beyaz
 *     göğsü "hook yazısı", kırmızı çiçek "subscribe pili" sanılıyordu. Yapısal
 *     dHash + planlanan pencereden referans şart.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  validateFinalVideo, verifyTimelineOrder, findOccurrences, hamming,
} from '../src/pipeline/finalVideoValidator.js';
import { buildRunIntegrity, verifyRunIntegrity, chainOf, stableStringify } from '../src/pipeline/runIntegrity.js';

const run = promisify(execFile);
const hasFfmpeg = await run('ffmpeg', ['-version']).then(() => true).catch(() => false);

/** Renk bloklarından gerçek bir MP4 kur. spec: [{color, seconds}] */
async function buildVideo(dir, name, spec) {
  const parts = [];
  for (let i = 0; i < spec.length; i += 1) {
    const p = path.join(dir, `p${i}.mp4`);
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi',
      '-i', `color=c=${spec[i].color}:s=360x640:d=${spec[i].seconds}:r=10`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', p]);
    parts.push(p);
  }
  const list = path.join(dir, 'list.txt');
  await run('sh', ['-c', `printf "file '%s'\\n" ${parts.map((p) => `'${p}'`).join(' ')} > ${list}`]);
  const out = path.join(dir, name);
  await run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list,
    '-c', 'copy', out]);
  return out;
}

// ---------------- TIMELINE SIRASI ----------------
test('geçerli timeline kabul edilir', () => {
  const r = verifyTimelineOrder([
    { id: 'scene_00_clip_00', scene: 0, sequence: 0, renderOrder: 0, start: 0, end: 3 },
    { id: 'scene_00_clip_01', scene: 0, sequence: 1, renderOrder: 1, start: 3, end: 5 },
    { id: 'scene_01_clip_00', scene: 1, sequence: 0, renderOrder: 2, start: 5, end: 8 },
  ]);
  assert.equal(r.valid, true, JSON.stringify(r.problems));
});

test('scene_04 önce gelirse OUT_OF_ORDER', () => {
  // "scene_03_clip_02, scene_04_clip_00'dan önce gelmeli."
  const r = verifyTimelineOrder([
    { id: 'scene_04_clip_00', scene: 4, sequence: 0, renderOrder: 0, start: 0, end: 3 },
    { id: 'scene_03_clip_02', scene: 3, sequence: 2, renderOrder: 1, start: 3, end: 6 },
  ]);
  assert.equal(r.valid, false);
  assert.ok(r.problems.some((p) => p.startsWith('OUT_OF_ORDER')), JSON.stringify(r.problems));
});

test('zaman çakışması, tekrar eden id ve eksik id yakalanır', () => {
  const overlap = verifyTimelineOrder([
    { id: 'a', scene: 0, sequence: 0, start: 0, end: 4 },
    { id: 'b', scene: 0, sequence: 1, start: 2, end: 6 },
  ]);
  assert.ok(overlap.problems.some((p) => p.startsWith('OVERLAP')));
  const dup = verifyTimelineOrder([
    { id: 'same', scene: 0, sequence: 0, start: 0, end: 2 },
    { id: 'same', scene: 0, sequence: 1, start: 2, end: 4 },
  ]);
  assert.ok(dup.problems.includes('DUPLICATE_CLIP_ID'));
  const noId = verifyTimelineOrder([{ scene: 0, sequence: 0, start: 0, end: 2 }]);
  assert.ok(noId.problems.some((p) => p.startsWith('MISSING_ID')));
});

test('render sırası indeksle uyuşmazsa yakalanır', () => {
  const r = verifyTimelineOrder([
    { id: 'a', scene: 0, sequence: 0, renderOrder: 5, start: 0, end: 2 },
  ]);
  assert.ok(r.problems.some((p) => p.startsWith('RENDER_ORDER_MISMATCH')));
});

// ---------------- BİNDİRME: PLANLI / PLANSIZ ----------------
test('bindirme planlanan pencerede ise "planlı", dışındaysa "plansız"', () => {
  // 0-2s'de A deseni, 6-7s'de AYNI desen tekrar (plansız).
  const A = 0b1010101010101010101010101010101010101010101010101010101010101010n;
  const B = 0b0101010101010101010101010101010101010101010101010101010101010101n;
  const fps = 2;
  const hashes = [];
  for (let i = 0; i < 20; i += 1) {
    const t = i / fps;
    hashes.push((t < 2) || (t >= 6 && t < 7) ? A : B);
  }
  const r = findOccurrences(hashes, [[0, 2]], fps, 4);
  assert.equal(r.planned.length, 1);
  assert.equal(r.unplanned.length, 1, JSON.stringify(r));
  assert.ok(r.unplanned[0].start >= 5.9 && r.unplanned[0].start <= 6.2);
});

test('planlanan pencere yoksa referans kurulamaz (yanlış güven üretme)', () => {
  const r = findOccurrences([1n, 2n, 3n], [], 2, 8);
  assert.deepEqual(r, { planned: [], unplanned: [], exempt: [], reference: null });
});

test('hamming mesafesi doğru', () => {
  assert.equal(hamming(0b1011n, 0b1011n), 0);
  assert.equal(hamming(0b1011n, 0b0000n), 3);
});

// ---------------- GERÇEK MP4 ----------------
test('ARDIŞIK benzer kareler kopya SAYILMAZ (yanlış pozitif regresyonu)',
  { skip: !hasFfmpeg && 'ffmpeg yok' }, async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'fvv-a-'));
    try {
      // Üç ayrı klip, hiçbiri tekrar etmiyor. Her klip 4sn → içinde onlarca
      // birbirinin aynısı kare var; bunlar kusur değildir.
      //
      // RENK SEÇİMİ TUZAĞI: ffmpeg renk ADLARI CSS'tir; 'green' #008000'dir ve
      // parlaklığı (0.587·128 ≈ 75) 'red'inkine (0.299·255 ≈ 76) neredeyse
      // eşittir. Düz alanlarda dHash zaten kör olduğu için bu iki blok TEK
      // grup olur ve test iddia ettiği şeyi ölçmez. Bu yüzden bloklar
      // parlaklık ekseninde gerçekten ayrık seçilir: red / white / blue.
      const v = await buildVideo(dir, 'clean.mp4', [
        { color: 'red', seconds: 4 }, { color: 'white', seconds: 4 }, { color: 'blue', seconds: 4 },
      ]);
      const r = await validateFinalVideo(v, { duration: 12, clips: [] }, { fps: 2 });
      assert.deepEqual(r.duplicateShots, [], JSON.stringify(r.duplicateShots));
      assert.ok(!r.failures.some((f) => f.startsWith('DUPLICATE_SHOT')), JSON.stringify(r.failures));
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

test('ARADAN SONRA tekrar eden plan YAKALANIR',
  { skip: !hasFfmpeg && 'ffmpeg yok' }, async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'fvv-b-'));
    try {
      // 1. klip sonda AYNEN tekrar ediyor → gerçek kusur.
      const v = await buildVideo(dir, 'dup.mp4', [
        { color: 'red', seconds: 3 }, { color: 'white', seconds: 3 },
        { color: 'blue', seconds: 3 }, { color: 'red', seconds: 3 },
      ]);
      const r = await validateFinalVideo(v, { duration: 12, clips: [] }, { fps: 2 });
      assert.ok(r.duplicateShots.length >= 1, 'tekrar eden plan bulunamadı');
      // Tekrar GERÇEKTEN ilk kliple son klip arasında olmalı; araya giren
      // bloklarla birleşmiş bir grup bu iddiayı karşılamaz.
      assert.deepEqual(r.duplicateShots[0].runs, [[0, 3], [9, 12]], JSON.stringify(r.duplicateShots));
      assert.ok(r.failures.some((f) => f.startsWith('DUPLICATE_SHOT')), JSON.stringify(r.failures));
      assert.equal(r.ok, false);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

test('KASITLI döngü kapanışı kopya sayılmaz (muafiyet çalışıyor)',
  { skip: !hasFfmpeg && 'ffmpeg yok' }, async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'fvv-c-'));
    try {
      const v = await buildVideo(dir, 'loop.mp4', [
        { color: 'red', seconds: 3 }, { color: 'white', seconds: 3 },
        { color: 'blue', seconds: 3 }, { color: 'red', seconds: 3 },
      ]);
      // Son 3 saniye BİLİNÇLİ loop kapanışı olarak bildirilir.
      const r = await validateFinalVideo(v, {
        duration: 12, clips: [], loopEchoWindows: [[9, 12]],
      }, { fps: 2 });
      assert.deepEqual(r.duplicateShots, [], JSON.stringify(r.duplicateShots));
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

test('süre uyuşmazlığı yakalanır', { skip: !hasFfmpeg && 'ffmpeg yok' }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fvv-d-'));
  try {
    const v = await buildVideo(dir, 'short.mp4', [{ color: 'gray', seconds: 4 }]);
    const r = await validateFinalVideo(v, { duration: 30, clips: [] }, { fps: 2 });
    assert.ok(r.failures.some((f) => f.startsWith('DURATION_MISMATCH')), JSON.stringify(r.failures));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('okunamayan dosya "doğrulandı" sayılmaz', async () => {
  const r = await validateFinalVideo('/yok/boyle/bir/dosya.mp4', { duration: 10 }, { fps: 2 });
  assert.equal(r.ok, false);
  assert.ok(r.failures.includes('FINAL_VIDEO_UNREADABLE'));
});

// ---------------- RUN INTEGRITY ----------------
test('zincir özeti anahtar sırasından bağımsız', () => {
  assert.equal(chainOf({ a: '1', b: '2' }), chainOf({ b: '2', a: '1' }));
  assert.equal(stableStringify({ b: 1, a: 2 }), stableStringify({ a: 2, b: 1 }));
});

test('herhangi bir parça değişince zincir değişir', () => {
  const base = { script: 'x', scenePlan: 'y', renderPlan: 'z', finalVideo: 'v' };
  const h0 = chainOf(base);
  for (const k of Object.keys(base)) {
    assert.notEqual(chainOf({ ...base, [k]: 'DEĞİŞTİ' }), h0, `${k} değişimi zinciri etkilemedi`);
  }
});

test('artifact\'ler farklı koşudan ise integrity BAŞARISIZ', () => {
  const a = { chainHash: chainOf({ x: '1' }), parts: { x: '1' } };
  const b = { chainHash: chainOf({ x: '2' }), parts: { x: '2' } };
  const r = verifyRunIntegrity(a, b);
  assert.equal(r.valid, false);
  assert.deepEqual(r.mismatched, ['x']);
  assert.equal(verifyRunIntegrity(a, a).valid, true);
});

test('runIntegrity gerçek dosyadan video özeti üretir',
  { skip: !hasFfmpeg && 'ffmpeg yok' }, async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'ri-'));
    try {
      const v = await buildVideo(dir, 'x.mp4', [{ color: 'black', seconds: 2 }]);
      const r = await buildRunIntegrity({
        workDir: dir, videoPath: v,
        script: { topic: 'T', hook_text: 'H', scenes: [{ narration: 'n' }], normalizedTopic: 't' },
        renderPlan: { clips: [], overlayLayers: ['hook'] },
      });
      assert.match(r.chainHash, /^[0-9a-f]{64}$/);
      assert.match(r.parts.finalVideo, /^[0-9a-f]{64}$/);
      assert.ok(r.runId.startsWith('t-'));
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

// ---------------- YAYIN KAPISI: FINAL MP4 BİRİNCİL GİRDİ ----------------
test('final video başarısızsa YAYIN KAPISI düşer (plan doğru olsa bile)', async () => {
  const { evaluatePublishGates } = await import('../src/pipeline/publishGates.js');
  const perfectPlan = {
    captionIntegrity: { tokenCoverage: 1, missingTokens: [], duplicateTokens: [],
      grammarRiskBlocks: [], timelineOverlapCount: 0 },
    subjectContinuity: { verified: true, score: 0.95, suspectedWrongSubjectScenes: [] },
    semanticActions: { average: 0.9 },
    runIntegrity: { runId: 'r-1', chainHash: 'abc', parts: { finalVideo: 'v' } },
  };
  const ok = evaluatePublishGates({ ...perfectPlan, finalVideo: { ok: true, failures: [] } });
  assert.equal(ok.status, 'pass', JSON.stringify(ok));

  const bad = evaluatePublishGates({
    ...perfectPlan,
    finalVideo: { ok: false, failures: ['DUPLICATE_SHOT:2', 'UNDECLARED_OVERLAY:cta'] },
  });
  assert.equal(bad.passed, false);
  assert.ok(bad.failures.includes('FINAL_VIDEO/DUPLICATE_SHOT:2'), JSON.stringify(bad.failures));
  assert.ok(bad.failures.includes('FINAL_VIDEO/UNDECLARED_OVERLAY:cta'));
});

test('final video DOĞRULANMADIYSA needs_review (yayın engelli)', async () => {
  const { evaluatePublishGates } = await import('../src/pipeline/publishGates.js');
  const r = evaluatePublishGates({
    finalVideo: null,
    runIntegrity: { runId: 'r', chainHash: 'c', parts: { finalVideo: 'v' } },
    captionIntegrity: { tokenCoverage: 1, missingTokens: [], duplicateTokens: [],
      grammarRiskBlocks: [], timelineOverlapCount: 0 },
    subjectContinuity: { verified: true, score: 0.9, suspectedWrongSubjectScenes: [] },
    semanticActions: { average: 0.9 },
  });
  assert.equal(r.status, 'needs_review');
  assert.ok(r.review.includes('FINAL_VIDEO_UNVERIFIED'));
});

test('run integrity zinciri yoksa needs_review', async () => {
  const { evaluatePublishGates } = await import('../src/pipeline/publishGates.js');
  const r = evaluatePublishGates({
    finalVideo: { ok: true, failures: [] },
    runIntegrity: null,
    captionIntegrity: { tokenCoverage: 1, missingTokens: [], duplicateTokens: [],
      grammarRiskBlocks: [], timelineOverlapCount: 0 },
    subjectContinuity: { verified: true, score: 0.9, suspectedWrongSubjectScenes: [] },
    semanticActions: { average: 0.9 },
  });
  assert.ok(r.review.includes('RUN_INTEGRITY_UNVERIFIED'));
  assert.equal(r.passed, false);
});

// ---------------- DÖNGÜ KAPANIŞI SIRA MUAFİYETİ ----------------
test('döngü yankısı sahne sırasını geriye alsa da OUT_OF_ORDER sayılmaz', () => {
  // Son plan KASITLI olarak ilk görsele döner: scene 0, en sonda.
  const r = verifyTimelineOrder([
    { id: 'scene_00_clip_00', scene: 0, sequence: 0, renderOrder: 0, start: 0, end: 3 },
    { id: 'scene_01_clip_00', scene: 1, sequence: 0, renderOrder: 1, start: 3, end: 6 },
    { id: 'scene_00_loopecho_00', scene: 0, sequence: 0, renderOrder: 2, start: 6, end: 8, loopEcho: true },
  ]);
  assert.equal(r.valid, true, JSON.stringify(r.problems));
});

test('döngü yankısından SONRAKİ gerçek sıra bozukluğu hâlâ yakalanır', () => {
  // Muafiyet çıpayı güncellemez; scene 1 -> scene 0 (loop) -> scene 0 normal
  // klip yine de scene 1'in gerisindedir.
  const r = verifyTimelineOrder([
    { id: 'scene_01_clip_00', scene: 1, sequence: 0, renderOrder: 0, start: 0, end: 3 },
    { id: 'scene_00_loopecho_00', scene: 0, sequence: 0, renderOrder: 1, start: 3, end: 5, loopEcho: true },
    { id: 'scene_00_clip_00', scene: 0, sequence: 0, renderOrder: 2, start: 5, end: 7 },
  ]);
  assert.ok(r.problems.some((p) => p.startsWith('OUT_OF_ORDER')), JSON.stringify(r.problems));
});

// ---------------- KOYU ARŞİV FOTOĞRAFI ≠ DİYAGRAM ----------------
test('koyu kareler, plan diyagram bildirmiyorsa diyagram sayılmaz', { skip: !hasFfmpeg }, async () => {
  // GERÇEK REGRESYON: Roma su kemerleri koşusunda kaynakların üçü arşiv
  // fotoğrafıydı. Eski ölçüt "medyanın %45'inden karanlık = diyagram kartı"
  // diyordu; 8.5-14s ve 28-33s aralıkları "plan dışı diyagram" ilan edildi ve
  // UNDECLARED_OVERLAY:diagram üretildi. Ortada hiç diyagram yoktu.
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fvv-dark-'));
  try {
    const v = await buildVideo(dir, 'dark.mp4', [
      { color: 'gray',   seconds: 4 },
      { color: '0x101010', seconds: 4 },   // koyu arşiv fotoğrafı taklidi
      { color: 'white',  seconds: 4 },
      { color: '0x0c1418', seconds: 4 },   // ikinci koyu fotoğraf
    ]);
    const r = await validateFinalVideo(v, {
      duration: 16,
      clips: [
        { id: 'c0', scene: 0, sequence: 0, renderOrder: 0, start: 0,  end: 4,  assetId: 'a0' },
        { id: 'c1', scene: 1, sequence: 0, renderOrder: 1, start: 4,  end: 8,  assetId: 'a1' },
        { id: 'c2', scene: 2, sequence: 0, renderOrder: 2, start: 8,  end: 12, assetId: 'a2' },
        { id: 'c3', scene: 3, sequence: 0, renderOrder: 3, start: 12, end: 16, assetId: 'a3' },
      ],
      hookWindows: [], ctaWindows: [], diagramWindows: [], loopEchoWindows: [],
      declaredOverlays: [],
    }, { fps: 2 });
    assert.ok(!r.failures.some((f) => f.startsWith('DIAGRAM_OUTSIDE_PLAN')),
      `koyu fotoğraf diyagram sanıldı: ${JSON.stringify(r.failures)}`);
    assert.ok(!r.failures.some((f) => f.includes('UNDECLARED_OVERLAY') && f.includes('diagram')),
      `bildirilmemiş diyagram uyduruldu: ${JSON.stringify(r.failures)}`);
    assert.deepEqual(r.diagramOccurrences, []);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

// ---------------- KOPYA: KANIT vs BENZERLİK ----------------
test('aynı varlık aradan sonra tekrar ederse KANITLI kopya (hata)', { skip: !hasFfmpeg }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fvv-dup-'));
  try {
    const v = await buildVideo(dir, 'dup.mp4', [
      { color: 'red', seconds: 3 }, { color: 'white', seconds: 4 }, { color: 'red', seconds: 3 },
    ]);
    const r = await validateFinalVideo(v, {
      duration: 10,
      clips: [
        { id: 'c0', scene: 0, sequence: 0, renderOrder: 0, start: 0, end: 3,  assetId: 'SAME' },
        { id: 'c1', scene: 1, sequence: 0, renderOrder: 1, start: 3, end: 7,  assetId: 'other' },
        { id: 'c2', scene: 2, sequence: 0, renderOrder: 2, start: 7, end: 10, assetId: 'SAME' },
      ],
      hookWindows: [], ctaWindows: [], diagramWindows: [], loopEchoWindows: [],
      declaredOverlays: [],
    }, { fps: 2 });
    assert.ok(r.failures.some((f) => f.startsWith('DUPLICATE_SHOT')), JSON.stringify(r.failures));
    assert.equal(r.duplicateShots[0].evidence, 'same-asset');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('farklı varlıklar görsel olarak yakınsa UYARI, sert engel değil', { skip: !hasFfmpeg }, async () => {
  // Aynı konunun iki ayrı arşiv fotoğrafı (aynı taş, aynı ton) 64 bit dHash'te
  // birbirine düşebilir. Bu bir İDDİADIR, delil değil: insan bakışına gider.
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fvv-sim-'));
  try {
    const v = await buildVideo(dir, 'sim.mp4', [
      { color: 'red', seconds: 3 }, { color: 'white', seconds: 4 }, { color: 'red', seconds: 3 },
    ]);
    const r = await validateFinalVideo(v, {
      duration: 10,
      clips: [
        { id: 'c0', scene: 0, sequence: 0, renderOrder: 0, start: 0, end: 3,  assetId: 'photo-A' },
        { id: 'c1', scene: 1, sequence: 0, renderOrder: 1, start: 3, end: 7,  assetId: 'photo-B' },
        { id: 'c2', scene: 2, sequence: 0, renderOrder: 2, start: 7, end: 10, assetId: 'photo-C' },
      ],
      hookWindows: [], ctaWindows: [], diagramWindows: [], loopEchoWindows: [],
      declaredOverlays: [],
    }, { fps: 2 });
    assert.ok(!r.failures.some((f) => f.startsWith('DUPLICATE_SHOT')), JSON.stringify(r.failures));
    assert.ok(r.warnings.some((w) => w.startsWith('SIMILAR_SHOT')), JSON.stringify(r.warnings));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('SIMILAR_SHOT sert engel değil, DANIŞMA olarak raporlanır', async () => {
  const { evaluatePublishGates } = await import('../src/pipeline/publishGates.js');
  const base = {
    runIntegrity: { chainHash: 'x', parts: { finalVideo: 'y' } },
    captionIntegrity: { tokenCoverage: 1, missingTokens: [], duplicateTokens: [],
      grammarRiskBlocks: [], timelineOverlapCount: 0 },
    subjectContinuity: { verified: true, score: 0.9, suspectedWrongSubjectScenes: [] },
    semanticActions: { average: 0.9 },
  };
  const r = evaluatePublishGates({
    ...base,
    finalVideo: { ok: true, failures: [], warnings: ['SIMILAR_SHOT:1 — farklı varlıklar'] },
  });
  assert.ok(!r.failures.some((f) => f.includes('SIMILAR_SHOT')), JSON.stringify(r.failures));
  assert.ok(r.advisory.some((x) => x.includes('SIMILAR_SHOT')), JSON.stringify(r.advisory));
  assert.notEqual(r.status, 'fail');
});

// ---------------- DÖNGÜ YANKISINDA HOOK BÖLGESİ KÖRDÜR ----------------
test('döngü penceresindeki hook eşleşmesi "plan dışı" sayılmaz', () => {
  // GERÇEK REGRESYON (brain-vs-ai-memory, 26 Tem): 57sn'lik videonun son yarım
  // saniyesi döngü yankısıydı — son plan İLK GÖRSELE dönüyordu. Hook bölgesinin
  // pikselleri referansla aynı oldu (referans da o görselin üstünde alınmıştı)
  // ve hiç hook yazısı çizilmemişken HOOK_OUTSIDE_PLAN:56-56.5s raporlandı.
  const A = 0b1010101010101010101010101010101010101010101010101010101010101010n;
  const B = 0b0101010101010101010101010101010101010101010101010101010101010101n;
  const fps = 2;
  const hashes = [];
  for (let i = 0; i < 24; i += 1) {
    const t = i / fps;
    hashes.push((t < 2) || (t >= 11) ? A : B);   // 11-12s = döngü yankısı
  }
  const withoutExempt = findOccurrences(hashes, [[0, 2]], fps, 4);
  assert.equal(withoutExempt.unplanned.length, 1, 'kurulum hatalı: eşleşme yok');

  const r = findOccurrences(hashes, [[0, 2]], fps, 4, [[11, 12]]);
  assert.deepEqual(r.unplanned, [], JSON.stringify(r));
  assert.equal(r.exempt.length, 1, JSON.stringify(r));
});
