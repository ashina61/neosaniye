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

test('workflow üç deney cron ifadesini içerir, eski cronlar kaldırıldı', async () => {
  const yml = await readFile('.github/workflows/daily-short.yml', 'utf8');
  // ABD-optimize slotlar 13:00/18:00/23:00 (SABAH/ÖĞLEDEN SONRA/AKŞAM ET);
  // dakika +2 (GitHub tam saat tick'i yutuyor — 2 kez yaşandı).
  assert.ok(yml.includes('cron: "2 13 * * *"'), '13:00 (SABAH) slot cronu eksik');
  assert.ok(yml.includes('cron: "2 18 * * *"'), '18:00 (ÖĞLEDEN SONRA) slot cronu eksik');
  assert.ok(yml.includes('cron: "2 23 * * *"'), '23:00 (AKŞAM) slot cronu eksik');
  // Eski v1 slotları (15:00/20:00/02:00) tamamen kaldırılmış olmalı.
  assert.ok(!yml.includes('cron: "2 15 * * *"'), 'eski 15:00 cronu hâlâ duruyor');
  assert.ok(!yml.includes('cron: "2 20 * * *"'), 'eski 20:00 cronu hâlâ duruyor');
  assert.ok(!yml.includes('cron: "2 2 * * *"'), 'eski 02:00 cronu hâlâ duruyor');
  assert.equal((yml.match(/- cron:/g) || []).length, 3, 'tam 3 cron olmalı (çift tetik yok)');
});

test('cron: her slot saati doğru scheduledSlot üretir (gecikme toleranslı)', () => {
  assert.equal(detectSlot(new Date('2026-07-20T13:02:10Z'), CRON).slot, '13:00');
  assert.equal(detectSlot(new Date('2026-07-20T13:41:00Z'), CRON).slot, '13:00'); // 41 dk gecikme
  assert.equal(detectSlot(new Date('2026-07-20T18:05:00Z'), CRON).slot, '18:00');
  assert.equal(detectSlot(new Date('2026-07-20T23:03:00Z'), CRON).slot, '23:00');
  // Aşırı gecikmede bile sonraki slota SIÇRAMAZ (en son geçen slot esastır).
  assert.equal(detectSlot(new Date('2026-07-20T17:59:00Z'), CRON).slot, '13:00');
});

test('üç slot da AYNI UTC gününe yazılır (02:00 taşma karmaşası kaldırıldı)', () => {
  // Sabah slotu.
  const morning = detectSlot(new Date('2026-07-20T13:07:00Z'), CRON);
  assert.equal(morning.slot, '13:00');
  assert.equal(morning.contentDate, '2026-07-20');
  assert.equal(morning.scheduledPublishAt, '2026-07-20T13:00:00.000Z');
  // Öğleden sonra ve akşam slotları da aynı güne düşer.
  assert.equal(detectSlot(new Date('2026-07-20T18:09:00Z'), CRON).contentDate, '2026-07-20');
  const evening = detectSlot(new Date('2026-07-20T23:09:00Z'), CRON);
  assert.equal(evening.slot, '23:00');
  assert.equal(evening.contentDate, '2026-07-20'); // takvim = içerik günü, taşma yok
  assert.equal(evening.scheduledPublishAt, '2026-07-20T23:00:00.000Z');
});

test('manuel çalıştırma otomatik slot diye yanlış etiketlenmez', () => {
  const r = detectSlot(new Date('2026-07-20T13:05:00Z'), { eventName: 'workflow_dispatch', manualSlot: '' });
  assert.equal(r.slot, 'manual');
  assert.equal(r.scheduledPublishAt, null);
  // undefined manualSlot (env yok) + push eventi de manual sayılır.
  assert.equal(detectSlot(new Date(), { eventName: undefined, manualSlot: undefined }).slot, 'manual');
});

test('manuel run\'da slot input ile açıkça seçilebilir', () => {
  const r = detectSlot(new Date('2026-07-20T18:30:00Z'), { eventName: 'workflow_dispatch', manualSlot: '18:00' });
  assert.equal(r.slot, '18:00');
  assert.equal(r.scheduledPublishAt, '2026-07-20T18:00:00.000Z');
  // Geçersiz input manual'e düşer.
  assert.equal(detectSlot(new Date(), { eventName: 'workflow_dispatch', manualSlot: 'gece' }).slot, 'manual');
});

test('deney durumu tarihe göre: pending → active → completed (otomatik saat değişimi yok)', () => {
  assert.equal(experimentStatus(new Date('2026-07-21T12:00:00Z')), 'pending');
  assert.equal(experimentStatus(new Date('2026-07-22T00:01:00Z')), 'active');
  assert.equal(experimentStatus(new Date('2026-08-04T23:59:00Z')), 'active');
  assert.equal(experimentStatus(new Date('2026-08-05T00:01:00Z')), 'completed');
});

test('experiment metadata şeması istenen alanları içerir', () => {
  const r = detectSlot(new Date('2026-07-20T13:05:00Z'), CRON);
  const e = r.experiment;
  assert.equal(e.id, 'us-audience-3-slots-v2');
  assert.equal(e.timezone, 'UTC');
  assert.ok(EXPERIMENT.slots.includes(e.scheduledSlot));
  assert.equal(e.experimentStartDate, '2026-07-22');
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
      scheduleExperimentId: 'us-audience-3-slots-v2',
      scheduledSlot: '23:00',
      scheduledPublishAt: '2026-07-20T23:00:00.000Z',
      actualPublishAt: '2026-07-20T02:31:00.000Z',
    });
    const res = await appendQcHistory(newEntry, { file });
    assert.equal(res.appended, true);
    const lines = (await readFile(file, 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(lines.length, 2);
    assert.equal(lines[0].videoId, 'old-1');
    assert.equal(lines[1].scheduledSlot, '23:00');
    assert.equal(lines[1].scheduleExperimentId, 'us-audience-3-slots-v2');
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
