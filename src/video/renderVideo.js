import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const run = promisify(execFile);

// drawtext yazı-logosu için sistemde bulunan bir font dosyası ara.
const FONT_CANDIDATES = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
];
function findFontFile() {
  return FONT_CANDIDATES.find((f) => existsSync(f)) || null;
}

/**
 * Faz 4 — Video Montaj (ffmpeg).
 * Dikey klip/fotoğrafları script/ses süresine göre sıralar, TTS sesini bindirir,
 * kelime zaman damgalarıyla karaoke tarzı altyazı yakar. Çıktı: 1080x1920 mp4.
 */

async function ffprobeDuration(file) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ]);
  return parseFloat(stdout.trim()) || 0;
}

/** saniye -> ASS zaman formatı "H:MM:SS.cs" */
function assTime(sec) {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const cs = Math.round((s - Math.floor(s)) * 100);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${h}:${p(m)}:${p(ss)}.${p(cs)}`;
}

function assEscape(text) {
  return text.replace(/[\r\n]+/g, ' ').replace(/[{}]/g, '').trim();
}

/**
 * Kelime zaman damgalarından "word-pop" karaoke ASS altyazısı üretir
 * (her kelime, kendi zaman aralığında büyük ve ortada belirir).
 */
export function buildAss(wordTimings, opts = {}) {
  const {
    width = 1080,
    height = 1920,
    fontName = config.video.fontName,
    maxSize = config.video.fontSizeMax,
    minSize = config.video.fontSizeMin,
    uppercase = true,
    alignment = 5, // 5 = orta-orta
  } = opts;

  const marginH = 90;
  const usableW = width - 2 * marginH;
  // Montserrat Black büyük harf ortalama genişlik katsayısı (güvenli taraf).
  const charFactor = 0.82;

  // Stil: kalın beyaz + kalın siyah kenar + yumuşak koyu gölge (referanstaki look).
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Pop,${fontName},${maxSize},&H00FFFFFF,&H00000000,&H20000000,1,1,3,4,${alignment},${marginH},${marginH},140,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const words = wordTimings.filter((w) => w.word && w.end > w.start);
  const lines = words.map((w, i) => {
    const start = w.start;
    // Boşlukları doldur: bir sonraki kelimenin başlangıcına kadar göster.
    const next = words[i + 1];
    const end = next ? Math.max(w.end, next.start) : w.end;
    const raw = uppercase ? w.word.toUpperCase() : w.word;
    const text = assEscape(raw);

    // Otomatik boyut: kelime ekrana sığmıyorsa küçült (kısa kelime = büyük/punchy).
    let size = maxSize;
    const est = text.length * charFactor * size;
    if (est > usableW) {
      size = Math.max(minSize, Math.floor(usableW / (text.length * charFactor)));
    }

    // Vurucu kelime: sayı içeren veya uzun kelimeler renkli vurgulanır.
    const isEmphasis =
      config.video.emphasis && (/\d/.test(raw) || raw.replace(/\W/g, '').length >= 8);
    const colorTag = isEmphasis ? `\\c${config.video.accentColor}` : '';

    // Pop animasyonu: küçükten hızlıca büyüyüp yerine oturur + hafif fade + yumuşak gölge.
    const anim =
      `\\fs${size}\\blur2\\fad(50,0)${colorTag}` +
      '\\fscx58\\fscy58\\t(0,110,\\fscx112\\fscy112)\\t(110,190,\\fscx100\\fscy100)';
    return `Dialogue: 0,${assTime(start)},${assTime(end)},Pop,,0,0,0,,{${anim}}${text}`;
  });

  return header + lines.join('\n') + '\n';
}

/** Tek bir medyayı (video/foto) sabit 1080x1920/fps klibe normalize eder. */
async function normalizeClip(item, duration, outPath, { width, height, fps }) {
  const vf = [
    `scale=${width}:${height}:force_original_aspect_ratio=increase`,
    `crop=${width}:${height}`,
    'setsar=1',
    `fps=${fps}`,
    'format=yuv420p',
  ].join(',');

  const isPhoto =
    item.type === 'photo' || /\.(jpg|jpeg|png|webp)$/i.test(item.path);

  const inputArgs = isPhoto
    ? ['-loop', '1', '-t', String(duration), '-i', item.path]
    : ['-stream_loop', '-1', '-i', item.path, '-t', String(duration)];

  await run('ffmpeg', [
    '-y', ...inputArgs,
    '-vf', vf,
    '-an',
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    outPath,
  ], { maxBuffer: 20 * 1024 * 1024 });
}

/** Basit 'whoosh' geçiş ses efekti üretir (pembe gürültü + bant geçiren + fade). */
async function makeWhoosh(outPath) {
  await run('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'anoisesrc=d=0.45:c=pink:a=0.6',
    '-af', 'highpass=f=250,lowpass=f=5000,afade=t=in:st=0:d=0.12,afade=t=out:st=0.2:d=0.25',
    '-ar', '44100', '-ac', '2',
    outPath,
  ], { maxBuffer: 10 * 1024 * 1024 });
}

/**
 * @param {object} job
 * @param {string} job.audioPath - TTS ses dosyası (mp3/wav).
 * @param {Array}  job.wordTimings - [{word,start,end}] (boşsa altyazısız render).
 * @param {Array}  job.media - [{path,type}] dikey klip/foto havuzu (sırayla kullanılır).
 * @param {string} job.outPath - Çıktı mp4 yolu.
 * @param {object} [opts] - { width=1080, height=1920, fps=30, workDir }
 * @returns {Promise<{outPath:string, duration:number, width:number, height:number, clips:number}>}
 */
export async function renderVideo(job, opts = {}) {
  const { audioPath, wordTimings = [], media = [], outPath } = job;
  const { width = 1080, height = 1920, fps = 30 } = opts;

  if (!audioPath) throw new Error('job.audioPath gerekli.');
  if (!media.length) throw new Error('job.media boş — Faz 3 medyası gerekli.');

  await mkdir(path.dirname(outPath), { recursive: true });
  const workDir =
    opts.workDir || path.join(path.dirname(outPath), '.render-tmp');
  await mkdir(workDir, { recursive: true });

  // 1) Toplam süre = ses süresi (video buna göre kesilir).
  const duration = await ffprobeDuration(audioPath);
  if (!duration) throw new Error('Ses süresi okunamadı.');

  const N = media.length;

  // 2) Geçiş süresi + klip uzunluğu: xfade sonrası toplam ~ ses süresi olsun.
  let td = N > 1 ? config.video.transitionDuration : 0;
  let D = N > 1 ? (duration + (N - 1) * td) / N : duration;
  if (N > 1 && D <= td + 0.3) {
    td = Math.max(0.15, D * 0.4);
    D = (duration + (N - 1) * td) / N;
  }

  // 3) Her medyayı sabit 1080x1920/fps klibe normalize et (uzunluk = D).
  const normalized = [];
  for (let i = 0; i < N; i += 1) {
    const clipPath = path.join(workDir, `clip-${String(i).padStart(2, '0')}.mp4`);
    await normalizeClip(
      media[i],
      Math.max(0.6, D + (N > 1 ? 0.05 : 0)),
      clipPath,
      { width, height, fps },
    );
    normalized.push(clipPath);
  }

  // 4) Altyazı (varsa) — pop animasyonu + vurgu buildAss içinde.
  const hasSubs = wordTimings.length > 0;
  if (hasSubs) {
    await writeFile(
      path.join(workDir, 'subs.ass'),
      buildAss(wordTimings, { width, height }),
    );
  }

  // 5) Girişleri topla (klipler, ses, logo, whoosh) ve indekslerini izle.
  // Not: cwd=workDir olduğundan tüm dosya girişleri MUTLAK yol; sadece subs.ass basit ad.
  const inputArgs = [];
  let idx = 0;
  for (const p of normalized) {
    inputArgs.push('-i', path.resolve(p));
    idx += 1;
  }
  const audioIdx = idx;
  inputArgs.push('-i', path.resolve(audioPath));
  idx += 1;

  const logoImg = path.resolve(config.video.logoPath);
  const hasLogoImg = existsSync(logoImg);
  let logoIdx = -1;
  if (hasLogoImg) {
    logoIdx = idx;
    inputArgs.push('-i', logoImg);
    idx += 1;
  }

  const useWhoosh = config.video.transitionSound && N > 1;
  let whooshIdx = -1;
  if (useWhoosh) {
    const whooshPath = path.join(workDir, 'whoosh.wav');
    await makeWhoosh(whooshPath);
    whooshIdx = idx;
    inputArgs.push('-i', path.resolve(whooshPath));
    idx += 1;
  }

  // 6) Video grafiği: xfade geçişleri -> logo -> altyazı.
  const fc = [];
  let vbase = '[0:v]';
  if (N > 1) {
    const trs = config.video.transitions;
    let prev = '[0:v]';
    for (let k = 1; k < N; k += 1) {
      const t = trs[(k - 1) % trs.length] || 'fade';
      const off = (k * (D - td)).toFixed(3);
      const out = k === N - 1 ? '[vx]' : `[x${k}]`;
      fc.push(
        `${prev}[${k}:v]xfade=transition=${t}:duration=${td.toFixed(3)}:offset=${off}${out}`,
      );
      prev = out;
    }
    vbase = '[vx]';
  }

  if (hasLogoImg) {
    fc.push(`[${logoIdx}:v]scale=-1:64[lg]`);
    fc.push(`${vbase}[lg]overlay=40:55[vlogo]`);
  } else {
    const font = findFontFile();
    const fontOpt = font ? `fontfile=${font}:` : '';
    const txt = String(config.video.logoText).replace(/[:\\'%]/g, '');
    fc.push(
      `${vbase}drawtext=${fontOpt}text='${txt}':x=40:y=48:fontsize=44:` +
        'fontcolor=white@0.92:borderw=2:bordercolor=black@0.5[vlogo]',
    );
  }

  const fontsDir = path.resolve(config.video.fontsDir);
  const assFilter = existsSync(fontsDir)
    ? `ass=subs.ass:fontsdir=${fontsDir}`
    : 'ass=subs.ass';
  fc.push(hasSubs ? `[vlogo]${assFilter}[v]` : '[vlogo]null[v]');

  // 7) Ses: narrasyon (+ opsiyonel geçiş whoosh'ları geçiş anlarına bindirilir).
  let amap;
  if (useWhoosh) {
    const splits = [];
    for (let k = 1; k < N; k += 1) splits.push(`[w${k}]`);
    fc.push(`[${whooshIdx}:a]asplit=${N - 1}${splits.join('')}`);
    const delayed = [];
    for (let k = 1; k < N; k += 1) {
      const centerMs = Math.round((k * (D - td) + td / 2) * 1000);
      fc.push(
        `[w${k}]adelay=${centerMs}|${centerMs},volume=${config.video.transitionSoundVolume}[wd${k}]`,
      );
      delayed.push(`[wd${k}]`);
    }
    fc.push(
      `[${audioIdx}:a]${delayed.join('')}amix=inputs=${N}:normalize=0:duration=first[a]`,
    );
    amap = '[a]';
  } else {
    amap = `${audioIdx}:a`;
  }

  // 8) Render.
  const finalArgs = [
    '-y', ...inputArgs,
    '-filter_complex', fc.join(';'),
    '-map', '[v]', '-map', amap,
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k',
    '-shortest', '-r', String(fps),
    path.resolve(outPath),
  ];
  await run('ffmpeg', finalArgs, { cwd: workDir, maxBuffer: 20 * 1024 * 1024 });

  // 5) Geçici dosyaları temizle.
  await rm(workDir, { recursive: true, force: true });

  const outDuration = await ffprobeDuration(outPath);
  return {
    outPath,
    duration: outDuration,
    width,
    height,
    clips: normalized.length,
  };
}
