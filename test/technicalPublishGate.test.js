/**
 * TEKNİK YAYIN KAPISI — "QC cellat değil editördür."
 *
 * Bu dosya SINIRI kilitler. V3'te editoryal kapılar yayını durdurmayı bıraktı;
 * bunun bedeli, teknik kapının gerçekten çalıştığından emin olmaktır. Aksi
 * hâlde "gevşetme" sessizce "her şey geçiyor"a döner.
 *
 * Testlerin çoğu GERÇEK MP4 üretir (siyah video, sessiz ses, yatay kadraj):
 * yer gerçeği bizde olduğu için sonuç tartışmasız.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  evaluateTechnicalPublishGate, decidePublish, logPublishDecision,
  CAPTION_DIVERGENCE_BLOCK_THRESHOLD,
} from '../src/pipeline/technicalPublishGate.js';

const run = promisify(execFile);
const hasFfmpeg = await run('ffmpeg', ['-version']).then(() => true).catch(() => false);

// Kapı FAIL-CLOSED'dur: videoPath verilmezse dosya varlığı "doğrulanamadı"
// sayılır ve yayın açılmaz. Bu doğru davranış olduğu için testler GERÇEK bir
// dosyayla çalışır — kapıyı testin rahatı için gevşetmek, kapıyı yok etmektir.
const fixtureDir = await mkdtemp(path.join(os.tmpdir(), 'tpg-fixture-'));
const GOOD_VIDEO = path.join(fixtureDir, 'good.mp4');
if (hasFfmpeg) {
  await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=navy:s=108x192:d=2:r=10',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', GOOD_VIDEO]);
} else {
  await writeFile(GOOD_VIDEO, 'x'.repeat(1024));
}
test.after(() => rm(fixtureDir, { recursive: true, force: true }));

/** Teknik olarak KUSURSUZ bir girdi seti — her test yalnızca bir şeyi bozar. */
const GOOD = {
  videoPath: GOOD_VIDEO,
  preflight: {
    issues: [],
    technical: {
      decodePassed: true, videoStreamPresent: true, audioStreamPresent: true,
      resolution: '1080x1920', maxVolumeDb: -1.2, durationSeconds: 40,
    },
  },
  finalVideo: { analyzedVideoHash: 'HASH', failures: [], sceneOrderValid: true },
  expectedVideoHash: 'HASH',
  captionIntegrity: { tokenCoverage: 1 },
};

test('kusursuz girdi teknik olarak yayına hazır', async () => {
  const r = await evaluateTechnicalPublishGate(GOOD);
  assert.equal(r.technicalPublishReady, true, JSON.stringify(r));
  assert.deepEqual(r.blockers, []);
  assert.deepEqual(r.unverified, []);
});

// ---------------- ENGELLEYİCİLER (görevdeki liste, madde madde) ----------------
test('decode başarısız → engel', async () => {
  const r = await evaluateTechnicalPublishGate({
    ...GOOD, preflight: { issues: [], technical: { ...GOOD.preflight.technical, decodePassed: false } },
  });
  assert.ok(r.blockers.includes('DECODE_FAILED'), JSON.stringify(r.blockers));
  assert.equal(r.technicalPublishReady, false);
});

test('görüntü akışı yok → engel', async () => {
  const r = await evaluateTechnicalPublishGate({
    ...GOOD, preflight: { issues: [], technical: { ...GOOD.preflight.technical, videoStreamPresent: false } },
  });
  assert.ok(r.blockers.includes('NO_VIDEO_STREAM'));
});

test('ses akışı yok → engel', async () => {
  const r = await evaluateTechnicalPublishGate({
    ...GOOD, preflight: { issues: [], technical: { ...GOOD.preflight.technical, audioStreamPresent: false } },
  });
  assert.ok(r.blockers.includes('NO_AUDIO_STREAM'));
});

test('tamamen siyah video → engel', async () => {
  const r = await evaluateTechnicalPublishGate({
    ...GOOD,
    preflight: { issues: ['tüm örnek kareler karanlık/siyah'], technical: GOOD.preflight.technical },
  });
  assert.ok(r.blockers.includes('VIDEO_ALL_BLACK'));
});

test('tamamen sessiz ses → engel', async () => {
  const r = await evaluateTechnicalPublishGate({
    ...GOOD, preflight: { issues: [], technical: { ...GOOD.preflight.technical, maxVolumeDb: -91 } },
  });
  assert.ok(r.blockers.includes('AUDIO_SILENT'));
});

test('yatay kadraj → geçersiz format (Shorts dikeydir)', async () => {
  const r = await evaluateTechnicalPublishGate({
    ...GOOD, preflight: { issues: [], technical: { ...GOOD.preflight.technical, resolution: '1920x1080' } },
  });
  assert.ok(r.blockers.some((b) => b.startsWith('INVALID_RESOLUTION')), JSON.stringify(r.blockers));
});

test('hash uyuşmazlığı → engel (analiz edilen dosya yayınlanacak dosya değil)', async () => {
  const r = await evaluateTechnicalPublishGate({ ...GOOD, expectedVideoHash: 'BASKA_HASH' });
  assert.ok(r.blockers.some((b) => b.startsWith('FINAL_VIDEO_HASH_MISMATCH')), JSON.stringify(r.blockers));
});

test('sahne sırası bozuk → engel', async () => {
  const r = await evaluateTechnicalPublishGate({
    ...GOOD, finalVideo: { ...GOOD.finalVideo, failures: ['TIMELINE_ORDER_INVALID:OVERLAP'] },
  });
  assert.ok(r.blockers.some((b) => b.startsWith('TIMELINE_ORDER_INVALID')));
});

test('altyazı metni TTS metninden CİDDİ saparsa engel', async () => {
  const r = await evaluateTechnicalPublishGate({
    ...GOOD, captionIntegrity: { tokenCoverage: 0.4 },
  });
  assert.ok(r.blockers.some((b) => b.startsWith('CAPTION_TEXT_DIVERGED')), JSON.stringify(r.blockers));
});

test('altyazıda BİRKAÇ kelime eksikliği teknik arıza DEĞİLDİR', async () => {
  // Sınırın anlamı bu: 0.96 kapsama editoryal bir uyarıdır, yayını durdurmaz.
  const r = await evaluateTechnicalPublishGate({ ...GOOD, captionIntegrity: { tokenCoverage: 0.96 } });
  assert.equal(r.technicalPublishReady, true, JSON.stringify(r.blockers));
  assert.ok(0.96 > CAPTION_DIVERGENCE_BLOCK_THRESHOLD);
});

test('ölçülemeyen teknik ölçüt "geçti" sayılmaz (fail-closed)', async () => {
  const r = await evaluateTechnicalPublishGate({ preflight: null, finalVideo: null });
  assert.equal(r.technicalPublishReady, false);
  assert.ok(r.unverified.includes('PREFLIGHT_TECHNICAL'), JSON.stringify(r.unverified));
  assert.ok(r.unverified.includes('FINAL_VIDEO_ANALYSIS'));
  // Dosya yolu HİÇ verilmediyse bu da bir boşluktur, sessizce geçilmez.
  assert.ok(r.unverified.includes('FILE_PRESENCE'));
});

// ---------------- GERÇEK DOSYA ----------------
test('0 byte dosya → engel', { skip: !hasFfmpeg }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tpg-empty-'));
  try {
    const p = path.join(dir, 'empty.mp4');
    await writeFile(p, '');
    const r = await evaluateTechnicalPublishGate({ ...GOOD, videoPath: p });
    assert.ok(r.blockers.some((b) => b.startsWith('FILE_MISSING_OR_EMPTY')), JSON.stringify(r.blockers));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('olmayan dosya → engel', async () => {
  const r = await evaluateTechnicalPublishGate({ ...GOOD, videoPath: '/yok/boyle/bir/dosya.mp4' });
  assert.ok(r.blockers.some((b) => b.startsWith('FILE_MISSING_OR_EMPTY')));
});

test('gerçek MP4 varsa dosya kontrolü geçer', { skip: !hasFfmpeg }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tpg-real-'));
  try {
    const p = path.join(dir, 'ok.mp4');
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=navy:s=108x192:d=2:r=10',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', p]);
    const r = await evaluateTechnicalPublishGate({ ...GOOD, videoPath: p });
    assert.equal(r.technicalPublishReady, true, JSON.stringify(r));
    assert.ok(r.checks.fileSizeBytes > 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

// ---------------- ÜÇ ALANLI SÖZLEŞME ----------------
test('teknik geçer + editoryal kalır → uploadAllowed true', () => {
  const d = decidePublish({
    technical: { technicalPublishReady: true, blockers: [], unverified: [], checks: { finalVideoHashValid: true } },
    publishGates: { passed: false, failures: ['SEMANTIC_ACTION_INCOMPLETE: ortalama 0.07'], advisory: [], review: [] },
    cronPublishingEnabled: true,
  });
  assert.deepEqual(
    { t: d.technicalPublishReady, e: d.editorialQualityPassed, u: d.uploadAllowed },
    { t: true, e: false, u: true },
  );
  assert.ok(d.qualityWarnings.some((w) => w.startsWith('SEMANTIC_ACTION_INCOMPLETE')));
});

test('hash doğrulanamadıysa uploadAllowed false', () => {
  const d = decidePublish({
    technical: { technicalPublishReady: true, blockers: [], unverified: [], checks: { finalVideoHashValid: null } },
    publishGates: { passed: true, failures: [], advisory: [], review: [] },
  });
  assert.equal(d.uploadAllowed, false);
  assert.ok(d.blockers.includes('FINAL_VIDEO_HASH_UNVERIFIED'));
});

test('cronPublishingEnabled false → uploadAllowed false', () => {
  const d = decidePublish({
    technical: { technicalPublishReady: true, blockers: [], unverified: [], checks: { finalVideoHashValid: true } },
    publishGates: { passed: true, failures: [], advisory: [], review: [] },
    cronPublishingEnabled: false,
  });
  assert.equal(d.uploadAllowed, false);
  assert.ok(d.blockers.includes('PUBLISHING_DISABLED'));
});

test('kalite düşükken yayın SESSİZ olmaz: PUBLISHING WITH QUALITY WARNINGS', () => {
  const lines = [];
  const logger = { log: (m) => lines.push(m), warn: (m) => lines.push(m), error: (m) => lines.push(m) };
  logPublishDecision({
    technicalPublishReady: true, editorialQualityPassed: false, uploadAllowed: true,
    qualityWarnings: ['SEMANTIC_ACTION_INCOMPLETE: ortalama 0.07'], blockers: [],
  }, logger);
  assert.ok(lines.some((l) => l === 'PUBLISHING WITH QUALITY WARNINGS'), lines.join('\n'));
  assert.ok(lines.some((l) => l.includes('SEMANTIC_ACTION_INCOMPLETE')));
});
