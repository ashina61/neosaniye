import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { appendQcHistory, buildQcHistoryEntry } from '../src/pipeline/qcHistory.js';

function sampleEntry(videoId = 'vid-1') {
  return buildQcHistoryEntry({
    retentionScore: 91,
    scores: {
      hook: 25, visualPacing: 16, curiosity: 15, captions: 10,
      visualVariety: 10, audioDesign: 8, payoffAndLoop: 7,
    },
    metrics: { durationSeconds: 35.2 },
    technicalReady: true,
    editorialReady: true,
    productionReady: true,
    qcMode: 'warning',
    uploadEligibility: { youtube: true, instagram: true, facebook: true, policyOverride: false, reasons: [] },
    warnings: ['loudness -16.1 LUFS (hedef -14±2)'],
    failures: [],
    createdAt: '2026-07-18T12:00:00.000Z',
  }, { videoId, topic: 'Antikythera mekanizması', format: 'story' });
}

async function withDir(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'qc-hist-'));
  try {
    return await fn(path.join(dir, 'qc-history.jsonl'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('buildQcHistoryEntry: rapor alanları doğru eşlenir, secret alan yok', () => {
  const e = sampleEntry();
  assert.equal(e.videoId, 'vid-1');
  assert.equal(e.retentionScore, 91);
  assert.equal(e.hookScore, 25);
  assert.equal(e.visualPacingScore, 16);
  assert.equal(e.curiosityScore, 15);
  assert.equal(e.captionScore, 10);
  assert.equal(e.visualVarietyScore, 10);
  assert.equal(e.audioDesignScore, 8);
  assert.equal(e.payoffAndLoopScore, 7);
  assert.equal(e.durationSeconds, 35.2);
  assert.equal(e.qcMode, 'warning');
  assert.equal(e.policyOverride, false);
  assert.equal(e.warnings.length, 1);
  // Kayıtta token/secret benzeri hiçbir alan bulunmamalı.
  const flat = JSON.stringify(e).toLowerCase();
  for (const banned of ['token', 'secret', 'key', 'password']) {
    assert.ok(!flat.includes(banned), `geçmiş kaydında yasak alan: ${banned}`);
  }
});

test('yeni kayıt append edilir, dosya yoksa oluşturulur', async () => {
  await withDir(async (file) => {
    const res = await appendQcHistory(sampleEntry(), { file });
    assert.deepEqual(res, { ok: true, appended: true });
    const lines = (await readFile(file, 'utf8')).trim().split('\n');
    assert.equal(lines.length, 1);
    assert.equal(JSON.parse(lines[0]).videoId, 'vid-1');
  });
});

test('mevcut kayıtlar korunur (append-only, yeniden yazma yok)', async () => {
  await withDir(async (file) => {
    await appendQcHistory(sampleEntry('vid-1'), { file });
    const before = await readFile(file, 'utf8');
    await appendQcHistory(sampleEntry('vid-2'), { file });
    const after = await readFile(file, 'utf8');
    assert.ok(after.startsWith(before), 'önceki içerik bayt bayt korunmalı');
    const lines = after.trim().split('\n');
    assert.equal(lines.length, 2);
    assert.deepEqual(lines.map((l) => JSON.parse(l).videoId), ['vid-1', 'vid-2']);
  });
});

test('aynı videoId ikinci kez eklenmez', async () => {
  await withDir(async (file) => {
    await appendQcHistory(sampleEntry('vid-1'), { file });
    const res = await appendQcHistory(sampleEntry('vid-1'), { file });
    assert.equal(res.ok, true);
    assert.equal(res.appended, false);
    assert.ok(res.reason.includes('vid-1'));
    const lines = (await readFile(file, 'utf8')).trim().split('\n');
    assert.equal(lines.length, 1);
  });
});

test('bozuk satır varsa diğer kayıtlar korunur, append çalışmaya devam eder', async () => {
  await withDir(async (file) => {
    await writeFile(file, '{"videoId":"vid-0"}\nBOZUK{{{satir\n', 'utf8');
    const res = await appendQcHistory(sampleEntry('vid-1'), { file });
    assert.equal(res.appended, true);
    const content = await readFile(file, 'utf8');
    // Bozuk satır dahil eski içerik aynen duruyor, yeni kayıt sona eklendi.
    assert.ok(content.startsWith('{"videoId":"vid-0"}\nBOZUK{{{satir\n'));
    const parsed = content.trim().split('\n').flatMap((l) => {
      try { return [JSON.parse(l).videoId]; } catch { return []; }
    });
    assert.deepEqual(parsed, ['vid-0', 'vid-1']);
    // Dedup, bozuk satıra rağmen çalışır.
    const dup = await appendQcHistory(sampleEntry('vid-0'), { file });
    assert.equal(dup.appended, false);
  });
});

test('yazma hatası pipeline\'ı çökertmez: throw yok, ok:false döner', async () => {
  await withDir(async (file) => {
    // Dosya yolu olarak bir DİZİN verilir → yazma kesin başarısız olur.
    const dirAsFile = path.dirname(file);
    const res = await appendQcHistory(sampleEntry(), { file: dirAsFile });
    assert.equal(res.ok, false);
    assert.equal(res.appended, false);
    assert.ok(res.error, 'hata mesajı dönmeli');
  });
});
