#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * NEO MOTION ROLLOUT — CRON LOG HELPER (yalnızca okuma).
 *
 * motion:rollout-report'un ürettiği rollout-report.json'u parse eder, cron
 * logu için kısa özet + FAIL/REVIEW durumunda GitHub Actions warning basar.
 * HATA TOLERANSLI: dosya yok/bozuksa yalnızca warning yazar, exit 0 ile çıkar
 * (job'ı asla düşürmez). Production/motion koduna dokunmaz.
 *
 * formatRolloutLog saf fonksiyondur (test edilebilir).
 */

/**
 * @param {object} s rollout-report.json özeti
 * @returns {{lines:string[], annotations:string[]}}
 */
export function formatRolloutLog(s) {
  const rate = Math.round((Number(s.actualApplyRate) || 0) * 100);
  const lines = [
    `[motion-rollout] status=${s.verdict}`,
    `[motion-rollout] analyzed=${s.reviewedRealVideos}/${s.limit}`,
    `[motion-rollout] requested=${s.ctaRequestedCount}`,
    `[motion-rollout] applied=${s.ctaAppliedCount}`,
    `[motion-rollout] rate=${rate}%`,
    `[motion-rollout] warnings=${s.warningCount}`,
    `[motion-rollout] failures=${s.failureCount}`,
  ];
  const annotations = [];
  if (s.verdict === 'FAIL') {
    annotations.push('::warning title=Neo Motion Rollout::Rollout report returned FAIL. Manual review required.');
  } else if (s.verdict === 'REVIEW') {
    annotations.push('::warning title=Neo Motion Rollout::Rollout report returned REVIEW. Manual review recommended.');
  }
  // PASS ve PENDING: normal bilgi logu (warning yok).
  return { lines, annotations };
}

async function main() {
  const file = process.argv[2] || path.join('artifacts', 'motion', 'rollout', 'rollout-report.json');
  let summary;
  try {
    summary = JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    // Dosya yok veya bozuk JSON → yalnızca warning, job devam eder.
    console.warn(`[motion-rollout] rapor JSON okunamadı (${err.code || 'parse'}); production devam ediyor.`);
    return;
  }
  const { lines, annotations } = formatRolloutLog(summary);
  for (const l of lines) console.log(l);
  for (const a of annotations) console.log(a);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
