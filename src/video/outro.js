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

/** Bir elemanın belirli anda yumuşak beliren alpha ifadesi (drawtext için). */
function fadeAlpha(st, d = 0.5) {
  return `if(lt(t,${st}),0,if(lt(t,${st + d}),(t-${st})/${d},1))`;
}

/**
 * Sinematik kapanış kartı (outro). Son klibi bulanık/koyu hareketli arka plan
 * olarak kullanır; logo, "FOLLOW FOR MORE", kırmızı SUBSCRIBE butonu ve
 * like/comment/subscribe ikonları sırayla (staggered) fade-in ile belirir.
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
  bgClip = null,
}) {
  const font = fontFile();
  const fo = font ? `fontfile=${font}:` : '';
  const like = path.resolve(iconsDir, 'like.png');
  const comment = path.resolve(iconsDir, 'comment.png');
  const bell = path.resolve(iconsDir, 'bell.png');
  const subbtn = path.resolve(iconsDir, 'subbtn.png');
  const logo = path.resolve(logoPath);
  const hasLogo = existsSync(logo);
  const hasBg = bgClip && existsSync(path.resolve(bgClip));

  // Sıralı beliriş zamanlaması (saniye).
  const T_LOGO = 0.15;
  const T_HEAD = 0.5;
  const T_SUB = 0.9;
  const T_ICONS = 1.3;

  // --- Girişler ---
  const inputs = [];
  if (hasBg) {
    // Son klibi döngüle ve outro süresi boyunca oynat (hareketli arka plan).
    // NOT: -t giriş opsiyonudur, ilgili -i'den ÖNCE gelmeli (yoksa döngü sonsuz olur).
    inputs.push('-stream_loop', '-1', '-t', String(duration), '-i', path.resolve(bgClip));
  } else {
    inputs.push('-f', 'lavfi', '-i', `color=c=0x0b0b0f:s=${width}x${height}:d=${duration}`);
  }
  let idx = 1;
  // Görsel (PNG) girişleri: fade zaman ekseninde çalışabilsin diye -loop 1 -t ile
  // çok-kareli akışa çevrilir (tek-kare still'de fade alpha=0'da takılır, görünmez olur).
  const img = (p) => { inputs.push('-loop', '1', '-t', String(duration), '-i', p); const i = idx; idx += 1; return i; };
  let logoIdx = -1;
  if (hasLogo) { logoIdx = img(logo); }
  const subIdx = img(subbtn);
  const likeIdx = img(like);
  const comIdx = img(comment);
  const bellIdx = img(bell);

  const fc = [];

  // --- Arka plan: doldur + bulanıklaştır + koyulaştır + vignette ---
  if (hasBg) {
    fc.push(
      `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,` +
        `crop=${width}:${height},gblur=sigma=26,` +
        `eq=brightness=-0.16:saturation=0.72:contrast=1.02,` +
        `vignette=PI/4,format=yuv420p[bg]`,
    );
  } else {
    fc.push(`[0:v]format=yuv420p[bg]`);
  }
  let base = '[bg]';

  // --- Logo (üst), fade-in ---
  if (hasLogo) {
    fc.push(`[${logoIdx}:v]scale=460:-1,format=rgba,fade=t=in:st=${T_LOGO}:d=0.5:alpha=1[lg]`);
    fc.push(`${base}[lg]overlay=(W-w)/2:360[b1]`);
    base = '[b1]';
  }

  // --- "FOLLOW FOR MORE" (drawtext alpha fade) ---
  fc.push(
    `${base}drawtext=${fo}text='FOLLOW FOR MORE':fontcolor=white:fontsize=78:` +
      `x=(w-text_w)/2:y=740:borderw=4:bordercolor=black@0.55:` +
      `alpha='${fadeAlpha(T_HEAD)}'[b2]`,
  );

  // --- Kırmızı SUBSCRIBE butonu + üstüne yazı ---
  fc.push(`[${subIdx}:v]scale=600:-1,format=rgba,fade=t=in:st=${T_SUB}:d=0.5:alpha=1[sb]`);
  fc.push(`[b2][sb]overlay=(W-w)/2:1000[b3]`);
  fc.push(
    `[b3]drawtext=${fo}text='SUBSCRIBE':fontcolor=white:fontsize=62:` +
      `x=(w-text_w)/2:y=1040:alpha='${fadeAlpha(T_SUB + 0.15)}'[b4]`,
  );

  // --- İkon satırı (like / comment / bell) — merkezler 270, 540, 810 ---
  fc.push(`[${likeIdx}:v]scale=120:120,format=rgba,fade=t=in:st=${T_ICONS}:d=0.5:alpha=1[i1]`);
  fc.push(`[${comIdx}:v]scale=120:120,format=rgba,fade=t=in:st=${T_ICONS + 0.12}:d=0.5:alpha=1[i2]`);
  fc.push(`[${bellIdx}:v]scale=120:120,format=rgba,fade=t=in:st=${T_ICONS + 0.24}:d=0.5:alpha=1[i3]`);
  fc.push(`[b4][i1]overlay=210:1360[b5]`);
  fc.push(`[b5][i2]overlay=480:1360[b6]`);
  fc.push(`[b6][i3]overlay=750:1360[b7]`);

  // --- Etiketler ---
  fc.push(
    `[b7]drawtext=${fo}text='LIKE':fontcolor=white:fontsize=40:x=270-text_w/2:y=1500:` +
      `alpha='${fadeAlpha(T_ICONS)}'[b8]`,
  );
  fc.push(
    `[b8]drawtext=${fo}text='COMMENT':fontcolor=white:fontsize=40:x=540-text_w/2:y=1500:` +
      `alpha='${fadeAlpha(T_ICONS + 0.12)}'[b9]`,
  );
  fc.push(
    `[b9]drawtext=${fo}text='SUBSCRIBE':fontcolor=white:fontsize=40:x=810-text_w/2:y=1500:` +
      `alpha='${fadeAlpha(T_ICONS + 0.24)}',format=yuv420p[v]`,
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
