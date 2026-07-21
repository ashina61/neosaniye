import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { detectSlot, experimentStatus, EXPERIMENT } from '../src/pipeline/scheduleExperiment.js';
import { buildQcHistoryEntry, appendQcHistory } from '../src/pipeline/qcHistory.js';
import { emptySlotMetrics, buildSlotComparisonReport } from '../src/analytics/experimentMetrics.js';

const CRON = { eventName: 'schedule', manualSlot: '' };

test('workflow is manual-only while viewer-first variants are under review', async () => {
  const yml = await readFile('.github/workflows/daily-short.yml', 'utf8');
  assert.ok(yml.includes('workflow_dispatch:'));
  assert.ok(!/^\s+schedule:/m.test(yml));
  assert.ok(!/^\s+- cron:/m.test(yml));
});

test('cron: her slot saati doğru scheduledSlot üretir (gecikme toleranslı)', () => {
  assert.equal(detectSlot(new Date('2026-07-20T15:02:10Z'), CRON).slot, '15:00');
  assert.equal(detectSlot(new Date('2026-07-20T15:41:00Z'), CRON).slot, '15:00'); // 41 dk gecikme
  assert.equal(detectSlot(new Date('2026-07-20T20:05:00Z'), CRON).slot, '20:00');
  assert.equal(detectSlot(new Date('2026-07-20T02:03:00Z'), CRON).slot, '02:00');
  // Aşırı gecikmede bile sonraki slota SIÇRAMAZ (en son geçen slot esastır).
  assert.equal(detectSlot(new Date('2026-07-20T18:59:00Z'), CRON).slot, '15:00');
});

test('02:00 UTC tarih geçişi: içerik günü bir ÖNCEKİ UTC günüdür', () => {
  const r = detectSlot(new Date('2026-07-20T02:07:00Z'), CRON);
  assert.equal(r.slot, '02:00');
  assert.equal(r.contentDate, '2026-07-19'); // takvim 20'si ama içerik günü 19'un 3. slotu
  assert.equal(r.scheduledPublishAt, '2026-07-20T02:00:00.000Z');
  // 15:00 slotu aynı güne yazılır.
  assert.equal(detectSlot(new Date('2026-07-20T15:09:00Z'), CRON).contentDate, '2026-07-20');
});

test('manuel çalıştırma otomatik slot diye yanlış etiketlenmez', () => {
  const r = detectSlot(new Date('2026-07-20T15:05:00Z'), { eventName: 'workflow_dispatch', manualSlot: '' });
  assert.equal(r.slot, 'manual');
  assert.equal(r.scheduledPublishAt, null);
  // undefined manualSlot (env yok) + push eventi de manual sayılır.
  assert.equal(detectSlot(new Date(), { eventName: undefined, manualSlot: undefined }).slot, 'manual');
});

test('manuel run\'da slot input ile açıkça seçilebilir', () => {
  const r = detectSlot(new Date('2026-07-20T20:30:00Z'), { eventName: 'workflow_dispatch', manualSlot: '20:00' });
  assert.equal(r.slot, '20:00');
  assert.equal(r.scheduledPublishAt, '2026-07-20T20:00:00.000Z');
  // Geçersiz input manual'e düşer.
  assert.equal(detectSlot(new Date(), { eventName: 'workflow_dispatch', manualSlot: 'gece' }).slot, 'manual');
});

test('deney durumu tarihe göre: pending → active → completed (otomatik saat değişimi yok)', () => {
  assert.equal(experimentStatus(new Date('2026-07-18T12:00:00Z')), 'pending');
  assert.equal(experimentStatus(new Date('2026-07-19T00:01:00Z')), 'active');
  assert.equal(experimentStatus(new Date('2026-08-01T23:59:00Z')), 'active');
  assert.equal(experimentStatus(new Date('2026-08-02T00:01:00Z')), 'completed');
});

test('experiment metadata şeması istenen alanları içerir', () => {
  const r = detectSlot(new Date('2026-07-20T15:05:00Z'), CRON);
  const e = r.experiment;
  assert.equal(e.id, 'us-audience-3-slots-v1');
  assert.equal(e.timezone, 'UTC');
  assert.ok(EXPERIMENT.slots.includes(e.scheduledSlot));
  assert.equal(e.experimentStartDate, '2026-07-19');
  assert.equal(e.experimentDurationDays, 14);
  assert.equal(e.strategy, 'fixed-three-daily-slots');
  assert.equal(e.primaryAudience, 'US');
  assert.ok(['pending', 'active', 'completed'].includes(e.status));
});

test('qc-history yeni deney alanlarını kabul eder, eski kayıtlar bozulmaz', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'qc-exp-'));
  try {
    const file = path.join(dir, 'qc-history.jsonl');
    // Eski biçim kayıt (deney alanları yok) — dosyada aynen kalmalı.
    const oldEntry = buildQcHistoryEntry({ retentionScore: 80, scores: {}, warnings: [], failures: [] }, { videoId: 'old-1' });
    assert.equal(oldEntry.scheduledSlot, null); // eski çağrı imzası hâlâ geçerli
    await appendQcHistory(oldEntry, { file });
    const newEntry = buildQcHistoryEntry({ retentionScore: 91, scores: {}, warnings: [], failures: [] }, {
      videoId: 'new-1',
      scheduleExperimentId: 'us-audience-3-slots-v1',
      scheduledSlot: '02:00',
      scheduledPublishAt: '2026-07-20T02:00:00.000Z',
      actualPublishAt: '2026-07-20T02:31:00.000Z',
    });
    const res = await appendQcHistory(newEntry, { file });
    assert.equal(res.appended, true);
    const lines = (await readFile(file, 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(lines.length, 2);
    assert.equal(lines[0].videoId, 'old-1');
    assert.equal(lines[1].scheduledSlot, '02:00');
    assert.equal(lines[1].scheduleExperimentId, 'us-audience-3-slots-v1');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('metrik adaptörü sahte veri üretmez (tümü null) ve şema tam', () => {
  const m = emptySlotMetrics();
  for (const k of ['views1h', 'views6h', 'views24h', 'likes24h', 'comments24h',
    'subscribersGained', 'averageViewDurationSeconds', 'averagePercentageViewed',
    'viewedVsSwipedAwayRatio']) {
    assert.ok(k in m, `metrik alanı eksik: ${k}`);
    assert.equal(m[k], null, `${k} null olmalı (Analytics bağlı değil — sahte veri yasak)`);
  }
});

test('slot karşılaştırma raporu: medyan kullanır, az örnekte kazanan ilan etmez, manual hariç', () => {
  const rec = (slot, views24, extra = {}) => ({
    scheduledSlot: slot,
    retentionScore: 90,
    format: 'story',
    metrics: { ...emptySlotMetrics(), views24h: views24, ...extra },
  });
  const records = [
    // 15:00 → 8 kayıt (yeterli), biri viral: medyan onu sönümler.
    ...[100, 120, 110, 90, 95, 105, 130, 900000].map((v) => rec('15:00', v)),
    // 20:00 → 2 kayıt (yetersiz örnek).
    rec('20:00', 500), rec('20:00', 700),
    // manual → rapora girmez.
    rec('manual', 99999),
  ];
  const rep = buildSlotComparisonReport(records, { minSample: 7 });
  assert.ok(!('manual' in rep.slots));
  assert.equal(rep.slots['15:00'].sampleCount, 8);
  assert.equal(rep.slots['15:00'].sufficientSample, true);
  // Medyan viral videoya (900k) teslim olmaz.
  assert.ok(rep.slots['15:00'].medianViews24h < 200, `medyan ${rep.slots['15:00'].medianViews24h}`);
  assert.equal(rep.slots['20:00'].sufficientSample, false);
  assert.ok(rep.slots['20:00'].note.includes('insufficient-sample'));
});
