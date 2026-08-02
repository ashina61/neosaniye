#!/usr/bin/env node
/**
 * FINAL MP4 DENETİMİ — elle çalıştırılabilir kare taraması.
 *
 * "Video render edildikten sonra FFmpeg ile her 1 saniyede bir frame çıkar,
 *  bunları otomatik analiz et ve kendi ürettiğin scene plan ile karşılaştır."
 *
 * Kullanım:
 *   node scripts/audit-final-video.js <video.mp4> [plan.json] [--fps 2]
 *
 * plan.json verilmezse yalnızca plan gerektirmeyen ölçütler koşar (kopya plan,
 * durağan akış, kopya altyazı). Bindirme tespiti PLANLANAN PENCEREYİ gerektirir:
 * referans karesi olmadan bir bindirmeyi piksel taramasıyla aramak güvenilir
 * değildir (denetimde "parlak piksel" ölçütü kuşun beyaz göğsünü hook yazısı
 * sandı). Plan yoksa bu ölçütler "doğrulanamadı" sayılır.
 *
 * Çıkış kodu 1 = doğrulama BAŞARISIZ (upload engellenmeli).
 */
import { readFile } from 'node:fs/promises';
import { validateFinalVideo } from '../src/pipeline/finalVideoValidator.js';

const args = process.argv.slice(2);
const video = args.find((a) => !a.startsWith('--') && /\.(mp4|mov|mkv|webm)$/i.test(a));
const planFile = args.find((a) => !a.startsWith('--') && /\.json$/i.test(a));
const fpsArg = args.indexOf('--fps');
const fps = fpsArg >= 0 ? Number(args[fpsArg + 1]) || 2 : 2;

if (!video) {
  console.error('kullanım: node scripts/audit-final-video.js <video.mp4> [plan.json] [--fps 2]');
  process.exit(2);
}

let plan = {};
if (planFile) {
  const raw = JSON.parse(await readFile(planFile, 'utf8'));
  // publish-gates.json ya da renderPlan doğrudan verilebilir.
  const rp = raw.renderPlan || raw;
  const ow = rp.overlayWindows || {};
  plan = {
    duration: raw.duration ?? rp.duration ?? null,
    clips: rp.clips || [],
    hookWindows: ow.hook || [],
    diagramWindows: ow.diagram || [],
    ctaWindows: ow.cta || [],
    loopEchoWindows: ow.loopEcho || [],
    declaredOverlays: rp.overlayLayers || [],
  };
}

const r = await validateFinalVideo(video, plan, { fps });

const line = (k, v) => console.log(`${k.padEnd(22)}: ${v}`);
console.log('=== FINAL MP4 DENETİMİ ===\n');
line('dosya', video);
line('sha256', r.analyzedVideoHash?.slice(0, 16) + '…');
line('süre', `${r.durationSeconds}s`);
line('örneklenen kare', `${r.sampledFrames} @ ${r.fps}fps`);
console.log('');
line('hook görünme', JSON.stringify(r.hookOccurrences));
line('diyagram görünme', JSON.stringify(r.diagramOccurrences));
line('CTA görünme', JSON.stringify(r.ctaOccurrences));
line('bildirilmemiş katman', r.undeclaredOverlays?.join(', ') || 'yok');
console.log('');
line('kopya plan', r.duplicateShots?.length ?? '—');
if (r.duplicateShots?.length) {
  for (const d of r.duplicateShots.slice(0, 5)) {
    console.log(`   ↔ ${d.runs.map((x) => x.join('-') + 's').join('  ve  ')} (arada ${d.gapSeconds}s)`);
  }
}
line('değişim temposu', `${r.meanChangeIntervalSeconds}s ortalama (hedef 1.2-1.8s)`);
line('en uzun donuk', `${r.longestNoChangeSeconds}s`);
line('algılanan değişim', `${r.perceptibleChangeCount} kez`);
line('kopya kare grubu', r.duplicateFrameGroups?.length ?? '—');
line('kopya altyazı', r.duplicateCaptions ?? '—');
line('en uzun durağan', `${r.longestStaticStreakSeconds}s`);
line('sahne sırası', r.sceneOrderValid ? 'geçerli' : 'BOZUK');
if (r.timelineIntegrity?.problems?.length) {
  console.log('   sorunlar:', r.timelineIntegrity.problems.slice(0, 8).join(', '));
}

console.log('');
if (r.failures?.length) {
  console.log('⛔ BAŞARISIZ — upload engellenmeli:');
  for (const f of r.failures) console.log(`   ✗ ${f}`);
} else {
  console.log('✅ doğrulama geçti (plan verilmediyse bindirme ölçütleri atlanmıştır)');
}
for (const w of r.warnings || []) console.log(`   ! ${w}`);

process.exit(r.failures?.length ? 1 : 0);
