#!/usr/bin/env node
/**
 * GERÇEK ÜRETİM DOĞRULAMASI — sentetik DEĞİL, gerçek pipeline çıktısından.
 *
 * İKİ MOD (kabul kararı sadece editorial moddan çıkar):
 *   --mode=plumbing : mekanik/zorlanmış SFX. YALNIZCA mikser+output katmanı.
 *                     Sonuç: MIX_PIPELINE_PASS/FAIL. production-ready ÜRETMEZ.
 *   --mode=editorial: gerçek production konfigürasyonu (crew açık, SFX zorlanmaz).
 *                     Sistem SFX'i konuya/sahneye göre KENDİ seçer. overallResult
 *                     PASS yalnızca burada verilebilir.
 *
 * Kaynak gerçek: output/<base>/<base>.mp4 + report.json (rapor değil, MP4 ölçülür).
 * Çıktı: artifacts/real-production-validation/
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, copyFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { verifySfxInOutput } from '../src/pipeline/outputVerify.js';
import { ctaMeta } from '../src/motion/ctaTemplates.js';

const run = promisify(execFile);
const OUT = 'artifacts/real-production-validation';
const MODE = (process.argv.find((a) => a.startsWith('--mode=')) || '--mode=editorial').split('=')[1];

// SFX tipi → sahne semantiği beklentisi (kaba sezgisel — insan değerlendirmesine yardımcı).
const FIT = {
  riser: /\b(rise|rising|build|grow|climb|increase|higher|soar|approach|about to|then|until|next|reach)\b/i,
  impact: /\b(reveal|turns out|but|actually|boom|hit|crash|impact|suddenly|finally|answer|secret|truth|shock|discover|realize)\b/i,
  shimmer: /\b(glow|shine|shimmer|sparkle|magic|beautiful|wonder|light|gold|crystal|glisten|gleam|marvel|elegant|perfect)\b/i,
  whoosh: /.*/, // geçiş sesi — her sahnede kabul edilebilir
};

async function findProduction(root = 'output') {
  const dirs = existsSync(root) ? await readdir(root, { withFileTypes: true }) : [];
  let best = null;
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const mp4 = path.join(root, d.name, `${d.name}.mp4`);
    if (!existsSync(mp4)) continue;
    const st = await stat(mp4);
    if (!best || st.mtimeMs > best.mtime) best = { dir: path.join(root, d.name), mp4, base: d.name, mtime: st.mtimeMs };
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
const R = (b) => (b ? 'PASS' : 'FAIL');

/** data/videos.json'dan bu videodan ÖNCEki son 5 videonun SFX tiplerini topla. */
async function recentSfxTypes(currentPath) {
  try {
    const list = JSON.parse(await readFile('data/videos.json', 'utf8'));
    const prior = list.filter((v) => v.videoPath !== currentPath && Array.isArray(v.audioSfx));
    return prior.slice(-5).flatMap((v) => v.audioSfx);
  } catch { return []; }
}

/**
 * Editoryal koşunun RESOLVED CONFIG kapısı: koşu, gerçek editoryal koşulları
 * taşımıyorsa ÖLÇÜME BİLE GEÇMEDEN hemen FAIL. Kaynak: koşuda geçerli env
 * (JOB seviyesinde ayarlandığı için hem üret hem doğrula adımı aynısını görür).
 * @returns {{config:object, invalid:string[]}}
 */
function resolveEditorialConfig() {
  // config ile birebir: crew, CREW_ENABLED !== '0' ise açık. Mekanik = '0'.
  const crewEnabled = process.env.CREW_ENABLED !== '0';
  const mechanical = process.env.CREW_ENABLED === '0';
  const ctaType = process.env.MOTION_CTA_TYPES || '';
  const lang = process.env.CONTENT_LANGUAGE || 'en';
  const ctaLabel = ctaMeta(ctaType || 'subscribe', lang).label;
  const uploadEnabled = Boolean(
    process.env.YOUTUBE_REFRESH_TOKEN || process.env.YOUTUBE_CLIENT_ID || process.env.YOUTUBE_CLIENT_SECRET ||
    process.env.META_USER_TOKEN || process.env.META_PAGE_TOKEN || process.env.META_IG_LOGIN_TOKEN,
  );
  const config = { mode: 'editorial', crewEnabled, sfxForced: mechanical, ctaType: ctaType || null, ctaLabel, uploadEnabled };

  const invalid = [];
  if (crewEnabled !== true) invalid.push('crewEnabled !== true');
  if (mechanical) invalid.push('mekanik SFX modu etkin (CREW_ENABLED=0)');
  if (ctaType !== 'subscribe') invalid.push(`ctaType !== subscribe (${ctaType || '—'})`);
  if (ctaLabel !== 'SUBSCRIBE') invalid.push(`ctaLabel !== SUBSCRIBE (${ctaLabel})`);
  if (uploadEnabled) invalid.push('upload bir platform için açık (kredensiyel mevcut)');
  return { config, invalid };
}

async function main() {
  await mkdir(OUT, { recursive: true });

  // EDİTORYAL RESOLVED-CONFIG KAPISI — ölçümden ÖNCE. Geçersizse hemen FAIL.
  if (MODE === 'editorial') {
    const { config, invalid } = resolveEditorialConfig();
    console.log('[validate] resolvedConfig=' + JSON.stringify(config));
    if (invalid.length) {
      const md = [
        '# Gerçek Editoryal Üretim Doğrulaması — ❌ FAIL',
        '',
        '## EDITORIAL_VALIDATION_CONFIG_INVALID',
        '',
        'Koşu gerçek editoryal koşulları taşımıyor; ölçüme geçilmeden reddedildi.',
        '',
        '```json',
        JSON.stringify(config, null, 2),
        '```',
        '',
        '### İhlaller',
        ...invalid.map((x) => `- ${x}`),
        '',
        '## Sonuçlar',
        '- mixPipelineResult: **N/A**',
        '- editorialSfxResult: **N/A**',
        '- ctaResult: **N/A**',
        '- musicResult: **N/A**',
        '- **overallResult: ❌ FAIL (EDITORIAL_VALIDATION_CONFIG_INVALID)**',
        '',
      ].join('\n');
      await writeFile(path.join(OUT, 'validation-summary.md'), md);
      console.error('[validate] EDITORIAL_VALIDATION_CONFIG_INVALID: ' + invalid.join(' | '));
      process.exitCode = 3;
      return;
    }
  }

  const prod = await findProduction();
  if (!prod) {
    await writeFile(path.join(OUT, 'validation-summary.md'), `# Doğrulama (${MODE}): FAIL\n\nGerçek pipeline çıktısı (output/<base>/<base>.mp4) bulunamadı.\n`);
    console.error('[validate] final MP4 bulunamadı'); process.exitCode = 1; return;
  }
  console.log(`[validate] mod=${MODE} üretim=${prod.mp4}`);

  const report = JSON.parse(await readFile(path.join(prod.dir, 'report.json'), 'utf8').catch(() => '{}'));
  const ov = report.outputVerification || {};
  const motion = report.motion || {};
  const music = report.music || {};
  const musicDecision = ov.music || null;
  const editorialSfx = ov.editorialSfx || [];

  // ffprobe gerçeği
  const probe = await ffprobeJson(prod.mp4);
  await writeFile(path.join(OUT, 'ffprobe-final.json'), JSON.stringify(probe, null, 2));
  const aStream = (probe.streams || []).find((s) => s.codec_type === 'audio') || {};
  const channels = Number(aStream.channels) || null;
  const isStereo = channels === 2;

  // SFX BAĞIMSIZ yeniden ölçüm (final MP4'ten)
  const reportedCues = (ov.sfx?.cues || []).map((c) => ({ atSeconds: c.atSeconds, sfxId: c.requested, assetResolved: c.assetResolved !== false, mixedInGraph: c.mixed !== false }));
  const sfxRemeasure = await verifySfxInOutput(prod.mp4, reportedCues);
  await writeFile(path.join(OUT, 'sfx-verification.json'), JSON.stringify({ source: path.basename(prod.mp4), mode: MODE, measuredFromFinalMp4: true, independentRemeasure: true, reportedByPipeline: ov.sfx || null, remeasured: sfxRemeasure, editorialSfx }, null, 2));

  // CTA kareleri
  const ctaFrames = {};
  if (motion.ctaApplied && Number.isFinite(motion.startSec)) {
    const s = motion.startSec; const d = motion.durationSec || 2.2;
    await frameAt(prod.mp4, s + d / 2, path.join(OUT, 'cta-full-frame.png')).then(() => (ctaFrames.full = true)).catch(() => {});
    await frameAt(prod.mp4, s + 0.25, path.join(OUT, 'cta-entry-frame.png')).then(() => (ctaFrames.entry = true)).catch(() => {});
    await frameAt(prod.mp4, Math.max(s, s + d - 0.15), path.join(OUT, 'cta-exit-frame.png')).then(() => (ctaFrames.exit = true)).catch(() => {});
  }
  await run('ffmpeg', ['-y', '-v', 'error', '-i', prod.mp4, '-filter_complex', 'showwavespic=s=1000x300:colors=0x3BD0C8', '-frames:v', '1', path.join(OUT, 'audio-waveform.png')], { maxBuffer: 12 * 1024 * 1024 }).catch(() => {});
  await copyFile(prod.mp4, path.join(OUT, 'final.mp4'));
  if (existsSync(path.join(prod.dir, 'production-report.json'))) await copyFile(path.join(prod.dir, 'production-report.json'), path.join(OUT, 'production-report.json'));

  // ---- ölçüm türevleri ----
  const sceneCues = sfxRemeasure.cues.filter((c) => c.requested && !String(c.requested).startsWith('cta:'));
  const ctaCue = sfxRemeasure.cues.find((c) => String(c.requested || '').startsWith('cta:'));
  const distinct = new Set(sceneCues.map((c) => c.requested));
  const verifiedScene = sceneCues.filter((c) => c.verified);
  const allSceneAudible = sceneCues.length > 0 && sceneCues.every((c) => c.verified);
  const excessiveRepeat = (sfxRemeasure.repetition?.excessive || []).length > 0;
  const overpowering = sceneCues.some((c) => c.audibleDeltaDb != null && c.audibleDeltaDb > 30); // TTS'i ezen aşırı vuruş
  const duration = Number(probe.format?.duration) || 0;
  const noEarlyCutoff = Math.abs(duration - (report.duration || 0)) < 1.0;
  const musicFile = (music.file || musicDecision?.track) ? path.basename(music.file || musicDecision?.track) : null;
  const hard = ov.hardGate || { block: null, failures: [] };
  const at = report.audioTruth || {};
  const consistent = (at.channels == null || at.channels === channels) && (at.sampleRate == null || String(at.sampleRate) === String(aStream.sample_rate));
  const uploadOff = !report.youtube;

  // Editoryal SFX semantik uyum (advisory) + tip dağılımı
  const dominant = (() => { const m = {}; for (const c of sceneCues) m[c.requested] = (m[c.requested] || 0) + 1; const top = Object.entries(m).sort((a, b) => b[1] - a[1])[0]; return top ? { type: top[0], share: sceneCues.length ? top[1] / sceneCues.length : 0 } : null; })();
  const fitRows = editorialSfx.map((e) => ({ ...e, fit: FIT[e.type] ? FIT[e.type].test(e.narration || '') : null }));
  const shimmerCount = editorialSfx.filter((e) => e.type === 'shimmer').length;
  const shimmerSpam = editorialSfx.length > 0 && shimmerCount / editorialSfx.length > 0.5;
  const recent = await recentSfxTypes(prod.videoPath || report.videoPath || '');
  const recentOverlap = [...distinct].filter((t) => recent.includes(t));

  // ---- SONUÇLAR ----
  // mixPipelineResult: mikser + output katmanı (her iki modda geçerli).
  const mixPipelinePass = allSceneAudible && isStereo && noEarlyCutoff && hard.block === false && !excessiveRepeat;

  // editorialSfxResult: sistem KENDİ seçti; sayı zorlanmaz; dolgu (spam) = FAIL.
  const editorialSfxPass = sceneCues.length >= 1 && allSceneAudible && !excessiveRepeat && !shimmerSpam && !(dominant && dominant.share > 0.6 && sceneCues.length >= 3) && !overpowering;

  // ctaResult
  const ctaPass = motion.ctaApplied && motion.label === 'SUBSCRIBE' && motion.resolvedLanguage === 'en' && motion.languageMatch !== false &&
    ov.cta?.report?.captionOverlap !== true && ov.cta?.report?.uiOverlap !== true && (ctaCue ? ctaCue.verified : true);

  // musicResult: gerçek/taze parça; recent-5 tekrarı yok; sessiz-fallback yok.
  const musicPass = Boolean(musicFile) && !musicDecision?.silentFallback && !musicDecision?.repeatedFallback && !recent.includes('__music__' + musicFile);

  // overallResult: SADECE editorial modda ve tüm editoryal koşullar geçince PASS.
  const overallPass = MODE === 'editorial'
    ? (editorialSfxPass && ctaPass && musicPass && mixPipelinePass && isStereo && consistent && uploadOff && hard.block === false)
    : null; // plumbing → production-ready kararı YOK

  const lines = [];
  if (MODE === 'plumbing') {
    lines.push(
      `# Ses Boru Hattı Doğrulaması (plumbing) — MIX_PIPELINE_${R(mixPipelinePass)}`,
      '',
      '> ⚠️ Bu koşu YALNIZCA mikser + output verification katmanını test eder',
      '> (mekanik/zorlanmış SFX). Editoryal seçimi TEST ETMEZ. **production-ready',
      '> kararı ÜRETMEZ** — o yalnızca real-editorial koşusundan çıkar.',
      '',
      `- Kaynak: \`${prod.mp4}\``,
      `- Sahne SFX ölçülen/duyulur: **${verifiedScene.length}/${sceneCues.length}**`,
      `- Hepsi duyulur mu (final MP4): **${yn(allSceneAudible)}**`,
      `- Stereo: **${yn(isStereo)}** (${channels}ch)`,
      `- Ses erken kesilmiyor: **${yn(noEarlyCutoff)}** (mp4 ${duration.toFixed(2)}s / rapor ${report.duration}s)`,
      `- Aşırı SFX tekrarı: **${yn(excessiveRepeat)}**`,
      `- Hard gate: **${hard.block === false ? 'temiz' : JSON.stringify(hard.failures)}**`,
      '',
      '## SFX cue ölçümleri (final MP4)',
      '| t (s) | cue | mixed | audibleΔdB | verified |',
      '|---|---|---|---|---|',
      ...sfxRemeasure.cues.map((c) => `| ${c.atSeconds} | ${c.requested} | ${c.mixed} | ${c.audibleDeltaDb ?? '—'} | ${c.verified ? '✅' : '❌ ' + c.code} |`),
      '',
      '## Sonuçlar',
      `- mixPipelineResult: **${R(mixPipelinePass)}**`,
      `- editorialSfxResult: **N/A (mekanik koşu)**`,
      `- ctaResult: **N/A**`,
      `- musicResult: **N/A**`,
      `- overallResult: **N/A — plumbing production-ready üretmez**`,
      '',
    );
  } else {
    lines.push(
      `# Gerçek Editoryal Üretim Doğrulaması — overallResult: ${overallPass ? '✅ PASS' : '❌ FAIL'}`,
      '',
      '> Gerçek production konfigürasyonu (crew AÇIK, SFX zorlanmadı). Sistem SFX\'i',
      `> konu/sahneye göre KENDİ seçti. Kaynak: \`${prod.mp4}\` (rapor değil, MP4 ölçüldü).`,
      '',
      '## Kimlik',
      `- Konu: **${report.topic || prod.base}** | Kategori: ${report.category || '—'} | Süre: ${report.duration ?? '—'}s`,
      `- Müzik: **${musicFile || 'prosedürel'}**${musicDecision ? ` (${musicDecision.reason})` : ''}`,
      `- CTA: type=**${motion.ctaType}** label="**${motion.label}**" @ ${motion.startSec}s pos=${motion.position}`,
      '',
      '## Editoryal SFX (sistem kendi seçti — sayı zorlanmadı)',
      `- Kaç SFX seçildi: **${editorialSfx.length}** (ölçülen sahne cue: ${sceneCues.length})`,
      `- Tipler/kategoriler: ${[...distinct].join(', ') || '—'}`,
      `- Aynı tip tekrarı: ${dominant ? `en baskın **${dominant.type}** %${Math.round(dominant.share * 100)}` : '—'}${excessiveRepeat ? ' ⚠️ AŞIRI' : ''}`,
      `- Son 5 videoda kullanılan tiplerle örtüşme: ${recentOverlap.length ? recentOverlap.join(', ') : 'yok'} ${recent.length ? '' : '(geçmiş SFX verisi yok)'}`,
      `- Hepsi final MP4\'te duyulur mu: **${yn(allSceneAudible)}** (${verifiedScene.length}/${sceneCues.length})`,
      `- TTS\'i bastıran aşırı vuruş: **${yn(overpowering)}**`,
      `- Ambience video boyunca: **${ov.ambience ? 'EVET (' + ov.ambience + ')' : 'HAYIR'}**`,
      `- Shimmer uygunsuz spam: **${yn(shimmerSpam)}** (shimmer ${shimmerCount}/${editorialSfx.length})`,
      '',
      '### SFX ↔ sahne semantik uyum (advisory)',
      '| t (s) | tip | sahne | uyum | anlatım |',
      '|---|---|---|---|---|',
      ...fitRows.map((e) => `| ${e.atSeconds} | ${e.type} | ${e.sceneIndex ?? '—'} | ${e.fit === null ? '—' : e.fit ? '✓' : '?'} | ${(e.narration || '').replace(/\|/g, '/').slice(0, 70)} |`),
      '',
      '## Kontrol listesi',
      `- Kaç SFX kendiliğinden seçildi? **${editorialSfx.length}**`,
      `- Her SFX asset/kategori? **${editorialSfx.map((e) => e.type).join(', ') || '—'}** (sentezlenmiş, tip=kategori)`,
      `- Aynı dosya tekrar mı? **${excessiveRepeat ? 'AŞIRI: ' + JSON.stringify(sfxRemeasure.repetition.excessive) : 'aşırı yok'}**`,
      `- Son 5 videoda aynı SFX? **${recentOverlap.length ? 'EVET (' + recentOverlap.join(', ') + ')' : 'HAYIR / veri yok'}**`,
      `- SFX sahne semantiğiyle uyumlu mu? **${fitRows.filter((e) => e.fit === true).length}/${fitRows.length} açık uyum (kalanı advisory)**`,
      `- Riser build anında mı? **${riserVerdict(fitRows)}**`,
      `- Impact reveal/payoff anında mı? **${impactVerdict(fitRows)}**`,
      `- Shimmer uygunsuz her sahnede mi? **${shimmerSpam ? 'EVET ⚠️' : 'HAYIR'}**`,
      `- Ambience var mı? **${ov.ambience ? 'EVET' : 'HAYIR'}**`,
      `- SFX TTS\'i bastırıyor mu? **${overpowering ? 'EVET ⚠️' : 'HAYIR'}**`,
      `- Final MP4\'te duyuluyor mu? **${yn(allSceneAudible)}**`,
      '',
      '## CTA',
      `- Metin "SUBSCRIBE" mı? **${motion.label === 'SUBSCRIBE' ? 'EVET' : 'HAYIR (' + motion.label + ')'}**`,
      `- Timestamp/pozisyon: **${motion.startSec}s / ${motion.position}** bbox=${motion.box ? `${motion.box.x},${motion.box.y} ${motion.box.w}×${motion.box.h}` : '—'}`,
      `- Altyazı/ana nesne çakışması: **${ov.cta?.report?.captionOverlap === true || ov.cta?.report?.uiOverlap === true ? 'VAR ⚠️' : 'yok'}**`,
      `- CTA SFX duyulur: **${ctaCue ? (ctaCue.verified ? `EVET (+${ctaCue.audibleDeltaDb}dB)` : 'HAYIR (' + ctaCue.code + ')') : '—'}**`,
      '',
      '## Müzik',
      `- Seçilen: **${musicFile || 'prosedürel'}** | "Marianas.mp3" mı? **${musicFile === 'Marianas.mp3' ? 'EVET ⚠️' : 'HAYIR'}**`,
      `- Taze mi (tekrar/sessiz fallback yok): **${yn(!musicDecision?.repeatedFallback && !musicDecision?.silentFallback)}**`,
      '',
      '## Kanal / tutarlılık / upload',
      `- Stereo: **${yn(isStereo)}** (${channels}ch, ${aStream.channel_layout || '—'})`,
      `- Rapor ↔ ffprobe: **${yn(consistent)}**`,
      `- Ses erken kesilmiyor: **${yn(noEarlyCutoff)}**`,
      `- Hard gate: **${hard.block === false ? 'temiz' : JSON.stringify(hard.failures)}**`,
      `- Upload kapalı: **${yn(uploadOff)}**`,
      '',
      '## Sonuçlar',
      `- mixPipelineResult: **${R(mixPipelinePass)}**`,
      `- editorialSfxResult: **${R(editorialSfxPass)}**`,
      `- ctaResult: **${R(ctaPass)}**`,
      `- musicResult: **${R(musicPass)}**`,
      `- **overallResult: ${overallPass ? '✅ PASS' : '❌ FAIL'}**`,
      '',
      'Dosyalar: final.mp4, production-report.json, sfx-verification.json, audio-waveform.png, cta-*-frame.png, ffprobe-final.json.',
      '',
    );
  }
  await writeFile(path.join(OUT, 'validation-summary.md'), lines.join('\n'));

  console.log(`[validate] mod=${MODE} mixPipeline=${R(mixPipelinePass)}` + (MODE === 'editorial' ? ` editorialSfx=${R(editorialSfxPass)} cta=${R(ctaPass)} music=${R(musicPass)} overall=${overallPass ? 'PASS' : 'FAIL'}` : ' overall=N/A'));
  console.log(`[validate] konu=${report.topic} müzik=${musicFile} CTA=${motion.ctaType}/${motion.label}@${motion.startSec}s SFX=${editorialSfx.map((e) => e.type).join(',')}`);
  if (MODE === 'editorial' && !overallPass) process.exitCode = 3;
  if (MODE === 'plumbing' && !mixPipelinePass) process.exitCode = 3;
}

function riserVerdict(rows) {
  const r = rows.filter((e) => e.type === 'riser');
  if (!r.length) return 'riser kullanılmadı';
  const ok = r.filter((e) => e.fit).length;
  return `${ok}/${r.length} build sahnesinde`;
}
function impactVerdict(rows) {
  const r = rows.filter((e) => e.type === 'impact');
  if (!r.length) return 'impact kullanılmadı';
  const ok = r.filter((e) => e.fit).length;
  return `${ok}/${r.length} reveal sahnesinde`;
}

main().catch((err) => { console.error('[validate] hata:', err); process.exit(1); });
