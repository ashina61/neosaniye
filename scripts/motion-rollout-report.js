#!/usr/bin/env node
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * NEO MOTION — CANLI GÖZLEM (rollout) RAPORU.
 *
 * İlk 20 GERÇEK üretimde Neo Motion Engine davranışını YALNIZCA OKUYARAK
 * özetler. Render/production config/seçici/template'e DOKUNMAZ; yalnızca
 * mevcut kalıcı raporları (data/videos.json + data/qc-history.jsonl) okur.
 *
 * Kullanım: npm run motion:rollout-report
 * Çıktı: artifacts/motion/rollout/{rollout-report.json,md}
 *
 * summarizeRollout saf fonksiyondur (test edilebilir).
 */

const count = (arr, key) => arr.reduce((m, v) => { const k = v.motion[key] || '—'; m[k] = (m[k] || 0) + 1; return m; }, {});
const avg = (arr, f) => { const xs = arr.map(f).filter((x) => Number.isFinite(x)); return xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : null; };

/**
 * Saf toplulaştırma + karar kuralları. motionVideos: kronolojik dizi,
 * her öğe {videoId, videoDurationSec, motion:{...}, statusProxy, videoPath}.
 * @returns {object} rapor özeti
 */
export function summarizeRollout(motionVideos, limit = 20) {
  const N = motionVideos.length;
  const applied = motionVideos.filter((v) => v.motion.ctaApplied);
  const requested = motionVideos.filter((v) => v.motion.ctaRequested || v.motion.ctaApplied);

  let maxConsecutive = 0; let runLen = 0; let prevType = null;
  for (const v of applied) {
    runLen = v.motion.ctaType === prevType ? runLen + 1 : 1;
    maxConsecutive = Math.max(maxConsecutive, runLen);
    prevType = v.motion.ctaType;
  }

  const warningCount = motionVideos.filter((v) => (v.motion.warnings || []).length).length;
  const failureCount = motionVideos.filter((v) => (v.motion.failures || []).length).length;
  const safeAreaFailures = motionVideos.filter((v) => v.motion.ctaApplied && v.motion.safeAreaPassed === false).length;
  const mainRenderFailures = motionVideos.filter((v) => v.statusProxy === 'failed').length;
  const outOfBounds = applied.filter((v) => v.videoDurationSec && v.motion.startSec + v.motion.durationSec > v.videoDurationSec + 0.01).length;
  const disabledButApplied = motionVideos.filter((v) => v.motion.enabled === false && v.motion.ctaApplied).length;
  const REQUIRED = ['enabled', 'ctaRequested', 'ctaApplied', 'selectionReason', 'safeAreaPassed'];
  const missingFields = motionVideos.filter((v) => REQUIRED.some((k) => !(k in v.motion))).length;
  const ctaRate = N ? +(applied.length / N).toFixed(3) : 0;

  const flags = [];
  if (mainRenderFailures > 0) flags.push('FAIL: motion kaynaklı ana render failure');
  if (outOfBounds > 0) flags.push('FAIL: CTA timeline sınırını aştı');
  if (disabledButApplied > 0) flags.push('FAIL: motion kapalı videoda CTA görüldü');
  if (missingFields > 0) flags.push('FAIL: production report alanları eksik/tutarsız');
  if (safeAreaFailures > 0) flags.push('FAIL: CTA uygulandı ama safeAreaPassed=false');
  const hasFail = flags.some((f) => f.startsWith('FAIL'));

  const typeDist = count(applied, 'ctaType');
  let verdict;
  if (hasFail) {
    verdict = 'FAIL';
  } else if (N < limit) {
    verdict = 'PENDING';
    flags.push(`PENDING: yeterli gerçek motion'lı video yok (${N}/${limit}) — ilk ${limit} üretim beklenecek`);
  } else {
    const reviews = [];
    if (ctaRate < 0.10 || ctaRate > 0.55) reviews.push(`REVIEW: CTA oranı %${Math.round(ctaRate * 100)} (hedef %20-50 dışı)`);
    if (maxConsecutive > 3) reviews.push(`REVIEW: aynı CTA tipi art arda ${maxConsecutive} kez`);
    const overused = Object.entries(typeDist).find(([, c]) => applied.length >= 5 && c / applied.length > 0.6);
    if (overused) reviews.push(`REVIEW: '${overused[0]}' tipi aşırı yoğun (%${Math.round(overused[1] / applied.length * 100)})`);
    if (N && warningCount / N > 0.10) reviews.push(`REVIEW: warning oranı %${Math.round(warningCount / N * 100)} (>%10)`);
    flags.push(...reviews);
    verdict = reviews.length ? 'REVIEW' : 'PASS';
  }

  const manualReview = applied.slice(0, 3).map((v) => ({
    videoId: v.videoId,
    outputPath: v.videoPath || '(ephemeral — output/, repoya commit edilmez)',
    ctaId: v.motion.ctaId,
    ctaTimestamp: `${v.motion.startSec}s → ${+(v.motion.startSec + v.motion.durationSec).toFixed(2)}s`,
    frameCheckRange: `${Math.max(0, v.motion.startSec - 0.3).toFixed(1)}s – ${(v.motion.startSec + v.motion.durationSec + 0.3).toFixed(1)}s`,
  }));

  return {
    limit, verdict, flags,
    reviewedRealVideos: N,
    ctaRequestedCount: requested.length,
    ctaAppliedCount: applied.length,
    actualApplyRate: ctaRate,
    distributionByType: typeDist,
    distributionByTemplate: count(applied, 'ctaId'),
    distributionByPosition: count(applied, 'position'),
    skipReasonDistribution: count(motionVideos.filter((v) => !v.motion.ctaApplied), 'selectionReason'),
    safeAreaFailures, warningCount, failureCount,
    avgStartSec: avg(applied, (v) => v.motion.startSec),
    avgDurationSec: avg(applied, (v) => v.motion.durationSec),
    avgMotionPassMs: null, // v1'de kalıcı değil (production-report.json ephemeral)
    avgFileSizeDeltaMB: null,
    maxConsecutiveSameCta: maxConsecutive,
    maxCtaPerVideo: 1,
    mainRenderFailuresFromMotion: mainRenderFailures,
    disabledButApplied, outOfBounds, missingFields,
    notPersistedInV1: ['renderMs', 'motionPassMs', 'input/outputFileSize', 'productionReady(çoğu kayıtta)'],
    manualReview,
  };
}

/** Markdown render (saf). */
export function rolloutMarkdown(s) {
  const dist = (o) => Object.entries(o).map(([k, v]) => `${k}:${v}`).join(', ') || '—';
  const num = (x, suf = '') => (x === null || x === undefined ? '—' : `${x}${suf}`);
  return [
    '# Neo Motion Engine — Canlı Gözlem (Rollout) Raporu',
    '',
    `**Karar: ${s.verdict}** · İncelenen gerçek motion'lı video: **${s.reviewedRealVideos}/${s.limit}**`,
    '',
    '> Yalnızca okuma; render/config/seçici/template DEĞİŞTİRİLMEDİ.',
    '> Kaynak: data/videos.json (tam motion bloğu) + data/qc-history.jsonl.',
    '',
    '## İşaretler',
    ...(s.flags.length ? s.flags.map((f) => `- ${f}`) : ['- (işaret yok)']),
    '',
    '## Özet metrikler',
    `- CTA istenen / uygulanan: ${s.ctaRequestedCount} / ${s.ctaAppliedCount}`,
    `- Gerçek uygulama oranı: **%${Math.round(s.actualApplyRate * 100)}**`,
    `- Tip dağılımı: ${dist(s.distributionByType)}`,
    `- Şablon dağılımı: ${dist(s.distributionByTemplate)}`,
    `- Konum dağılımı: ${dist(s.distributionByPosition)}`,
    `- Skip reason dağılımı: ${dist(s.skipReasonDistribution)}`,
    `- Safe-area başarısızlığı: ${s.safeAreaFailures} · Warning: ${s.warningCount} · Failure: ${s.failureCount}`,
    `- Ortalama CTA başlangıç: ${num(s.avgStartSec, 's')} · ortalama süre: ${num(s.avgDurationSec, 's')}`,
    `- Art arda aynı CTA (max): ${s.maxConsecutiveSameCta} · Video başına max CTA: ${s.maxCtaPerVideo}`,
    `- Motion kaynaklı ana render failure: ${s.mainRenderFailuresFromMotion} · sınır aşımı: ${s.outOfBounds} · kapalıyken uygulanan: ${s.disabledButApplied}`,
    `- Ortalama motion pass süresi / dosya boyutu farkı: v1'de kalıcı değil (production-report.json ephemeral)`,
    '',
    '## Manuel gerçek-video inceleme (uygulanan ilk 3 CTA)',
    ...(s.manualReview.length
      ? s.manualReview.flatMap((m, i) => [
          `${i + 1}. **${m.videoId}** — ${m.ctaId}`,
          `   - çıktı: ${m.outputPath}`,
          `   - CTA zaman: ${m.ctaTimestamp}`,
          `   - kontrol kare aralığı: ${m.frameCheckRange}`,
        ])
      : ['- (henüz uygulanan CTA yok)']),
    '',
    '## Karar kuralları hatırlatması',
    '- PASS: ≥20 video, CTA %20-50, ana render failure yok, safe-area failure yok,',
    '  aynı CTA art arda ≤3, video başına 1 CTA, warning <%10.',
    '- REVIEW: CTA <%10 veya >%55, bir tip aşırı yoğun, sürekli skip, çok safe-area atlaması.',
    '- FAIL: ana render düşmüş, timeline aşımı, çoklu CTA, alan eksik, safeAreaPassed=false ama uygulanmış, kapalıyken CTA.',
    '',
    "_Rapor yalnızca analiz eder; production config'ini otomatik değiştirmez._",
  ].join('\n') + '\n';
}

// ---- CLI (dosyaları okur, özet üretir, yazar) ----
async function main() {
  const LIMIT = Number(process.env.MOTION_ROLLOUT_LIMIT || 20);
  const OUT = path.join('artifacts', 'motion', 'rollout');
  await mkdir(OUT, { recursive: true });

  const loadJson = async (f, fb) => { try { return JSON.parse(await readFile(f, 'utf8')); } catch { return fb; } };
  const loadJsonl = async (f) => {
    try {
      return (await readFile(f, 'utf8')).split('\n').filter((l) => l.trim())
        .flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
    } catch { return []; }
  };

  const videos = await loadJson('data/videos.json', []);
  const history = await loadJsonl(path.join(process.env.STATE_DIR || 'data', 'qc-history.jsonl'));
  const histByVid = new Map(history.filter((h) => h.videoId).map((h) => [h.videoId, h]));

  // Yerel/runner'da varsa production-report.json'lardan zenginleştir (ephemeral).
  async function findReports(dir) {
    const out = [];
    if (!existsSync(dir)) return out;
    for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...await findReports(p));
      else if (e.name === 'production-report.json') { const j = await loadJson(p, null); if (j) out.push({ path: p, report: j }); }
    }
    return out;
  }
  const prodReports = await findReports('output');

  const motionVideos = videos
    .filter((v) => v.motion && typeof v.motion === 'object')
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .slice(-LIMIT)
    .map((v) => {
      const pr = prodReports.find((r) => r.report?.motion?.ctaId && r.report.motion.ctaId === v.motion.ctaId);
      return {
        videoId: v.youtube?.videoId || v.id,
        videoDurationSec: v.duration ?? histByVid.get(v.id)?.durationSeconds ?? null,
        motion: v.motion,
        statusProxy: v.status ?? null,
        productionReady: pr?.report?.productionReady ?? null,
        videoPath: v.videoPath || null,
        createdAt: v.createdAt,
      };
    });

  const summary = { generatedAt: new Date().toISOString(), ...summarizeRollout(motionVideos, LIMIT) };
  await writeFile(path.join(OUT, 'rollout-report.json'), JSON.stringify(summary, null, 2));
  await writeFile(path.join(OUT, 'rollout-report.md'), rolloutMarkdown(summary));
  console.log(`Karar: ${summary.verdict} — ${summary.reviewedRealVideos}/${LIMIT} gerçek motion'lı video`);
  console.log(`✓ ${path.join(OUT, 'rollout-report.json')}`);
  console.log(`✓ ${path.join(OUT, 'rollout-report.md')}`);
}

// Doğrudan çalıştırıldığında CLI; import edildiğinde yalnızca fonksiyonlar.
if (import.meta.url === `file://${process.argv[1]}`) await main();
