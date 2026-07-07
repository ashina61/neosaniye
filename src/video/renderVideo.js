import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { buildOutro } from './outro.js';

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

/** Outro abone 'chime' sesi (iki tonlu, yumuşak). */
async function makeChime(outPath) {
  await run('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'sine=frequency=880:duration=0.6',
    '-f', 'lavfi', '-i', 'sine=frequency=1320:duration=0.6',
    '-filter_complex', '[0][1]amix=inputs=2,afade=t=out:st=0.2:d=0.4',
    '-ar', '44100', '-ac', '2',
    outPath,
  ], { maxBuffer: 10 * 1024 * 1024 });
}

/** Yumuşak ambient 'pad' müzik yatağı sentezler (assets/music/bed.mp3 yoksa). */
async function makePad(outPath, total) {
  await run('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'sine=f=220',
    '-f', 'lavfi', '-i', 'sine=f=277',
    '-f', 'lavfi', '-i', 'sine=f=330',
    '-filter_complex',
    '[0][1][2]amix=inputs=3,tremolo=f=0.12:d=0.4,lowpass=f=700[a]',
    '-map', '[a]', '-t', total.toFixed(3), '-ar', '44100', '-ac', '2',
    outPath,
  ], { maxBuffer: 10 * 1024 * 1024 });
}

/**
 * Tam ses yatağını üretir: narrasyon + arka plan müziği (ducking ile kısılır)
 * + geçiş whoosh'ları + outro chime. Toplam süre `total`.
 */
async function buildFullAudio(
  { workDir, narrationPath, total, clipDur, td, N, M, useOutro },
  outPath,
) {
  const sfx = config.video.sfx;
  const useMusic = config.video.music;

  // Geçiş offsetleri (video ile aynı hesap).
  const off = [];
  let cum = 0;
  for (let k = 1; k < M; k += 1) {
    cum += clipDur[k - 1];
    off.push(cum - k * td);
  }
  const mainTransitions = Math.max(0, N - 1);

  const inputs = ['-i', narrationPath]; // 0 = narrasyon
  let idx = 1;

  let musicIdx = -1;
  if (useMusic) {
    const musicPath = path.resolve(config.video.musicPath);
    if (existsSync(musicPath)) {
      inputs.push('-stream_loop', '-1', '-i', musicPath);
    } else {
      const pad = path.join(workDir, 'pad.wav');
      await makePad(pad, total + 0.5);
      inputs.push('-i', path.resolve(pad));
    }
    musicIdx = idx;
    idx += 1;
  }

  let whooshIdx = -1;
  if (sfx && mainTransitions > 0) {
    const whoosh = path.join(workDir, 'whoosh.wav');
    await makeWhoosh(whoosh);
    inputs.push('-i', path.resolve(whoosh));
    whooshIdx = idx;
    idx += 1;
  }

  let chimeIdx = -1;
  if (sfx && useOutro) {
    const chime = path.join(workDir, 'chime.wav');
    await makeChime(chime);
    inputs.push('-i', path.resolve(chime));
    chimeIdx = idx;
    idx += 1;
  }

  const fc = [];
  const mix = [];

  if (useMusic) {
    fc.push('[0:a]aresample=44100,asplit=2[nkey][nmix]');
    fc.push(
      `[${musicIdx}:a]aresample=44100,atrim=0:${total.toFixed(3)},volume=${config.video.musicVolume}[mus]`,
    );
    // Narrasyon konuşurken müziği kıs (ducking).
    fc.push('[mus][nkey]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=350[musd]');
    mix.push('[nmix]', '[musd]');
  } else {
    fc.push('[0:a]aresample=44100[nmix]');
    mix.push('[nmix]');
  }

  if (whooshIdx >= 0) {
    const splits = [];
    for (let k = 1; k <= mainTransitions; k += 1) splits.push(`[w${k}]`);
    fc.push(`[${whooshIdx}:a]aresample=44100,asplit=${mainTransitions}${splits.join('')}`);
    for (let k = 1; k <= mainTransitions; k += 1) {
      const ms = Math.round((off[k - 1] + td / 2) * 1000);
      fc.push(`[w${k}]adelay=${ms}|${ms},volume=${config.video.transitionSoundVolume}[wd${k}]`);
      mix.push(`[wd${k}]`);
    }
  }

  if (chimeIdx >= 0) {
    const ms = Math.round((off[N - 1] + td / 2) * 1000);
    fc.push(`[${chimeIdx}:a]aresample=44100,adelay=${ms}|${ms},volume=0.35[chm]`);
    mix.push('[chm]');
  }

  if (mix.length > 1) {
    fc.push(`${mix.join('')}amix=inputs=${mix.length}:normalize=0:duration=longest,apad[a]`);
  } else {
    fc.push(`${mix[0]}apad[a]`);
  }

  await run('ffmpeg', [
    '-y', ...inputs,
    '-filter_complex', fc.join(';'),
    '-map', '[a]', '-t', total.toFixed(3),
    '-c:a', 'aac', '-b:a', '160k',
    outPath,
  ], { maxBuffer: 20 * 1024 * 1024 });
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

  // 1) Süreler ve parça planı.
  const narrationDur = await ffprobeDuration(audioPath);
  if (!narrationDur) throw new Error('Ses süresi okunamadı.');

  const N = media.length;
  const useOutro = config.video.outro;
  const outroExtra = useOutro ? config.video.outroDuration : 0;
  const M = N + (useOutro ? 1 : 0); // toplam görsel parça (klipler + outro)

  let td = M > 1 ? config.video.transitionDuration : 0;
  let dMain = useOutro
    ? (narrationDur - td) / N + td // N*(dMain-td) = narrationDur - td
    : (narrationDur + (N - 1) * td) / N;
  if (M > 1 && dMain <= td + 0.3) {
    td = Math.max(0.15, dMain * 0.4);
    dMain = useOutro
      ? (narrationDur - td) / N + td
      : (narrationDur + (N - 1) * td) / N;
  }
  const dOutro = outroExtra + td;
  const clipDur = [...Array(N).fill(dMain), ...(useOutro ? [dOutro] : [])];
  const total = clipDur.reduce((a, b) => a + b, 0) - (M - 1) * td;

  // 2) Ana klipleri normalize et + outro klibini üret.
  const clips = [];
  for (let i = 0; i < N; i += 1) {
    const clipPath = path.join(workDir, `clip-${String(i).padStart(2, '0')}.mp4`);
    await normalizeClip(
      media[i],
      Math.max(0.6, dMain + (M > 1 ? 0.05 : 0)),
      clipPath,
      { width, height, fps },
    );
    clips.push(clipPath);
  }
  if (useOutro) {
    const outroPath = path.join(workDir, 'outro.mp4');
    await buildOutro({
      outPath: outroPath,
      width,
      height,
      duration: dOutro + 0.1,
      fps,
      logoPath: config.video.logoPath,
    });
    clips.push(outroPath);
  }

  // 3) Altyazı (varsa) — pop animasyonu + vurgu buildAss içinde.
  const hasSubs = wordTimings.length > 0;
  if (hasSubs) {
    await writeFile(
      path.join(workDir, 'subs.ass'),
      buildAss(wordTimings, { width, height }),
    );
  }

  // 4) VİDEO PASS: xfade geçişleri (klipler + outro) -> logo -> altyazı (sessiz).
  const vInputs = [];
  clips.forEach((p) => vInputs.push('-i', path.resolve(p)));
  const logoImg = path.resolve(config.video.logoPath);
  const hasLogoImg = existsSync(logoImg);
  let logoIdx = -1;
  if (hasLogoImg) {
    logoIdx = clips.length;
    vInputs.push('-i', logoImg);
  }

  const vfc = [];
  let vbase = '[0:v]';
  if (M > 1) {
    const trs = config.video.transitions;
    let prev = '[0:v]';
    let cum = 0;
    for (let k = 1; k < M; k += 1) {
      cum += clipDur[k - 1];
      const off = (cum - k * td).toFixed(3);
      const t = trs[(k - 1) % trs.length] || 'fade';
      const out = k === M - 1 ? '[vx]' : `[x${k}]`;
      vfc.push(
        `${prev}[${k}:v]xfade=transition=${t}:duration=${td.toFixed(3)}:offset=${off}${out}`,
      );
      prev = out;
    }
    vbase = '[vx]';
  }

  if (hasLogoImg) {
    vfc.push(`[${logoIdx}:v]scale=-1:64[lg]`);
    vfc.push(`${vbase}[lg]overlay=40:55[vlogo]`);
  } else {
    const font = findFontFile();
    const fontOpt = font ? `fontfile=${font}:` : '';
    const txt = String(config.video.logoText).replace(/[:\\'%]/g, '');
    vfc.push(
      `${vbase}drawtext=${fontOpt}text='${txt}':x=40:y=48:fontsize=44:` +
        'fontcolor=white@0.92:borderw=2:bordercolor=black@0.5[vlogo]',
    );
  }

  const fontsDir = path.resolve(config.video.fontsDir);
  const assFilter = existsSync(fontsDir)
    ? `ass=subs.ass:fontsdir=${fontsDir}`
    : 'ass=subs.ass';
  vfc.push(hasSubs ? `[vlogo]${assFilter}[v]` : '[vlogo]null[v]');

  const fullv = path.join(workDir, 'fullv.mp4');
  await run('ffmpeg', [
    '-y', ...vInputs,
    '-filter_complex', vfc.join(';'),
    '-map', '[v]', '-an',
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-r', String(fps),
    path.resolve(fullv),
  ], { cwd: workDir, maxBuffer: 20 * 1024 * 1024 });

  // 5) SES PASS: narrasyon + arka plan müziği (ducking) + geçiş whoosh + outro chime.
  const fulla = path.join(workDir, 'fulla.m4a');
  await buildFullAudio(
    { workDir, narrationPath: path.resolve(audioPath), total, clipDur, td, N, M, useOutro },
    path.resolve(fulla),
  );

  // 6) MUX: video + ses.
  await run('ffmpeg', [
    '-y', '-i', path.resolve(fullv), '-i', path.resolve(fulla),
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
    '-shortest',
    path.resolve(outPath),
  ], { maxBuffer: 20 * 1024 * 1024 });

  // 5) Geçici dosyaları temizle.
  await rm(workDir, { recursive: true, force: true });

  const outDuration = await ffprobeDuration(outPath);
  return {
    outPath,
    duration: outDuration,
    width,
    height,
    clips: N,
    outro: useOutro,
  };
}
