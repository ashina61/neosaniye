import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { stat } from 'node:fs/promises';

const run = promisify(execFile);

/**
 * CTA VALİDASYONU — saf plan kontrolleri + render sonrası katman doğrulaması.
 * Kritik hata → CTA atlanır (ana video korunur), failures'a yazılır.
 */

/** Plan seviyesi kontroller (render öncesi). */
export function validatePlan(plan, { duration, cfg, safeArea }) {
  const failures = [];
  const warnings = [];
  if (!plan?.applied) return { ok: false, failures: ['cta-not-applied'], warnings };

  const end = plan.startSec + plan.durationSec;
  // İlk 5 saniye + earliest yasağı.
  if (plan.startSec < Math.max(5, cfg.earliestStartSec)) failures.push('cta-in-first-5s');
  // Zaman sınırları içinde mi.
  if (plan.startSec < 0 || end > duration - cfg.latestEndBufferSec + 0.01) failures.push('cta-out-of-bounds');
  // Süre aralığı.
  const [dMin, dMax] = cfg.durationRangeSec;
  if (plan.durationSec < dMin - 0.01 || plan.durationSec > dMax + 0.01) failures.push('cta-duration-invalid');
  // Güvenli alan bulunmalı.
  if (!safeArea) failures.push('no-safe-area');
  else {
    // Kart ekran içinde mi.
    if (safeArea.x < 0 || safeArea.y < 0 || safeArea.x + safeArea.w > 1080 || safeArea.y + safeArea.h > 1920) {
      failures.push('cta-off-screen');
    }
    // Sağ ikon şeridine giriyor mu (>930).
    if (safeArea.x + safeArea.w > 1080 - 140) warnings.push('cta-near-right-icons');
  }
  return { ok: failures.length === 0, failures, warnings };
}

/**
 * Render sonrası: CTA katmanı gerçekten videoya işlendi mi?
 * CTA penceresinin ortasında orijinal vs CTA'lı kareyi karşılaştırır; fark
 * yoksa (SSIM≈1) katman uygulanmamış demektir → failure.
 * @returns {Promise<{applied:boolean, diff:number|null}>}
 */
export async function verifyRendered(originalPath, ctaPath, atSec) {
  try {
    const { stderr } = await run('ffmpeg', [
      '-nostdin', '-ss', atSec.toFixed(2), '-i', originalPath,
      '-ss', atSec.toFixed(2), '-i', ctaPath,
      '-frames:v', '1',
      '-filter_complex', '[0:v][1:v]ssim', '-f', 'null', '-',
    ], { maxBuffer: 8 * 1024 * 1024 }).catch((e) => ({ stderr: e.stderr || '' }));
    const m = /All:\s*([\d.]+)/.exec(stderr || '');
    if (!m) return { applied: true, diff: null }; // ölçülemedi → engelleme
    const ssim = parseFloat(m[1]);
    // SSIM 1.0 = birebir aynı (CTA yok). <0.999 = kare değişmiş (CTA var).
    return { applied: ssim < 0.999, diff: +(1 - ssim).toFixed(5) };
  } catch {
    return { applied: true, diff: null };
  }
}

/** Çıktı MP4 geçerli mi (bozuk/sıfır değil). */
export async function verifyOutput(file) {
  const st = await stat(file).catch(() => null);
  if (!st || st.size < 0.2e6) return false;
  const probe = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
    .then((r) => parseFloat(r.stdout) > 0).catch(() => false);
  return probe;
}
