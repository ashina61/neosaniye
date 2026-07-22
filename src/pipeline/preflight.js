import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { stat } from 'node:fs/promises';
import { config } from '../config.js';

const run = promisify(execFile);
const BUF = { maxBuffer: 20 * 1024 * 1024 };

export function validateRenderPlan(renderPlan) {
  const issues = [];
  if (!renderPlan) return ['RENDER_PLAN_MISSING'];
  if (renderPlan.captionsIncluded !== true || !(renderPlan.captionEventCount > 0)) issues.push('RENDER_PLAN_CAPTIONS_MISSING');
  if (!(renderPlan.expectedSceneCount > 0)) issues.push('RENDER_PLAN_SCENES_MISSING');
  if ((renderPlan.sceneBoundaries?.length || 0) !== Math.max(0, renderPlan.expectedSceneCount - 1)) issues.push('RENDER_PLAN_BOUNDARIES_INCONSISTENT');
  if ((renderPlan.transitions || []).some((x) => !Number.isFinite(x.atSeconds))) issues.push('RENDER_PLAN_TRANSITION_TIME_UNKNOWN');
  if ((renderPlan.motionIssues || []).length) issues.push(...renderPlan.motionIssues);
  return issues;
}

/**
 * Yayın öncesi TEKNİK kalite kontrolü (preflight). Otomatik yayında insan gözü
 * olmadığı için sigorta: bozuk/yanlış video YouTube'a hiç gitmez. Tüm
 * kontroller final MP4 üzerinde ffprobe/ffmpeg ile DETERMİNİSTİK yapılır.
 *
 * SERT hatalar (issues → ok=false, upload her modda durur):
 *  - dosya yok / boyut anormal (0.3-80 MB dışı)
 *  - süre Shorts penceresi dışı (15-65 sn)
 *  - video/ses akışı yok, çözünürlük 1080x1920 değil
 *  - decode hatası (bozuk bitstream)
 *  - tüm örnek kareler siyah
 *
 * YUMUŞAK bulgular (warnings → rapora girer, retention QC skoruna yansır;
 * strict QC modunda skoru düşürerek dolaylı engel olabilir):
 *  - loudness hedef dışı, peak clipping
 *  - siyah/donmuş/sessiz segmentler
 *  - ses-video süre uyumsuzluğu, beklenen süreden sapma, uzun kuyruk sessizliği
 *
 * @param {string} videoPath
 * @param {{expectedDuration?: number}} [opts]
 * @returns {Promise<{ok:boolean, issues:string[], warnings:string[], metrics:object, technical:object}>}
 */
export async function preflightCheck(videoPath, opts = {}) {
  const t = config.preflight;
  const issues = [];
  const warnings = [];
  const metrics = {};
  const technical = {
    videoStreamPresent: false,
    audioStreamPresent: false,
    durationSeconds: null,
    expectedDurationSeconds: opts.expectedDuration ?? null,
    durationDeltaSeconds: null,
    resolution: null,
    fps: null,
    // Ses kanal gerçeği — rapor HEDEF değil ÖLÇÜLEN değeri yazar (ffprobe).
    audioChannels: null,
    audioChannelLayout: null,
    audioSampleRate: null,
    fileSizeMB: null,
    fileSizeBytes: null,
    decodePassed: null,
    blackSegmentCount: 0,
    freezeSegmentCount: 0,
    silenceSegmentCount: 0,
    startBlackSeconds: 0,
    trailingSilenceSeconds: 0,
    audioVideoDurationGapSeconds: null,
    maxVolumeDb: null,
    lufs: null,
  };

  // Boyut
  const st = await stat(videoPath).catch(() => null);
  if (!st) return { ok: false, issues: [`dosya yok: ${videoPath}`], warnings, metrics, technical };
  metrics.sizeMB = +(st.size / 1e6).toFixed(1);
  technical.fileSizeMB = metrics.sizeMB;
  technical.fileSizeBytes = st.size;
  if (st.size < 0.3e6) issues.push(`dosya çok küçük (${metrics.sizeMB} MB)`);
  if (st.size > 80e6) issues.push(`dosya çok büyük (${metrics.sizeMB} MB)`);

  // Süre + çözünürlük + fps + akış süreleri
  let info = null;
  try {
    const { stdout } = await run('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate,duration,channels,channel_layout,sample_rate',
      '-of', 'json', videoPath,
    ], BUF);
    info = JSON.parse(stdout);
  } catch (err) {
    issues.push(`ffprobe dosyayı okuyamadı: ${String(err.message).slice(0, 120)}`);
    return { ok: false, issues, warnings, metrics, technical };
  }
  const duration = parseFloat(info.format?.duration || 0);
  metrics.duration = +duration.toFixed(1);
  technical.durationSeconds = metrics.duration;
  if (duration < 15) issues.push(`süre çok kısa (${metrics.duration}s < 15s)`);
  if (duration > 65) issues.push(`süre Shorts sınırını aşıyor (${metrics.duration}s > 65s)`);
  if (opts.expectedDuration) {
    technical.durationDeltaSeconds = +(duration - opts.expectedDuration).toFixed(2);
    if (Math.abs(technical.durationDeltaSeconds) > t.durationDeltaTolerance) {
      warnings.push(`süre render beklentisinden sapıyor (beklenen ${opts.expectedDuration.toFixed(1)}s, gerçek ${metrics.duration}s)`);
    }
  }

  const vStream = (info.streams || []).find((s) => s.codec_type === 'video');
  const aStream = (info.streams || []).find((s) => s.codec_type === 'audio');
  technical.videoStreamPresent = Boolean(vStream);
  technical.audioStreamPresent = Boolean(aStream);
  if (!vStream) issues.push('video akışı yok');
  if (!aStream) issues.push('ses akışı yok');
  if (aStream) {
    // ÖLÇÜLEN kanal gerçeği (rapor bunu yazar, hedefi değil).
    technical.audioChannels = Number(aStream.channels) || null;
    technical.audioChannelLayout = aStream.channel_layout || null;
    technical.audioSampleRate = Number(aStream.sample_rate) || null;
  }
  if (vStream) {
    technical.resolution = `${vStream.width}x${vStream.height}`;
    if (vStream.width !== 1080 || vStream.height !== 1920) {
      issues.push(`çözünürlük 1080x1920 değil (${technical.resolution})`);
    }
    const [num, den] = String(vStream.r_frame_rate || '0/1').split('/').map(Number);
    technical.fps = den ? +(num / den).toFixed(2) : null;
    if (technical.fps !== null && (technical.fps < 23 || technical.fps > 61)) {
      warnings.push(`frame rate alışılmadık (${technical.fps} fps)`);
    }
    const expectedFps = Number(opts.expectedFps || 30);
    technical.expectedFps = expectedFps;
    if (technical.fps !== null && Math.abs(technical.fps - expectedFps) > 0.2) {
      warnings.push(`frame rate render beklentisinden farklı (${technical.fps}, beklenen ${expectedFps})`);
    }
  }
  // Ses videodan erken mi bitiyor (veya tersi)?
  if (vStream?.duration && aStream?.duration) {
    const gap = +(parseFloat(vStream.duration) - parseFloat(aStream.duration)).toFixed(2);
    technical.audioVideoDurationGapSeconds = gap;
    if (Math.abs(gap) > t.avSyncToleranceSeconds) {
      warnings.push(gap > 0
        ? `ses videodan ${gap}s erken bitiyor`
        : `video sesten ${Math.abs(gap)}s erken bitiyor`);
    }
  }

  const renderPlan = opts.renderPlan || null;
  technical.renderPlan = renderPlan ? {
    captionsIncluded: renderPlan.captionsIncluded === true,
    captionEventCount: Number(renderPlan.captionEventCount) || 0,
    expectedSceneCount: Number(renderPlan.expectedSceneCount) || 0,
    sceneBoundaryCount: renderPlan.sceneBoundaries?.length || 0,
    expectedSfxCount: Number(renderPlan.expectedSfxCount) || 0,
    transitionCount: renderPlan.transitions?.length || 0,
  } : null;
  for (const issue of validateRenderPlan(renderPlan)) warnings.push(`render plan: ${issue}`);

  // DECODE testi: tüm dosya baştan sona çözülür; bitstream hatası varsa yakalanır.
  if (vStream || aStream) {
    try {
      const { stderr } = await run('ffmpeg', ['-v', 'error', '-i', videoPath, '-f', 'null', '-'], BUF);
      const errLines = String(stderr || '').trim();
      technical.decodePassed = errLines === '';
      if (errLines) issues.push(`decode hatası: ${errLines.split('\n')[0].slice(0, 120)}`);
    } catch (err) {
      technical.decodePassed = false;
      issues.push(`decode başarısız: ${String(err.stderr || err.message).split('\n')[0].slice(0, 120)}`);
    }
  }

  // FİLTRE taraması (tek geçiş): siyah segment + donmuş kare + sessizlik + peak.
  if (vStream && technical.decodePassed !== false) {
    const filters = await run('ffmpeg', [
      '-i', videoPath,
      '-vf', `blackdetect=d=${t.blackMinSeconds}:pix_th=${t.blackPixThreshold},freezedetect=n=-60dB:d=${t.freezeMinSeconds}`,
      ...(aStream ? ['-af', `silencedetect=noise=${t.silenceNoiseDb}dB:d=${t.silenceMinSeconds},volumedetect`] : []),
      '-f', 'null', '-',
    ], BUF).catch((e) => ({ stderr: e.stderr || '' }));
    const ev = parseFfmpegFilterEvents(filters.stderr || '');
    technical.blackSegmentCount = ev.black.length;
    technical.freezeSegmentCount = ev.freeze.length;
    technical.silenceSegmentCount = ev.silence.length;
    technical.maxVolumeDb = ev.maxVolumeDb;

    for (const b of ev.black) {
      warnings.push(`siyah segment ${b.start.toFixed(1)}s @ ${b.duration.toFixed(1)}s süreli`);
      if (b.start <= 0.05) technical.startBlackSeconds = +b.duration.toFixed(2);
    }
    if (technical.startBlackSeconds > 1.2) warnings.push(`video ${technical.startBlackSeconds}s siyah başlıyor — hook görünmüyor`);
    for (const f of ev.freeze) warnings.push(`donmuş segment ${f.start.toFixed(1)}s civarı (≥${t.freezeMinSeconds}s)`);
    for (const s of ev.silence) {
      // Kuyruk sessizliği: video sonunda biten sessizlik ayrı raporlanır.
      if (duration && s.end !== null && duration - s.end < 0.5) {
        technical.trailingSilenceSeconds = +s.duration.toFixed(2);
        if (s.duration > t.trailingSilenceMaxSeconds) warnings.push(`sonda ${technical.trailingSilenceSeconds}s sessiz boşluk`);
      } else if (s.start <= 0.05 && (s.duration || 0) > 0.35) {
        technical.leadingSilenceSeconds = +(s.duration || 0).toFixed(2);
        warnings.push(`başta ${technical.leadingSilenceSeconds}s sessiz boşluk`);
      } else {
        warnings.push(`sessiz bölüm ${s.start.toFixed(1)}s @ ${(s.duration ?? 0).toFixed(1)}s`);
      }
    }
    if (ev.maxVolumeDb !== null && ev.maxVolumeDb >= t.clippingPeakDb) {
      warnings.push(`peak clipping riski (max ${ev.maxVolumeDb} dB)`);
    }
  }

  // Loudness (YouTube hedefi -14 LUFS civarı)
  if (aStream) {
    const { stderr } = await run('ffmpeg', [
      '-i', videoPath, '-af', 'loudnorm=print_format=summary', '-f', 'null', '-',
    ], BUF).catch((e) => ({ stderr: e.stderr || '' }));
    const m = /Input Integrated:\s*(-?[\d.]+)/.exec(stderr || '');
    if (m) {
      metrics.lufs = parseFloat(m[1]);
      technical.lufs = metrics.lufs;
      if (metrics.lufs < -18 || metrics.lufs > -10) {
        warnings.push(`loudness hedef dışı (${metrics.lufs} LUFS, hedef ~-14)`);
      }
    }
  }

  // Siyah kare kontrolü: %20/%50/%80 anlarından kare al, ortalama parlaklığa bak.
  if (vStream && duration > 3) {
    const samples = [0.2, 0.5, 0.8].map((p) => p * duration);
    let dark = 0;
    for (const ts of samples) {
      const { stderr } = await run('ffmpeg', [
        '-ss', ts.toFixed(2), '-i', videoPath,
        '-frames:v', '1', '-vf', 'signalstats,metadata=print', '-f', 'null', '-',
      ], { maxBuffer: 10 * 1024 * 1024 }).catch((e) => ({ stderr: e.stderr || '' }));
      const y = /YAVG=([\d.]+)/.exec(stderr || '');
      if (y && parseFloat(y[1]) < 14) dark += 1;
    }
    metrics.darkSamples = dark;
    if (dark === samples.length) issues.push('tüm örnek kareler karanlık/siyah');
  }

  return { ok: issues.length === 0, issues, warnings, metrics, technical };
}

/**
 * ffmpeg filtre loglarını ayrıştırır (blackdetect/freezedetect/silencedetect/
 * volumedetect). Saf fonksiyon — birim testleri fixture stderr ile çalışır.
 */
export function parseFfmpegFilterEvents(stderr) {
  const black = [];
  const freeze = [];
  const silence = [];
  let maxVolumeDb = null;

  for (const line of String(stderr).split('\n')) {
    let m = /black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/.exec(line);
    if (m) black.push({ start: +m[1], end: +m[2], duration: +m[3] });
    m = /lavfi\.freezedetect\.freeze_start:\s*([\d.]+)|freeze_start:\s*([\d.]+)/.exec(line);
    if (m) freeze.push({ start: +(m[1] ?? m[2]) });
    m = /silence_start:\s*(-?[\d.]+)/.exec(line);
    if (m) silence.push({ start: +m[1], end: null, duration: null });
    m = /silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/.exec(line);
    if (m && silence.length && silence[silence.length - 1].end === null) {
      silence[silence.length - 1].end = +m[1];
      silence[silence.length - 1].duration = +m[2];
    }
    m = /max_volume:\s*(-?[\d.]+)\s*dB/.exec(line);
    if (m) maxVolumeDb = +m[1];
  }
  // Kapanmamış sessizlik (dosya sonuna kadar sürer) — süre bilinmiyorsa 0 değil null kalır.
  return { black, freeze, silence, maxVolumeDb };
}
