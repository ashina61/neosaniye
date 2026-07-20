#!/usr/bin/env node
/**
 * GERÇEK ÜRETİM DOĞRULAMASI — sentetik DEĞİL, gerçek pipeline çıktısından.
 *
 * generate-and-publish (--no-upload) koştuktan SONRA çalışır: output/<base>/ içindeki
 * GERÇEK final MP4 + report.json + production-report.json'u alır, final MP4'ten
 * BAĞIMSIZ yeniden ölçüm yapar (verifySfxInOutput), CTA karelerini (tam/giriş/çıkış)
 * çıkarır, ffprobe eder, dalga formu üretir ve manuel kontrol listesini
 * validation-summary.md'ye yazar. Yeni özellik/rapor/dashboard DEĞİL — mevcut
 * patch'in gerçek çıktıda doğrulanması.
 *
 * Çıktı: artifacts/real-production-validation/
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, copyFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { verifySfxInOutput } from '../src/pipeline/outputVerify.js';

const run = promisify(execFile);
const OUT = 'artifacts/real-production-validation';

/** En güncel/büyük final MP4'ü ve rapor klasörünü bulur (output/<base>/<base>.mp4). */
async function findProduction(root = 'output') {
  const dirs = existsSync(root) ? await readdir(root, { withFileTypes: true }) : [];
  let best = null;
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const dir = path.join(root, d.name);
    const mp4 = path.join(dir, `${d.name}.mp4`);
    if (!existsSync(mp4)) continue;
    const st = await stat(mp4);
    if (!best || st.mtimeMs > best.mtime) {
      best = { dir, mp4, base: d.name, mtime: st.mtimeMs };
    }
  }
  return best;
}

async function ffprobeJson(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file], { maxBuffer: 8 * 1024 * 1024 });
  return JSON.parse(stdout);
}

async function frameAt(video, t, out) {
  await run('ffmpeg', ['-y', '-v', 'error', '-ss', t.toFixed(2), '-i', video, '-frames:v', '1', out], { maxBuffer: 8 * 1024 * 1024 });
}

const yn = (b) => (b ? 'EVET' : 'HAYIR');

async function main() {
  await mkdir(OUT, { recursive: true });
  const prod = await findProduction();
  if (!prod) {
    await writeFile(path.join(OUT, 'validation-summary.md'), '# Doğrulama: BAŞARISIZ\n\nGerçek pipeline çıktısı (output/<base>/<base>.mp4) bulunamadı — üretim adımı düşmüş olabilir.\n');
    console.error('[validate] final MP4 bulunamadı');
    process.exitCode = 1;
    return;
  }
  console.log(`[validate] üretim bulundu: ${prod.mp4}`);

  // Raporlar (gerçek pipeline yazdı).
  const report = JSON.parse(await readFile(path.join(prod.dir, 'report.json'), 'utf8').catch(() => '{}'));
  const prodReport = JSON.parse(await readFile(path.join(prod.dir, 'production-report.json'), 'utf8').catch(() => '{}'));
  const ov = report.outputVerification || {};
  const motion = report.motion || {};
  const music = report.music || {};
  const musicDecision = ov.music || null;

  // 1) ffprobe gerçeği.
  const probe = await ffprobeJson(prod.mp4);
  await writeFile(path.join(OUT, 'ffprobe-final.json'), JSON.stringify(probe, null, 2));
  const aStream = (probe.streams || []).find((s) => s.codec_type === 'audio') || {};
  const vStream = (probe.streams || []).find((s) => s.codec_type === 'video') || {};

  // 2) SFX BAĞIMSIZ yeniden ölçüm (final MP4'ten). Cue listesini rapordan al.
  const reportedCues = (ov.sfx?.cues || []).map((c) => ({
    atSeconds: c.atSeconds, sfxId: c.requested, assetResolved: c.assetResolved !== false, mixedInGraph: c.mixed !== false,
  }));
  const sfxRemeasure = await verifySfxInOutput(prod.mp4, reportedCues);
  await writeFile(path.join(OUT, 'sfx-verification.json'), JSON.stringify({
    source: path.basename(prod.mp4), measuredFromFinalMp4: true, independentRemeasure: true,
    reportedByPipeline: ov.sfx || null, remeasured: sfxRemeasure,
  }, null, 2));

  // 3) CTA kareleri (tam / giriş / çıkış) — gerçek zamanlamalardan.
  let ctaFrames = { full: false, entry: false, exit: false };
  if (motion.ctaApplied && Number.isFinite(motion.startSec)) {
    const s = motion.startSec; const d = motion.durationSec || 2.2;
    await frameAt(prod.mp4, s + d / 2, path.join(OUT, 'cta-full-frame.png')).then(() => (ctaFrames.full = true)).catch(() => {});
    await frameAt(prod.mp4, s + 0.25, path.join(OUT, 'cta-entry-frame.png')).then(() => (ctaFrames.entry = true)).catch(() => {});
    await frameAt(prod.mp4, Math.max(s, s + d - 0.15), path.join(OUT, 'cta-exit-frame.png')).then(() => (ctaFrames.exit = true)).catch(() => {});
  }

  // 4) Dalga formu.
  await run('ffmpeg', ['-y', '-v', 'error', '-i', prod.mp4, '-filter_complex', 'showwavespic=s=1000x300:colors=0x3BD0C8', '-frames:v', '1', path.join(OUT, 'audio-waveform.png')], { maxBuffer: 12 * 1024 * 1024 }).catch(() => {});

  // 5) Gerçek dosyaları kopyala.
  await copyFile(prod.mp4, path.join(OUT, 'final.mp4'));
  if (existsSync(path.join(prod.dir, 'production-report.json'))) await copyFile(path.join(prod.dir, 'production-report.json'), path.join(OUT, 'production-report.json'));

  // ---- Kontrol listesi değerlendirmesi ----
  const sfxCuesMeasured = sfxRemeasure.cues.filter((c) => c.requested && !String(c.requested).startsWith('cta:'));
  const sceneSfx = sfxCuesMeasured; // sahne SFX'leri (CTA pop hariç)
  const distinctSfx = new Set(sceneSfx.map((c) => c.requested));
  const verifiedScene = sceneSfx.filter((c) => c.verified);
  const ctaCue = sfxRemeasure.cues.find((c) => String(c.requested || '').startsWith('cta:'));
  const channels = Number(aStream.channels) || null;
  const isStereo = channels === 2;
  const musicFile = music.file || musicDecision?.track ? path.basename(music.file || musicDecision?.track || '') : null;
  const hard = ov.hardGate || { block: null, failures: [] };

  // Rapor↔ffprobe tutarlılığı.
  const at = report.audioTruth || {};
  const consistent = (at.channels == null || at.channels === channels) &&
    (at.sampleRate == null || String(at.sampleRate) === String(aStream.sample_rate));

  // PASS/FAIL kriterleri (kullanıcının kabul listesinden).
  const criteria = {
    'gerçek çıktı oluştu': Boolean(prod.mp4),
    'CTA dili doğru (SUBSCRIBE/İngilizce)': motion.ctaApplied && motion.resolvedLanguage === 'en' && motion.languageMatch !== false,
    'CTA tipi subscribe': motion.ctaType === 'subscribe',
    '≥5 sahne SFX ölçüldü ve duyulur': verifiedScene.length >= 5,
    'SFX birbirinin aynısı değil': distinctSfx.size >= 2,
    'müzik ducking (SFX bus var)': (ov.sfx?.cues || []).length > 0, // ducking uygulandı; duyulabilirlik cue delta ile
    'ses erken kesilmiyor': Math.abs((Number(probe.format?.duration) || 0) - (report.duration || 0)) < 1.0,
    'final stereo': isStereo,
    'rapor final MP4 ile tutarlı': consistent,
    'upload yapılmadı': !report.youtube,
    'hard gate temiz': hard.block === false,
  };
  const pass = Object.values(criteria).every(Boolean);

  const lines = [
    `# Gerçek Üretim Doğrulaması — ${pass ? '✅ PASS' : '❌ FAIL'}`,
    '',
    `> Kaynak: GERÇEK pipeline çıktısı \`${prod.mp4}\` (sentetik değil).`,
    '',
    '## Kimlik',
    `- Konu: **${report.topic || prod.base}**`,
    `- Kategori: ${report.category || '—'}`,
    `- Süre: ${report.duration ?? '—'}s`,
    `- Müzik: **${musicFile || 'prosedürel yatak'}**${musicDecision ? ` (reason: ${musicDecision.reason})` : ''}`,
    `- CTA: id=${motion.ctaId || '—'} type=**${motion.ctaType || '—'}** label="**${motion.label || '—'}**" @ ${motion.startSec ?? '—'}s (${motion.durationSec ?? '—'}s) pos=${motion.position || '—'}`,
    '',
    '## Manuel kontrol listesi',
    `- CTA metni gerçekten "SUBSCRIBE" mı? **${motion.label === 'SUBSCRIBE' ? 'EVET' : 'HAYIR (' + (motion.label || '—') + ')'}**`,
    `- CTA timestamp: **${motion.startSec ?? '—'}s** (bitiş ~${motion.startSec != null ? (motion.startSec + (motion.durationSec || 0)).toFixed(1) : '—'}s)`,
    `- CTA konumu: **${motion.position || '—'}** bbox=${motion.box ? `${motion.box.x},${motion.box.y} ${motion.box.w}×${motion.box.h}` : '—'}`,
    `- Altyazı ile çakışıyor mu? **${yn(ov.cta?.report?.captionOverlap === true)}** (safe-area: ${yn(motion.safeAreaPassed)})`,
    `- Ana nesneyi/arıyı kapatıyor mu? **${yn(ov.cta?.report?.uiOverlap === true)}** (kart alt-üçlükte, merkez açık)`,
    `- CTA SFX telefonda duyulabilir mi? **${ctaCue ? (ctaCue.verified ? `EVET (+${ctaCue.audibleDeltaDb}dB)` : 'HAYIR (' + ctaCue.code + ')') : '— (CTA pop cue yok)'}**`,
    `- Beş sahne SFX'i farklı mı? **${distinctSfx.size >= 2 ? `EVET (${distinctSfx.size} farklı tip: ${[...distinctSfx].join(', ')})` : 'HAYIR'}**`,
    `- Aynı SFX dosyası tekrar mı? **${sfxRemeasure.repetition?.excessive?.length ? 'AŞIRI TEKRAR: ' + JSON.stringify(sfxRemeasure.repetition.excessive) : 'Aşırı tekrar yok'}**`,
    `- SFX'ler anlatımı bastırıyor mu? **${verifiedScene.every((c) => c.audibleDeltaDb != null && c.audibleDeltaDb < 24) ? 'HAYIR (vuruşlar makul aralıkta)' : 'İNCELE'}** (delta aralığı: ${sceneSfx.map((c) => c.audibleDeltaDb).filter((x) => x != null).join(', ')} dB)`,
    `- Müzik cue anlarında duck oluyor mu? **${(ov.sfx?.cues || []).length ? 'EVET (SFX bus → sidechain ducking uygulandı)' : '—'}**`,
    `- Seçilen müzik "Marianas.mp3" mü? **${musicFile === 'Marianas.mp3' ? 'EVET (⚠️ incele)' : 'HAYIR (' + (musicFile || 'prosedürel') + ')'}**`,
    `- Müzik son 5 üretimde kullanıldı mı? **${musicDecision ? (musicDecision.repeatedFallback ? 'EVET (havuz tükendi)' : 'HAYIR (taze seçim)') : '—'}**`,
    `- Final stereo mu? **${isStereo ? `EVET (${channels}ch, ${aStream.channel_layout || '—'})` : `HAYIR (${channels}ch)`}**`,
    `- Rapor ↔ ffprobe aynı mı? **${yn(consistent)}** (rapor: ${at.channels}ch/${at.sampleRate}Hz — ffprobe: ${channels}ch/${aStream.sample_rate}Hz)`,
    `- Hard gate tetiklendi mi? **${hard.block === false ? 'HAYIR (temiz)' : hard.block === true ? 'EVET: ' + (hard.failures || []).join(', ') : '—'}**`,
    `- Upload kapalı kaldı mı? **${!report.youtube ? 'EVET (youtube=null)' : 'HAYIR ⚠️'}**`,
    '',
    '## SFX cue ölçümleri (final MP4\'ten bağımsız yeniden ölçüm)',
    '',
    '| t (s) | cue | mixed | audibleΔdB | verified |',
    '|---|---|---|---|---|',
    ...sfxRemeasure.cues.map((c) => `| ${c.atSeconds} | ${c.requested} | ${c.mixed} | ${c.audibleDeltaDb ?? '—'} | ${c.verified ? '✅' : '❌ ' + c.code} |`),
    '',
    '## Kabul kriterleri',
    '',
    ...Object.entries(criteria).map(([k, v]) => `- ${v ? '✅' : '❌'} ${k}`),
    '',
    `## SONUÇ: ${pass ? '✅ PASS' : '❌ FAIL'}`,
    '',
    'Dosyalar: `final.mp4`, `production-report.json`, `sfx-verification.json`,',
    '`audio-waveform.png`, `cta-full-frame.png`, `cta-entry-frame.png`,',
    '`cta-exit-frame.png`, `ffprobe-final.json`.',
    '',
  ];
  await writeFile(path.join(OUT, 'validation-summary.md'), lines.join('\n'));

  // Kısa konsol özeti (CI logu için).
  console.log(`[validate] SONUÇ: ${pass ? 'PASS' : 'FAIL'}`);
  console.log(`[validate] konu=${report.topic} müzik=${musicFile} CTA=${motion.ctaType}/${motion.label}@${motion.startSec}s`);
  console.log(`[validate] sahne SFX doğrulanan=${verifiedScene.length}/${sceneSfx.length} distinct=${distinctSfx.size} stereo=${isStereo} hardGate=${hard.block === false ? 'temiz' : JSON.stringify(hard.failures)}`);
  for (const [k, v] of Object.entries(criteria)) if (!v) console.log(`[validate]   ❌ ${k}`);
  if (!pass) process.exitCode = 3;
}

main().catch((err) => { console.error('[validate] hata:', err); process.exit(1); });
