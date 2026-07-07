import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import path from 'node:path';

const run = promisify(execFile);

const FONT_CANDIDATES = [
  'assets/fonts/Montserrat-Black.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
];
function fontFile() {
  return FONT_CANDIDATES.map((f) => path.resolve(f)).find((f) => existsSync(f)) || null;
}

/**
 * Kapanış kartı (outro) klibini üretir: koyu zemin + logo + "FOLLOW FOR MORE"
 * + kırmızı SUBSCRIBE butonu + like/comment/subscribe ikonları ve etiketleri.
 * Sadece video (sessiz) üretir; ses renderVideo tarafında bindirilir.
 *
 * @returns {Promise<string>} outro mp4 yolu
 */
export async function buildOutro({
  outPath,
  width = 1080,
  height = 1920,
  duration = 3.0,
  fps = 30,
  logoPath = 'assets/logo.png',
  iconsDir = 'assets/icons',
}) {
  const font = fontFile();
  const fo = font ? `fontfile=${font}:` : '';
  const like = path.resolve(iconsDir, 'like.png');
  const comment = path.resolve(iconsDir, 'comment.png');
  const bell = path.resolve(iconsDir, 'bell.png');
  const subbtn = path.resolve(iconsDir, 'subbtn.png');
  const logo = path.resolve(logoPath);
  const hasLogo = existsSync(logo);

  // Girişler
  const inputs = ['-f', 'lavfi', '-i', `color=c=0x0f0f0f:s=${width}x${height}:d=${duration}`];
  let idx = 1;
  let logoIdx = -1;
  if (hasLogo) { logoIdx = idx; inputs.push('-i', logo); idx += 1; }
  const subIdx = idx; inputs.push('-i', subbtn); idx += 1;
  const likeIdx = idx; inputs.push('-i', like); idx += 1;
  const comIdx = idx; inputs.push('-i', comment); idx += 1;
  const bellIdx = idx; inputs.push('-i', bell); idx += 1;

  const fc = [];
  let base = '[0:v]';

  // Logo (üst)
  if (hasLogo) {
    fc.push(`[${logoIdx}:v]scale=460:-1[lg]`);
    fc.push(`${base}[lg]overlay=(W-w)/2:360[b1]`);
    base = '[b1]';
  }

  // "FOLLOW FOR MORE"
  fc.push(
    `${base}drawtext=${fo}text='FOLLOW FOR MORE':fontcolor=white:fontsize=74:` +
      `x=(w-text_w)/2:y=720:borderw=3:bordercolor=black@0.5[b2]`,
  );

  // Kırmızı SUBSCRIBE butonu + üstüne yazı
  fc.push(`[${subIdx}:v]scale=600:-1[sb]`);
  fc.push(`[b2][sb]overlay=(W-w)/2:980[b3]`);
  fc.push(
    `[b3]drawtext=${fo}text='SUBSCRIBE':fontcolor=white:fontsize=60:` +
      `x=(w-text_w)/2:y=1018[b4]`,
  );

  // İkon satırı (like / comment / bell) — merkezler 270, 540, 810
  fc.push(`[${likeIdx}:v]scale=120:120[i1]`);
  fc.push(`[${comIdx}:v]scale=120:120[i2]`);
  fc.push(`[${bellIdx}:v]scale=120:120[i3]`);
  fc.push(`[b4][i1]overlay=210:1330[b5]`);
  fc.push(`[b5][i2]overlay=480:1330[b6]`);
  fc.push(`[b6][i3]overlay=750:1330[b7]`);

  // Etiketler
  fc.push(
    `[b7]drawtext=${fo}text='LIKE':fontcolor=white:fontsize=40:x=270-text_w/2:y=1470[b8]`,
  );
  fc.push(
    `[b8]drawtext=${fo}text='COMMENT':fontcolor=white:fontsize=40:x=540-text_w/2:y=1470[b9]`,
  );
  fc.push(
    `[b9]drawtext=${fo}text='SUBSCRIBE':fontcolor=white:fontsize=40:x=810-text_w/2:y=1470,` +
      `format=yuv420p[v]`,
  );

  await run('ffmpeg', [
    '-y', ...inputs,
    '-filter_complex', fc.join(';'),
    '-map', '[v]', '-an',
    '-r', String(fps),
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    path.resolve(outPath),
  ], { maxBuffer: 20 * 1024 * 1024 });

  return outPath;
}
