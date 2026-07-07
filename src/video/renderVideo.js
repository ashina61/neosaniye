import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);

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
    fontName = 'DejaVu Sans',
    fontSize = 96,
    uppercase = true,
    alignment = 5, // 5 = orta-orta
  } = opts;

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Pop,${fontName},${fontSize},&H00FFFFFF,&H00000000,&H64000000,1,1,5,2,${alignment},80,80,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const words = wordTimings.filter((w) => w.word && w.end > w.start);
  const lines = words.map((w, i) => {
    const start = w.start;
    // Boşlukları doldur: bir sonraki kelimenin başlangıcına kadar göster.
    const next = words[i + 1];
    const end = next ? Math.max(w.end, next.start) : w.end;
    const text = assEscape(uppercase ? w.word.toUpperCase() : w.word);
    return `Dialogue: 0,${assTime(start)},${assTime(end)},Pop,,0,0,0,,${text}`;
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

  // 2) Süreyi medya sayısına böl (son klip kalanı alır -> toplam tam eşleşir).
  const per = duration / media.length;
  const normalized = [];
  for (let i = 0; i < media.length; i += 1) {
    const slice = i === media.length - 1 ? duration - per * i : per;
    const clipPath = path.join(workDir, `clip-${String(i).padStart(2, '0')}.mp4`);
    await normalizeClip(media[i], Math.max(0.5, slice), clipPath, {
      width, height, fps,
    });
    normalized.push(clipPath);
  }

  // 3) Klipleri birleştir (hepsi aynı parametrede -> concat + copy güvenli).
  const listPath = path.join(workDir, 'concat.txt');
  await writeFile(
    listPath,
    normalized.map((p) => `file '${path.resolve(p)}'`).join('\n'),
  );
  const concatPath = path.join(workDir, 'concat.mp4');
  await run('ffmpeg', [
    '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
    '-c', 'copy', concatPath,
  ]);

  // 4) Ses bindir + (varsa) karaoke altyazı yak.
  const finalArgs = ['-y', '-i', concatPath, '-i', path.resolve(audioPath)];
  const hasSubs = wordTimings.length > 0;
  if (hasSubs) {
    const assPath = path.join(workDir, 'subs.ass');
    await writeFile(assPath, buildAss(wordTimings, { width, height }));
    // ass filtresi basit dosya adı ile (cwd=workDir) -> path kaçış derdi yok.
    finalArgs.push('-vf', 'ass=subs.ass');
  }
  finalArgs.push(
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k',
    '-shortest', '-r', String(fps),
    path.resolve(outPath),
  );
  await run('ffmpeg', finalArgs, {
    cwd: workDir,
    maxBuffer: 20 * 1024 * 1024,
  });

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
