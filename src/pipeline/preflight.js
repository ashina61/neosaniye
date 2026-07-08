import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { stat } from 'node:fs/promises';

const run = promisify(execFile);

/**
 * Yayın öncesi kalite kontrolü (preflight). Otomatik yayında insan gözü
 * olmadığı için sigorta: bozuk/yanlış video YouTube'a hiç gitmez.
 *
 * Kontroller:
 *  - süre 15-65 sn (Shorts penceresi)
 *  - çözünürlük 1080x1920
 *  - ses loudness -18..-10 LUFS (hedef -14) ve ses akışı mevcut
 *  - kare parlaklığı: örneklenen karelerin hepsi kapkara değil
 *  - dosya boyutu 0.3-80 MB
 *
 * @returns {Promise<{ok:boolean, issues:string[], metrics:object}>}
 */
export async function preflightCheck(videoPath) {
  const issues = [];
  const metrics = {};

  // Boyut
  const st = await stat(videoPath).catch(() => null);
  if (!st) return { ok: false, issues: [`dosya yok: ${videoPath}`], metrics };
  metrics.sizeMB = +(st.size / 1e6).toFixed(1);
  if (st.size < 0.3e6) issues.push(`dosya çok küçük (${metrics.sizeMB} MB)`);
  if (st.size > 80e6) issues.push(`dosya çok büyük (${metrics.sizeMB} MB)`);

  // Süre + çözünürlük + akışlar
  const { stdout: probe } = await run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=codec_type,width,height',
    '-of', 'json', videoPath,
  ]);
  const info = JSON.parse(probe);
  const duration = parseFloat(info.format?.duration || 0);
  metrics.duration = +duration.toFixed(1);
  if (duration < 15) issues.push(`süre çok kısa (${metrics.duration}s < 15s)`);
  if (duration > 65) issues.push(`süre Shorts sınırını aşıyor (${metrics.duration}s > 65s)`);

  const vStream = (info.streams || []).find((s) => s.codec_type === 'video');
  const aStream = (info.streams || []).find((s) => s.codec_type === 'audio');
  if (!vStream) issues.push('video akışı yok');
  if (!aStream) issues.push('ses akışı yok');
  if (vStream && (vStream.width !== 1080 || vStream.height !== 1920)) {
    issues.push(`çözünürlük 1080x1920 değil (${vStream.width}x${vStream.height})`);
  }

  // Loudness (YouTube hedefi -14 LUFS civarı)
  if (aStream) {
    const { stderr } = await run('ffmpeg', [
      '-i', videoPath, '-af', 'loudnorm=print_format=summary', '-f', 'null', '-',
    ], { maxBuffer: 20 * 1024 * 1024 }).catch((e) => ({ stderr: e.stderr || '' }));
    const m = /Input Integrated:\s*(-?[\d.]+)/.exec(stderr || '');
    if (m) {
      metrics.lufs = parseFloat(m[1]);
      if (metrics.lufs < -18 || metrics.lufs > -10) {
        issues.push(`loudness hedef dışı (${metrics.lufs} LUFS, hedef ~-14)`);
      }
    }
  }

  // Siyah kare kontrolü: %20/%50/%80 anlarından kare al, ortalama parlaklığa bak.
  if (vStream && duration > 3) {
    const samples = [0.2, 0.5, 0.8].map((p) => p * duration);
    let dark = 0;
    for (const t of samples) {
      const { stderr } = await run('ffmpeg', [
        '-ss', t.toFixed(2), '-i', videoPath,
        '-frames:v', '1', '-vf', 'signalstats,metadata=print', '-f', 'null', '-',
      ], { maxBuffer: 10 * 1024 * 1024 }).catch((e) => ({ stderr: e.stderr || '' }));
      const y = /YAVG=([\d.]+)/.exec(stderr || '');
      if (y && parseFloat(y[1]) < 14) dark += 1;
    }
    metrics.darkSamples = dark;
    if (dark === samples.length) issues.push('tüm örnek kareler karanlık/siyah');
  }

  return { ok: issues.length === 0, issues, metrics };
}
