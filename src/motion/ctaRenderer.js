import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { buildCtaAss } from './ctaTemplates.js';
import { isNearSilentAsset } from '../pipeline/outputVerify.js';

const run = promisify(execFile);

// Tip → SFX eşlemesi (her CTA'nın amacına uygun ses).
const TYPE_SFX = {
  subscribe: 'confirmation', like: 'pop', bell: 'bell_tick',
  comment: 'soft_click', follow: 'confirmation', save: 'soft_click',
};

/** ffmpeg filtre argümanı için dosya yolu kaçışı. */
function escFilterPath(p) {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:');
}

/**
 * CTA'yı videoya bindirir (ASS overlay + opsiyonel SFX miks). Tek ffmpeg pass.
 * @param {object} o { inputVideo, outputVideo, plan, box, workDir, width, height, duration }
 * @returns {Promise<{ok:boolean, assPath:string, sfxId:string|null, error?:string}>}
 */
export async function renderCta(o) {
  const width = o.width || 1080;
  const height = o.height || 1920;
  const ass = buildCtaAss({
    templateId: o.plan.templateId, type: o.plan.type, box: o.box,
    startSec: o.plan.startSec, durSec: o.plan.durationSec, width, height,
    language: o.language,
  });
  const assPath = path.join(o.workDir, 'cta.ass');
  await writeFile(assPath, ass, 'utf8');

  const fontsDir = config.video.fontsDir || 'assets/fonts';
  const assFilter = `ass=${escFilterPath(assPath)}:fontsdir=${escFilterPath(fontsDir)}`;

  const cfg = config.motion.cta;
  const sfxId = TYPE_SFX[o.plan.type] || null;
  const sfxPath = sfxId ? path.join(cfg.assetsDir, 'sfx', `${sfxId}.wav`) : null;
  let useSfx = cfg.sfx && sfxPath && existsSync(sfxPath);
  // Near-silent (bozuk/boş sentez) asset MİKS EDİLMEZ — sessiz pop'u miks'e
  // sokmak "SFX var" yanılsaması yaratır; çıktı doğrulaması da onu yakalardı.
  if (useSfx) {
    const sil = await isNearSilentAsset(sfxPath).catch(() => ({ silent: false }));
    if (sil.silent) {
      console.warn(`[motion] CTA SFX '${sfxId}' near-silent (${sil.maxDb} dB) — miks edilmedi.`);
      useSfx = false;
    }
  }

  const args = ['-nostdin', '-y', '-v', 'error', '-i', path.resolve(o.inputVideo)];
  if (useSfx) args.push('-i', path.resolve(sfxPath));

  if (useSfx) {
    const delayMs = Math.round(o.plan.startSec * 1000);
    // CTA 'pop' NET duyulsun: taban sesi cue anında hafifçe DUCK et (sidechain),
    // pop üstüne binsin. Ayrıca stereo garanti (mono çıktı hatasını önler).
    // NOT: sidechaincompress çıktısı EN KISA girdinin uzunluğunda biter. Kısa
    // pop sidechain'i tabanı KESER (sesi erken bitirir). Bu yüzden sidechain
    // anahtarı apad ile sonsuza doldurulur; taban (main) süresi belirleyici olur.
    const fc = [
      `[0:v]${assFilter}[v]`,
      `[1:a]adelay=${delayMs}|${delayMs},volume=${cfg.sfxVolume},asplit=2[sfxkey0][sfxmix]`,
      `[sfxkey0]apad[sfxkey]`,
      `[0:a][sfxkey]sidechaincompress=threshold=0.08:ratio=6:attack=3:release=220[base]`,
      `[base][sfxmix]amix=inputs=2:normalize=0:duration=first,aformat=channel_layouts=stereo[a]`,
    ];
    args.push('-filter_complex', fc.join(';'), '-map', '[v]', '-map', '[a]',
      '-c:a', 'aac', '-b:a', '160k', '-ac', '2');
  } else {
    args.push('-vf', assFilter, '-map', '0:v', '-map', '0:a?', '-c:a', 'copy');
  }
  // Video yeniden kodlanır (overlay yakılıyor) — yüksek kalite, tek geçiş.
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.resolve(o.outputVideo));

  try {
    await run('ffmpeg', args, { maxBuffer: 20 * 1024 * 1024 });
    return { ok: true, assPath, sfxId: useSfx ? sfxId : null };
  } catch (err) {
    return { ok: false, assPath, sfxId: null, error: String(err.stderr || err.message).split('\n').pop().slice(0, 160) };
  }
}
