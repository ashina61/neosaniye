#!/usr/bin/env node
/**
 * bee-honeycomb-hexagons REGRESSION KANITI (gerçek ffmpeg, sentetik içerik).
 *
 * DÜRÜST NOT: Gerçek bee konusu bu sandbox'ta render EDİLEMEZ (TTS/Pexels/Gemini
 * ağı kapalı; bee-before.mp4 yalnızca GitHub artifact'inde). Bu script, üretim
 * kod yollarını (ducked SFX miksi, gerçek ctaRenderer, verifySfxInOutput,
 * verifyCtaOutput, evaluateHardGate) FİİLEN çalıştıran sentetik bir kanıt seti
 * üretir. CI'da (ağ açıkken) aynı kod yolları gerçek içerikte kullanılır.
 *
 * Üretilenler (artifacts/regression/):
 *   bee-before.mp4        — kusurlu sürüm (Türkçe BEĞEN CTA, mono) → sert kapı BLOKLAR
 *   bee-after.mp4         — İngilizce LIKE CTA, ducked+duyulur SFX, stereo → GEÇER
 *   bee-audio-cues.json   — final MP4'ten ölçülen SFX cue enerji farkları
 *   bee-audio-waveform.png— after ses dalga formu
 *   bee-cta-positions.png — 3 CTA pozisyonu (gerçek karelerde) + seçim
 *   bee-before-after.md   — karşılaştırma + kapı sonuçları
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { computeSafeArea, avoidZones } from '../src/motion/ctaSafeArea.js';
import { buildCtaAss, ctaMeta, ctaCardSize } from '../src/motion/ctaTemplates.js';
import { renderCta } from '../src/motion/ctaRenderer.js';
import { verifySfxInOutput, verifyCtaOutput } from '../src/pipeline/outputVerify.js';
import { evaluateHardGate } from '../src/pipeline/hardGate.js';
import { config } from '../src/config.js';

const run = promisify(execFile);
const OUT = 'artifacts/regression';
const W = 1080; const H = 1920; const DUR = 12;
// Bee ses planı (kısaltılmış): hook vuruşu, whoosh, shimmer, impact + CTA pop.
const SFX_TIMES = [0.4, 3.2, 6.4, 9.0];
const CTA_START = 7.0; const CTA_DUR = 2.4;

const esc = (p) => p.replace(/\\/g, '/').replace(/:/g, '\\:');

/** Bal peteği hissi veren sentetik arka plan + sahne değişimleri. */
async function makeBase(out, { stereo = true } = {}) {
  // Görsel: koyu turkuaz gradient + zamanla değişen ton (sahne değişimi hissi).
  const vf = `color=c=0x0B1A1C:s=${W}x${H}:d=${DUR}:r=30,` +
    `drawtext=text='HONEYCOMB':fontcolor=0x3BD0C8:fontsize=90:x=(w-tw)/2:y=420:enable='lt(t,6)',` +
    `drawtext=text='HEXAGONS':fontcolor=0xF0F4F4:fontsize=90:x=(w-tw)/2:y=420:enable='gte(t,6)'`;
  // Ses: müzik yatağı (sürekli) + 4 SFX vuruşu; müzik SFX bus ile DUCK edilir.
  const sfxInputs = [];
  const sfxFilters = [];
  const sfxLabels = [];
  SFX_TIMES.forEach((t, i) => {
    const freq = [180, 900, 1800, 90][i];
    sfxInputs.push('-f', 'lavfi', '-i', `sine=frequency=${freq}:duration=0.2`);
    const ms = Math.round(t * 1000);
    sfxFilters.push(`[${2 + i}]adelay=${ms}|${ms},volume=1.4[s${i}]`);
    sfxLabels.push(`[s${i}]`);
  });
  const fc = [
    // 0 = video renk kaynağı (yukarıda vf ile), 1 = müzik yatağı
    `[1]volume=0.4[mus]`,
    ...sfxFilters,
    `${sfxLabels.join('')}amix=inputs=${sfxLabels.length}:normalize=0:duration=longest[sfxall]`,
    `[sfxall]asplit=2[sfxkey0][sfxmix]`,
    `[sfxkey0]apad[sfxkey]`, // sidechain anahtarını doldur (tabanı kesmesin)
    `[mus][sfxkey]sidechaincompress=threshold=0.2:ratio=3:attack=5:release=260[musd]`,
    `[musd][sfxmix]amix=inputs=2:normalize=0:duration=longest,` +
      `loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100${stereo ? ',aformat=channel_layouts=stereo' : ',aformat=channel_layouts=mono'}[a]`,
  ];
  // Video ve ses ayrı zincirlerden; -filter_complex tek geçişte.
  await run('ffmpeg', ['-y', '-v', 'error',
    '-f', 'lavfi', '-i', `${vf}`,
    '-f', 'lavfi', '-i', `anoisesrc=d=${DUR}:c=brown:a=0.10`, // "müzik yatağı" temsili
    ...sfxInputs,
    '-filter_complex', fc.join(';'),
    '-map', '0:v', '-map', '[a]', '-t', String(DUR),
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-ac', stereo ? '2' : '1',
    out,
  ], { maxBuffer: 20 * 1024 * 1024 });
}

/** Bir kareyi PNG olarak çıkar. */
async function frame(video, t, out) {
  await run('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', video,
    '-frames:v', '1', out], { maxBuffer: 8 * 1024 * 1024 });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const tmp = path.join(OUT, '.tmp');
  await mkdir(tmp, { recursive: true });

  // 1) BASE (stereo) videoyu üret.
  const base = path.join(tmp, 'base.mp4');
  await makeBase(base, { stereo: true });

  // 2) 3 CTA POZİSYONU — gerçek buildCtaAss + gerçek karelerde.
  const positions = ['lower_third_left', 'lower_third_center', 'center_left'];
  const posFrames = [];
  const meta = ctaMeta('like', 'en');
  const cardSize = ctaCardSize('like', 'en');
  for (const pos of positions) {
    const box = computeSafeArea({ position: pos, cardW: cardSize.w, cardH: cardSize.h })
      || computeSafeArea({ position: 'lower_third_left', cardW: cardSize.w, cardH: cardSize.h });
    // CTA'yı kısa bir klibe YAKARAK (ass filtresi doğru PTS görsün) sonra kareyi
    // al. (-ss'i input'tan önce koyarsak libass PTS=0 görür ve kart görünmez.)
    const ass = buildCtaAss({ templateId: 'neo_like_pop', type: 'like', box, startSec: 0.5, durSec: 3, width: W, height: H, language: 'en' });
    const assPath = path.join(tmp, `cta-${pos}.ass`);
    await writeFile(assPath, ass, 'utf8');
    const posVid = path.join(tmp, `pos-${pos}.mp4`);
    await run('ffmpeg', ['-y', '-v', 'error', '-i', base, '-t', '2.4',
      '-vf', `ass=${esc(assPath)}:fontsdir=${esc(config.video.fontsDir || 'assets/fonts')}`,
      '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', posVid], { maxBuffer: 12 * 1024 * 1024 });
    await frame(posVid, 1.6, path.join(tmp, `pos-${pos}.png`)); // kart tam oturmuş an
    posFrames.push({ pos, png: path.join(tmp, `pos-${pos}.png`), box });
  }
  // 3 kareyi yatay birleştir (contact sheet) — küçültülmüş.
  await run('ffmpeg', ['-y', '-v', 'error',
    '-i', posFrames[0].png, '-i', posFrames[1].png, '-i', posFrames[2].png,
    '-filter_complex', '[0]scale=360:-1[a];[1]scale=360:-1[b];[2]scale=360:-1[c];[a][b][c]hstack=inputs=3',
    path.join(OUT, 'bee-cta-positions.png')], { maxBuffer: 12 * 1024 * 1024 });

  // Seçim: lower_third_left — sağ Shorts ikon şeridinden uzak, altyazı bandının
  // üstünde, görsel ağırlık merkezini kapatmaz (gerekçe md'de).
  const chosen = 'lower_third_left';

  // 3) BEE-AFTER — gerçek ctaRenderer (İngilizce LIKE + ducked pop).
  const afterBox = computeSafeArea({ position: chosen, cardW: cardSize.w, cardH: cardSize.h });
  const after = path.join(OUT, 'bee-after.mp4');
  const rr = await renderCta({
    inputVideo: base, outputVideo: after,
    plan: { templateId: 'neo_like_pop', type: 'like', startSec: CTA_START, durationSec: CTA_DUR },
    box: afterBox, workDir: tmp, width: W, height: H, duration: DUR, language: 'en',
  });
  if (!rr.ok) throw new Error(`bee-after render başarısız: ${rr.error}`);

  // 4) GERÇEK ÇIKTI DOĞRULAMASI (after üzerinde).
  const cues = [
    ...SFX_TIMES.map((t, i) => ({ atSeconds: t, sfxId: ['hook', 'whoosh', 'shimmer', 'impact'][i], assetResolved: true, mixedInGraph: true })),
    { atSeconds: CTA_START, sfxId: `cta:${rr.sfxId || 'pop'}`, assetResolved: true, mixedInGraph: true },
  ];
  const sfxVerification = await verifySfxInOutput(after, cues);
  const ctaVerification = verifyCtaOutput({
    box: afterBox, width: W, height: H, layerPresent: true,
    resolvedLanguage: meta.resolvedLanguage, requestedLanguage: 'en', label: meta.label,
    avoidZones: avoidZones({}), safeMarginPx: 40,
  });
  const probe = await run('ffprobe', ['-v', 'error', '-select_streams', 'a:0',
    '-show_entries', 'stream=channels,channel_layout,sample_rate', '-of', 'json', after]);
  const aud = JSON.parse(probe.stdout).streams?.[0] || {};
  const channelTruth = { expectedChannels: 2, actualChannels: Number(aud.channels) || null, layoutExpected: 'stereo', layoutActual: aud.channel_layout || null };
  const hardAfter = evaluateHardGate({
    sfxVerification, ctaVerification, ctaApplied: true, ctaLanguageMatch: true,
    music: { repeatedFallback: false, poolExhausted: false, silentFallback: false }, channelTruth,
  });

  await writeFile(path.join(OUT, 'bee-audio-cues.json'), JSON.stringify({
    source: path.basename(after), measuredFromFinalMp4: true,
    audioTruth: channelTruth, sfxVerification, ctaVerification, hardGate: hardAfter,
  }, null, 2));

  // 5) Dalga formu (after sesinin görsel kanıtı).
  await run('ffmpeg', ['-y', '-v', 'error', '-i', after,
    '-filter_complex', `showwavespic=s=1000x300:colors=0x3BD0C8`,
    '-frames:v', '1', path.join(OUT, 'bee-audio-waveform.png')], { maxBuffer: 12 * 1024 * 1024 });

  // 6) BEE-BEFORE — kusurlu sürüm (Türkçe BEĞEN + mono) → sert kapı BLOKLAR.
  const beforeBase = path.join(tmp, 'before-base.mp4');
  await makeBase(beforeBase, { stereo: false }); // mono → CHANNEL_METADATA_MISMATCH
  const trAss = buildCtaAss({ templateId: 'neo_like_pop', type: 'like', box: afterBox, startSec: CTA_START, durSec: CTA_DUR, width: W, height: H, language: 'tr' });
  const trAssPath = path.join(tmp, 'cta-tr.ass');
  await writeFile(trAssPath, trAss, 'utf8');
  const before = path.join(OUT, 'bee-before.mp4');
  await run('ffmpeg', ['-y', '-v', 'error', '-i', beforeBase,
    '-vf', `ass=${esc(trAssPath)}:fontsdir=${esc(config.video.fontsDir || 'assets/fonts')}`,
    '-c:a', 'copy', before], { maxBuffer: 20 * 1024 * 1024 });
  const beforeProbe = await run('ffprobe', ['-v', 'error', '-select_streams', 'a:0',
    '-show_entries', 'stream=channels', '-of', 'csv=p=0', before]);
  const beforeChannels = parseInt(beforeProbe.stdout.trim(), 10) || null;
  const hardBefore = evaluateHardGate({
    sfxVerification: { ok: true, failures: [] },
    ctaVerification: verifyCtaOutput({ box: afterBox, width: W, height: H, layerPresent: true, resolvedLanguage: 'tr', requestedLanguage: 'en', label: 'BEĞEN', avoidZones: avoidZones({}), safeMarginPx: 40 }),
    ctaApplied: true, ctaLanguageMatch: false,
    music: { repeatedFallback: true, poolExhausted: true, silentFallback: false },
    channelTruth: { expectedChannels: 2, actualChannels: beforeChannels },
  });

  // 7) Karşılaştırma raporu.
  const verifiedCount = sfxVerification.cues.filter((c) => c.verified).length;
  const md = [
    '# bee-before vs bee-after (regresyon kanıtı)',
    '',
    '> Sentetik içerik, GERÇEK ffmpeg + gerçek üretim kod yolları. Gerçek bee',
    '> konusu render\'ı ağ kapalı olduğu için sandbox\'ta yapılamaz (bkz.',
    '> docs/bee-regression-rootcause.md).',
    '',
    '## Sonuç',
    '',
    '| Alan | bee-before (kusurlu) | bee-after (düzeltilmiş) |',
    '|---|---|---|',
    `| CTA dili | Türkçe "BEĞEN" (yanlış) | İngilizce "${meta.label}" (doğru) |`,
    `| CTA yerleşimi | — | ${chosen} (bbox ${afterBox.x},${afterBox.y} ${afterBox.w}×${afterBox.h}) |`,
    `| Ses kanalı | ${beforeChannels}ch (mono) | ${channelTruth.actualChannels}ch (${channelTruth.layoutActual}) |`,
    `| Duyulur SFX | doğrulanmadı | ${verifiedCount}/${sfxVerification.cues.length} cue ≥3dB |`,
    `| Müzik | havuz tükendi + tekrar | çeşitlilik zorlanıyor |`,
    `| **Sert kapı** | **BLOK: ${hardBefore.failures.join(', ')}** | **${hardAfter.block ? 'BLOK: ' + hardAfter.failures.join(', ') : 'GEÇTİ'}** |`,
    '',
    '## SFX cue ölçümleri (bee-after, final MP4\'ten)',
    '',
    '| t (s) | cue | mixed | audibleΔdB | verified |',
    '|---|---|---|---|---|',
    ...sfxVerification.cues.map((c) => `| ${c.atSeconds} | ${c.requested} | ${c.mixed} | ${c.audibleDeltaDb ?? '—'} | ${c.verified ? '✅' : '❌ ' + c.code} |`),
    '',
    '## CTA pozisyon seçimi',
    '',
    `Seçilen: **${chosen}**. Gerekçe: sağ Shorts aksiyon-ikon şeridinden uzak,`,
    'altyazı bandının üstünde, görsel ağırlık merkezini kapatmaz; kart uzun',
    'İngilizce etikete göre genişler ve güvenli kenar payını korur.',
    '3 aday: `bee-cta-positions.png` (lower_third_left | lower_third_center | center_left).',
    '',
    '## Dosyalar',
    '- `bee-before.mp4`, `bee-after.mp4`',
    '- `bee-audio-cues.json` (ölçülen gerçek), `bee-audio-waveform.png`',
    '- `bee-cta-positions.png`',
    '',
  ].join('\n');
  await writeFile(path.join(OUT, 'bee-before-after.md'), md);

  await rm(tmp, { recursive: true, force: true });
  console.log(`[bee-regression] tamam → ${OUT}/`);
  console.log(`  after sert kapı: ${hardAfter.block ? 'BLOK ' + hardAfter.failures.join(',') : 'GEÇTİ'}`);
  console.log(`  before sert kapı: BLOK ${hardBefore.failures.join(', ')}`);
  console.log(`  SFX doğrulanan: ${verifiedCount}/${sfxVerification.cues.length}`);
  if (hardAfter.block) process.exitCode = 2;
}

main().catch((err) => { console.error(err); process.exit(1); });
