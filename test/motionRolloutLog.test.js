import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { formatRolloutLog } from '../scripts/motion-rollout-log.js';

const run = promisify(execFile);
const S = (over) => ({ verdict: 'PENDING', limit: 20, reviewedRealVideos: 4, ctaRequestedCount: 2, ctaAppliedCount: 1, actualApplyRate: 0.25, warningCount: 0, failureCount: 0, ...over });

// ---- saf log biçimi ----
test('log satırları istenen formatta', () => {
  const { lines } = formatRolloutLog(S());
  assert.deepEqual(lines, [
    '[motion-rollout] status=PENDING',
    '[motion-rollout] analyzed=4/20',
    '[motion-rollout] requested=2',
    '[motion-rollout] applied=1',
    '[motion-rollout] rate=25%',
    '[motion-rollout] warnings=0',
    '[motion-rollout] failures=0',
  ]);
});

test('PENDING → warning yok', () => {
  assert.equal(formatRolloutLog(S({ verdict: 'PENDING' })).annotations.length, 0);
});
test('PASS → warning yok', () => {
  assert.equal(formatRolloutLog(S({ verdict: 'PASS' })).annotations.length, 0);
});
test('REVIEW → GitHub warning', () => {
  const a = formatRolloutLog(S({ verdict: 'REVIEW' })).annotations;
  assert.equal(a.length, 1);
  assert.ok(a[0].startsWith('::warning title=Neo Motion Rollout::'));
  assert.ok(a[0].includes('REVIEW'));
});
test('FAIL → GitHub warning', () => {
  const a = formatRolloutLog(S({ verdict: 'FAIL' })).annotations;
  assert.equal(a.length, 1);
  assert.ok(a[0].includes('FAIL. Manual review required.'));
});

// ---- CLI hata toleransı ----
test('CLI: dosya yok → warning, exit 0 (cron devam)', async () => {
  const { stdout, stderr } = await run('node', ['scripts/motion-rollout-log.js', '/nonexistent/x.json']);
  assert.ok((stderr + stdout).includes('okunamadı'));
});

test('CLI: bozuk JSON → warning, exit 0', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rl-log-'));
  try {
    const f = path.join(dir, 'bad.json');
    await writeFile(f, '{bozuk json');
    const { stdout, stderr } = await run('node', ['scripts/motion-rollout-log.js', f]);
    assert.ok((stderr + stdout).includes('okunamadı'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('CLI: geçerli FAIL raporu → warning annotation basar, exit 0', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rl-log2-'));
  try {
    const f = path.join(dir, 'r.json');
    await writeFile(f, JSON.stringify(S({ verdict: 'FAIL', failureCount: 1 })));
    const { stdout } = await run('node', ['scripts/motion-rollout-log.js', f]);
    assert.ok(stdout.includes('[motion-rollout] status=FAIL'));
    assert.ok(stdout.includes('::warning title=Neo Motion Rollout::'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ---- workflow YAML sözleşmesi ----
test('workflow: rollout adımı + artifact + hata toleransı doğru kurulu', async () => {
  const yml = await readFile('.github/workflows/daily-short.yml', 'utf8');
  // Rollout adımı üretim (produce) sonrası, kayıtlar yazıldıktan sonra çalışır.
  assert.ok(yml.includes('id: produce'), 'produce step id yok');
  assert.ok(yml.includes('npm run motion:rollout-report'), 'rollout komutu yok');
  assert.ok(yml.includes('|| echo "[motion-rollout] report generation failed; production continues"'), 'rollout hata toleransı yok');
  assert.ok(yml.includes('node scripts/motion-rollout-log.js'), 'log helper adımı yok');
  // Rollout adımı iptal edilmedikçe + produce skip edilmedikçe çalışır (üretim yapıldıysa).
  assert.ok(yml.includes("!cancelled() && steps.produce.conclusion != 'skipped'"), 'rollout koşulu yanlış');
  // Ayrı artifact, run_number ile benzersiz, dosya yoksa düşürmez, 14 gün.
  assert.ok(yml.includes('name: motion-rollout-report-${{ github.run_number }}'), 'artifact adı yanlış');
  assert.ok(yml.includes('artifacts/motion/rollout/rollout-report.json'), 'artifact json yolu yok');
  assert.ok(yml.includes('retention-days: 14'), 'retention 14 gün yok');
  // Rollout adımı, kalıcı kayıt yazan produce adımından SONRA gelir.
  assert.ok(yml.indexOf('id: produce') < yml.indexOf('npm run motion:rollout-report'), 'rollout produce\'dan önce');
  // Rollout artifact adımı short-video artifact\'ından önce (istenen sıra).
  assert.ok(yml.indexOf('motion-rollout-report-') < yml.indexOf('name: short-video'), 'rollout artifact sırası yanlış');
});
