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
  assert.deepEqual(r, { planned: [], unplanned: [], reference: null });
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
      const v = await buildVideo(dir, 'clean.mp4', [
        { color: 'red', seconds: 4 }, { color: 'green', seconds: 4 }, { color: 'blue', seconds: 4 },
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
        { color: 'red', seconds: 3 }, { color: 'green', seconds: 3 },
        { color: 'blue', seconds: 3 }, { color: 'red', seconds: 3 },
      ]);
      const r = await validateFinalVideo(v, { duration: 12, clips: [] }, { fps: 2 });
      assert.ok(r.duplicateShots.length >= 1, 'tekrar eden plan bulunamadı');
      assert.ok(r.failures.some((f) => f.startsWith('DUPLICATE_SHOT')), JSON.stringify(r.failures));
      assert.equal(r.ok, false);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

test('KASITLI döngü kapanışı kopya sayılmaz (muafiyet çalışıyor)',
  { skip: !hasFfmpeg && 'ffmpeg yok' }, async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'fvv-c-'));
    try {
      const v = await buildVideo(dir, 'loop.mp4', [
        { color: 'red', seconds: 3 }, { color: 'green', seconds: 3 },
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
