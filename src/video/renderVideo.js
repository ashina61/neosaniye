import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { buildOutro } from './outro.js';
import { makeMusicBed } from '../audio/makeMusic.js';

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

function assHeader(width, height, styleLine) {
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${styleLine}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

/**
 * Sinematik alt altyazı: kelimeleri kısa ifadelere gruplar, konuşmayla senkron
 * gösterir, yumuşak fade ile belirir. Küçük ve genişliğe göre otomatik küçülür
 * (ekranı kaplamaz, taşıp 2 satıra bölünmez). Ayrıca opsiyonel büyük "hook" kartı.
 */
function buildCaptionAss(words, opts) {
  const {
    width, height,
    fontName = config.video.fontName,
    size = config.video.captionSize,
    marginV = config.video.captionMarginV,
    perLine = config.video.captionWordsPerLine,
    uppercase = true,
    hookText = '',
    hookDuration = config.video.hookDuration,
  } = opts;

  const marginH = 90;
  const usableW = width - 2 * marginH;
  const charFactor = 0.62; // Montserrat Black büyük harf yaklaşık genişlik oranı

  // Alt-orta (alignment 2), kalın beyaz, ince kenar + yumuşak gölge.
  const capStyle =
    `Style: Cap,${fontName},${size},&H00FFFFFF,&H00000000,&H90000000,` +
    `1,1,2.5,1,2,${marginH},${marginH},${marginV},1`;
  const styleLines = [capStyle];

  const events = [];

  // Hook kartı: ilk saniyeler, büyük, üst-orta, otomatik satır kaydırma ile sığar.
  const hk = assEscape(String(hookText || '').toUpperCase());
  if (hk) {
    const hStyle = `Style: Hook,${fontName},74,&H00FFFFFF,&H00000000,&H00000000,1,1,4,3,8,100,100,380,1`;
    styleLines.push(hStyle);
    events.push(
      `Dialogue: 1,0:00:00.00,${assTime(hookDuration)},Hook,,0,0,0,,{\\fad(200,350)}${hk}`,
    );
  }

  // Konuşma ritmine göre grupla: doğal duraklarda (sessizlik) ve noktalamada
  // böl — körlemesine N'li bölme "makine" gibi okunur, bu pro altyazı gibi akar.
  const groups = [];
  let cur = [];
  for (let i = 0; i < words.length; i += 1) {
    cur.push(words[i]);
    const next = words[i + 1];
    const gap = next ? next.start - words[i].end : Infinity;
    const punct = /[.!?,;:]$/.test(String(words[i].word));
    if (cur.length >= perLine || gap > 0.28 || punct || !next) {
      groups.push(cur);
      cur = [];
    }
  }

  for (let gi = 0; gi < groups.length; gi += 1) {
    const group = groups[gi];
    const start = group[0].start;
    const nextStart = groups[gi + 1]?.[0]?.start;
    const lastEnd = group[group.length - 1].end;
    // Bir sonraki grup hemen geliyorsa boşluk bırakma; uzun suskunlukta kaybol.
    const end = nextStart !== undefined && nextStart - lastEnd < 0.6
      ? Math.max(lastEnd, nextStart)
      : lastEnd + 0.15;
    const raw = group.map((w) => w.word).join(' ');
    const text = assEscape(uppercase ? raw.toUpperCase() : raw);
    // Genişliğe sığdır: taşarsa küçült (taşıp 2. satıra düşmesin).
    let fs = size;
    const est = text.length * charFactor * fs;
    if (est > usableW) fs = Math.max(30, Math.floor(usableW / (text.length * charFactor)));
    const emph = config.video.emphasis && /\d/.test(raw) ? `\\c${config.video.accentColor}` : '';
    events.push(
      `Dialogue: 0,${assTime(start)},${assTime(end)},Cap,,0,0,0,,{\\fs${fs}\\fad(120,90)\\blur1.2${emph}}${text}`,
    );
  }
  return assHeader(width, height, styleLines.join('\n')) + events.join('\n') + '\n';
}

/** Eski "word-pop" karaoke stili (VIDEO_CAPTION_STYLE=pop ile açılır). */
function buildPopAss(words, opts) {
  const {
    width, height,
    fontName = config.video.fontName,
    maxSize = config.video.fontSizeMax,
    minSize = config.video.fontSizeMin,
    uppercase = true,
    alignment = 5,
  } = opts;

  const marginH = 90;
  const usableW = width - 2 * marginH;
  const charFactor = 0.82;
  const style = `Style: Pop,${fontName},${maxSize},&H00FFFFFF,&H00000000,&H20000000,1,1,3,4,${alignment},${marginH},${marginH},140,1`;

  const lines = words.map((w, i) => {
    const start = w.start;
    const next = words[i + 1];
    const end = next ? Math.max(w.end, next.start) : w.end;
    const raw = uppercase ? w.word.toUpperCase() : w.word;
    const text = assEscape(raw);
    let size = maxSize;
    const est = text.length * charFactor * size;
    if (est > usableW) size = Math.max(minSize, Math.floor(usableW / (text.length * charFactor)));
    const isEmphasis =
      config.video.emphasis && (/\d/.test(raw) || raw.replace(/\W/g, '').length >= 8);
    const colorTag = isEmphasis ? `\\c${config.video.accentColor}` : '';
    const anim =
      `\\fs${size}\\blur2\\fad(50,0)${colorTag}` +
      '\\fscx58\\fscy58\\t(0,110,\\fscx112\\fscy112)\\t(110,190,\\fscx100\\fscy100)';
    return `Dialogue: 0,${assTime(start)},${assTime(end)},Pop,,0,0,0,,{${anim}}${text}`;
  });
  return assHeader(width, height, style) + lines.join('\n') + '\n';
}

/** Kelime zaman damgalarından ASS altyazısı üretir (stil config'e göre).
 *  opts.hookText verilirse ilk saniyelerde büyük hook kartı da eklenir. */
export function buildAss(wordTimings, opts = {}) {
  const words = wordTimings.filter((w) => w.word && w.end > w.start);
  const merged = { width: 1080, height: 1920, ...opts };
  const style = config.video.captionStyle;
  if (style === 'pop') return buildPopAss(words, merged);
  // 'word' = tek kelime punchy; 'caption' = kısa alt ifade.
  if (style === 'word') return buildCaptionAss(words, { ...merged, perLine: 1 });
  return buildCaptionAss(words, merged);
}

// Kategoriye göre renk paleti: tarih=sıcak, uzay=soğuk mavi, gizem=soluk koyu...
// Aynı grade her videoda = şablon hissi; konuya uyan palet = bilinçli yönetmenlik.
const CATEGORY_GRADES = {
  history:
    'eq=contrast=1.07:saturation=1.08:brightness=0.004:gamma=0.99,' +
    'colorbalance=rs=0.05:rm=0.05:gm=0.015:bm=-0.05',
  mystery:
    // Not: karartma YOK — loş sahneler telefonda çamurlaşıyor; gamma ile aç.
    'eq=contrast=1.09:saturation=0.94:brightness=0.008:gamma=1.04,' +
    'colorbalance=bm=0.04:bs=0.03:rm=-0.01',
  space:
    'eq=contrast=1.08:saturation=1.05:brightness=0.004:gamma=1.02,' +
    'colorbalance=rs=-0.03:rm=-0.02:bm=0.06:bs=0.04',
  science:
    'eq=contrast=1.08:saturation=1.12:brightness=0.004:gamma=0.99,' +
    'colorbalance=bm=0.03:rm=0.01',
  nature:
    'eq=contrast=1.06:saturation=1.2:brightness=0.006:gamma=0.99,' +
    'colorbalance=gm=0.03:gs=0.02',
};
const GRADE_ALIAS = { 'human body': 'science', technology: 'science' };
function gradeFor(category) {
  const key = String(category || '').toLowerCase();
  return (
    CATEGORY_GRADES[key] ||
    CATEGORY_GRADES[GRADE_ALIAS[key]] ||
    // varsayılan: mevcut sıcak filmik grade
    'eq=contrast=1.07:saturation=1.14:brightness=0.006:gamma=0.98,' +
      'colorbalance=rs=0.02:rm=0.03:gm=0.01:bm=-0.03'
  );
}

/** Tek bir medyayı (video/foto) sabit 1080x1920/fps klibe normalize eder.
 *  Sinematik his için: hafif renk grade + yavaş Ken Burns zoom (klip başına
 *  yön değişir). Supersample (2x) sonra küçültme jitter'ı azaltır. */
async function normalizeClip(item, duration, outPath, { width, height, fps, index = 0, category = '' }) {
  // Supersample çözünürlüğü (Ken Burns zoom'unda titremeyi azaltır).
  const sw = width * 2;
  const sh = height * 2;
  const frames = Math.max(1, Math.round(duration * fps));

  // Organik Ken Burns: zoom miktarı, yönü ve pan sürüklenmesi klip başına
  // değişir (deterministik "rastgele"). Sabit hız/merkez = makine hissi verir.
  const zMax = 1.09 + ((index * 37) % 9) / 100; // 1.09 .. 1.17
  const inc = ((zMax - 1) / frames).toFixed(6);
  const zoomIn = index % 2 === 0;
  // İlk sahnede "zoom-punch": ilk ~0.3sn hızlı vuruş, sonra yavaş devam.
  // Hook yazısıyla birleşince ilk saniye ekrana yapıştırır.
  const punch = index === 0 ? `+0.07*min(on/9,1)` : '';
  const zExpr = zoomIn
    ? `min(1${punch}+${inc}*on,${(zMax + (index === 0 ? 0.07 : 0)).toFixed(3)})`
    : `max(${zMax.toFixed(3)}-${inc}*on,1)`;
  // Sürüklenme: merkezden sapma, zoom açıldıkça kendiliğinden büyür (sınır-güvenli).
  const dxs = [0.35, -0.4, 0, 0.5, -0.3];
  const dys = [-0.25, 0.3, 0.4, 0, -0.35];
  const dx = dxs[index % dxs.length];
  const dy = dys[(index + 2) % dys.length];
  const xExpr = `(iw-iw/zoom)/2*(1+${dx.toFixed(2)})`;
  const yExpr = `(ih-ih/zoom)/2*(1+${dy.toFixed(2)})`;

  const vf = [
    // Kategoriye uygun sinematik grade (tarih=sıcak, uzay=soğuk...).
    gradeFor(category),
    `scale=${sw}:${sh}:force_original_aspect_ratio=increase`,
    `crop=${sw}:${sh}`,
    'setsar=1',
    `zoompan=z='${zExpr}':d=1:x='${xExpr}':y='${yExpr}':s=${sw}x${sh}:fps=${fps}`,
    `scale=${width}:${height}`,
    `fps=${fps}`,
    // Hafif film greni: AI/stok görüntünün steril temizliğini kırar.
    ...(config.video.grain ? ['noise=alls=5:allf=t'] : []),
    'format=yuv420p',
  ].join(',');

  const isPhoto =
    item.type === 'photo' || /\.(jpg|jpeg|png|webp)$/i.test(item.path);

  const inputArgs = isPhoto
    // -f image2 şart: gerçek JPEG'ler (Pexels) 'mjpeg' demuxer'ına düşüyor ve
    //   onda -loop yok ("Option loop not found"). image2 demuxer'ı zorlarız.
    // -framerate şart: aksi halde -loop 1 varsayılan 25fps okur ve -t süresi
    //   fps=30'da ~%17 kısalır (klip süresi bozulur).
    ? ['-f', 'image2', '-loop', '1', '-framerate', String(fps), '-t', String(duration), '-i', item.path]
    : ['-stream_loop', '-1', '-i', item.path, '-t', String(duration)];

  await run('ffmpeg', [
    '-y', ...inputArgs,
    '-vf', vf,
    '-an',
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    outPath,
  ], { maxBuffer: 20 * 1024 * 1024 });
}

/** Geçiş ses efektleri — DÖRT BARİZ FARKLI karakter (tek tip olmasın):
 *  - impact:  alçak gümleme + klik (bas vuruş, diğerlerinden net ayrışır)
 *  - riser:   kesime doğru yükselen gerilim süpürmesi
 *  - whoosh:  orta bant hareketli süpürme
 *  - shimmer: parlak çan/ışıltı (yüksek frekans) */
async function makeSfx(type, outPath) {
  let args;
  if (type === 'impact') {
    args = [
      '-f', 'lavfi', '-i', 'sine=frequency=62:duration=0.6',
      '-f', 'lavfi', '-i', 'anoisesrc=d=0.06:c=white:a=0.7',
      '-filter_complex',
      '[0]afade=t=out:st=0.04:d=0.5,volume=2.4[a];' +
        '[1]highpass=f=2500,afade=t=out:st=0.01:d=0.05,volume=0.5[b];' +
        '[a][b]amix=inputs=2:normalize=0[o]',
      '-map', '[o]',
    ];
  } else if (type === 'riser') {
    args = [
      '-f', 'lavfi', '-i', 'anoisesrc=d=0.8:c=white:a=0.55',
      '-af',
      'highpass=f=400,lowpass=f=6500,vibrato=f=8:d=0.4,' +
        'afade=t=in:st=0:d=0.68,afade=t=out:st=0.7:d=0.1,volume=1.2',
    ];
  } else if (type === 'shimmer') {
    args = [
      '-f', 'lavfi', '-i', 'sine=frequency=1567:duration=0.55',
      '-f', 'lavfi', '-i', 'sine=frequency=2093:duration=0.55',
      '-filter_complex',
      '[0][1]amix=inputs=2:normalize=0,tremolo=f=9:d=0.6,' +
        'afade=t=in:st=0:d=0.03,afade=t=out:st=0.15:d=0.38,volume=0.9[o]',
      '-map', '[o]',
    ];
  } else {
    // whoosh
    args = [
      '-f', 'lavfi', '-i', 'anoisesrc=d=0.5:c=pink:a=0.7',
      '-af',
      'bandpass=f=900:w=600,vibrato=f=6:d=0.5,' +
        'afade=t=in:st=0:d=0.15,afade=t=out:st=0.25:d=0.25,volume=1.6',
    ];
  }
  await run('ffmpeg', [
    '-y', ...args, '-ar', '44100', '-ac', '2',
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

/** assets/music/ havuzundan rastgele telifsiz parça seçer (yoksa null). */
function pickMusicTrack() {
  const exts = ['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.opus'];
  const dir = path.resolve(config.video.musicDir || 'assets/music');
  try {
    const files = readdirSync(dir)
      .filter((f) => exts.includes(path.extname(f).toLowerCase()))
      .map((f) => path.join(dir, f));
    if (files.length) return files[Math.floor(Math.random() * files.length)];
  } catch {
    /* klasör yok */
  }
  const single = path.resolve(config.video.musicPath);
  return existsSync(single) ? single : null;
}

// Havuzda gerçek parça yoksa müzik, src/audio/makeMusic.js'teki prosedürel
// motorla sentezlenir (kategoriye uygun akor progresyonu, %100 telifsiz).

/**
 * Tam ses yatağını üretir: narrasyon + arka plan müziği (ducking ile kısılır)
 * + geçiş whoosh'ları + outro chime. Toplam süre `total`.
 */
async function buildFullAudio(
  { workDir, narrationPath, total, clipDur, bts, N, M, useOutro, category = '' },
  outPath,
) {
  const sfx = config.video.sfx;
  const useMusic = config.video.music;

  // Geçiş offsetleri (video ile aynı hesap: sınır bazlı süreler).
  const off = [];
  let cum = 0;
  let btSum = 0;
  for (let k = 1; k < M; k += 1) {
    cum += clipDur[k - 1];
    btSum += bts[k - 1];
    off.push(cum - btSum);
  }
  // SFX yalnızca GERÇEK geçişlere biner (sert kesmeler sessiz — pro kurgu).
  const realMainBoundaries = [];
  for (let k = 1; k <= Math.max(0, N - 1); k += 1) {
    if (bts[k - 1] >= 0.2) realMainBoundaries.push(k);
  }

  const inputs = ['-i', narrationPath]; // 0 = narrasyon
  let idx = 1;

  let musicIdx = -1;
  if (useMusic) {
    const track = pickMusicTrack();
    if (track) {
      inputs.push('-stream_loop', '-1', '-i', track);
      console.log(`[audio] müzik: ${path.basename(track)}`);
    } else {
      const bed = path.join(workDir, 'music-bed.wav');
      await makeMusicBed({
        outPath: bed,
        seconds: total + 1,
        category,
        seed: Math.floor(total * 97) + N, // videoya özgü varyasyon
      });
      inputs.push('-i', path.resolve(bed));
      console.log(`[audio] müzik: prosedürel yatak (${category || 'default'})`);
    }
    musicIdx = idx;
    idx += 1;
  }

  // Çeşitli SFX yalnızca gerçek geçişlerde; başlangıç sırası videodan videoya
  // kayar ki art arda videolar bile aynı diziyi kullanmasın.
  const sfxCycle = ['whoosh', 'impact', 'riser', 'shimmer'];
  const sfxShift = (N + Math.round(total)) % sfxCycle.length;
  const sfxPlan = []; // { idx, k }
  if (sfx && realMainBoundaries.length) {
    for (let n = 0; n < realMainBoundaries.length; n += 1) {
      const k = realMainBoundaries[n];
      const type = sfxCycle[(sfxShift + n) % sfxCycle.length];
      const f = path.join(workDir, `sfx-${k}.wav`);
      await makeSfx(type, f);
      inputs.push('-i', path.resolve(f));
      sfxPlan.push({ idx, k });
      idx += 1;
    }
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

  // Anlatım sesini "yayın" zincirinden geçir: alçak-frekans temizliği +
  // presence EQ + kompresör. Ham TTS'ten çok daha dolgun/pro tınlar.
  const voiceChain =
    'highpass=f=70,equalizer=f=3200:t=q:w=1.2:g=1.5,' +
    'acompressor=threshold=0.12:ratio=2.5:attack=8:release=140:makeup=1.4,' +
    'aresample=44100';

  if (useMusic) {
    fc.push(`[0:a]${voiceChain},asplit=2[nkey][nmix]`);
    fc.push(
      `[${musicIdx}:a]aresample=44100,atrim=0:${total.toFixed(3)},volume=${config.video.musicVolume}[mus]`,
    );
    // Narrasyon konuşurken müziği HAFİFÇE kıs (önceki 8:1 oran müziği tamamen
    // susturuyordu — "müzik yok" şikayetinin sebebi buydu).
    fc.push('[mus][nkey]sidechaincompress=threshold=0.09:ratio=2.2:attack=30:release=700[musd]');
    mix.push('[nmix]', '[musd]');
  } else {
    fc.push(`[0:a]${voiceChain}[nmix]`);
    mix.push('[nmix]');
  }

  for (const { idx: inIdx, k } of sfxPlan) {
    const ms = Math.round((off[k - 1] + bts[k - 1] / 2) * 1000);
    fc.push(
      `[${inIdx}:a]aresample=44100,adelay=${ms}|${ms},volume=${config.video.transitionSoundVolume}[wd${k}]`,
    );
    mix.push(`[wd${k}]`);
  }

  if (chimeIdx >= 0) {
    const ms = Math.round((off[N - 1] + bts[N - 1] / 2) * 1000);
    fc.push(`[${chimeIdx}:a]aresample=44100,adelay=${ms}|${ms},volume=0.35[chm]`);
    mix.push('[chm]');
  }

  // Karışım -> kapanışta yumuşak sönüş -> YouTube standardı -14 LUFS loudness.
  const fadeStart = Math.max(0, total - 1.1).toFixed(3);
  const master =
    `apad,atrim=0:${total.toFixed(3)},afade=t=out:st=${fadeStart}:d=1.1,` +
    'loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100';
  if (mix.length > 1) {
    fc.push(`${mix.join('')}amix=inputs=${mix.length}:normalize=0:duration=longest,${master}[a]`);
  } else {
    fc.push(`${mix[0]}${master}[a]`);
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
  const { audioPath, wordTimings = [], media = [], outPath, hookText = '', category = '' } = job;
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

  const td = M > 1 ? config.video.transitionDuration : 0;

  // KURGU PLANI: kesme-geçiş-kesme-geçiş ritmi. Sert kesmeler tempo verir,
  // her 2. sınırdaki animasyonlu geçiş (whoosh'uyla birlikte) dinamizm katar.
  const CUT = 2 / fps;
  const trsList = config.video.transitions;
  const bts = []; // sınır başına geçiş süresi (k=1..M-1)
  const btName = []; // sınır başına geçiş tipi
  let realCount = 0;
  for (let k = 1; k < M; k += 1) {
    const isOutroBoundary = useOutro && k === M - 1;
    const real = isOutroBoundary || k % 2 === 0;
    if (real) {
      bts.push(td);
      btName.push(trsList[realCount % trsList.length] || 'fade');
      realCount += 1;
    } else {
      bts.push(CUT);
      btName.push('fade');
    }
  }
  const mainBts = bts.slice(0, Math.max(0, N - 1));
  const mainTdSum = mainBts.reduce((a, b) => a + b, 0);

  // Ana klip süreleri: sahne ağırlıkları (kelime sayısı) verildiyse orantılı,
  // yoksa eşit bölüşüm. Ana bölüm ekranda narrationDur kadar görünür:
  // sum(mainDurs) - sum(mainBts) = narrationDur.
  const span = narrationDur + mainTdSum;
  const weights =
    Array.isArray(job.sceneWeights) && job.sceneWeights.length === N
      ? job.sceneWeights
      : null;
  let mainDurs;
  if (weights) {
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    const minClip = Math.max(0.8, td + 0.3);
    mainDurs = weights.map((w) => Math.max(minClip, (w / sum) * span));
    const s2 = mainDurs.reduce((a, b) => a + b, 0) || 1;
    mainDurs = mainDurs.map((d) => (d * span) / s2); // clamp sonrası span'e geri ölçekle
  } else {
    mainDurs = Array(N).fill(span / N);
  }
  // Kuyruk: anlatım bitince video ANINDA kesilmesin; son sahne nefes alır,
  // müzik bu pencerede yumuşakça söner (pro kapanış hissi).
  const tail = Math.max(0, config.video.tailSeconds || 0);
  mainDurs[N - 1] += tail;

  const dOutro = outroExtra + (useOutro ? bts[M - 2] : 0);
  const clipDur = [...mainDurs, ...(useOutro ? [dOutro] : [])];
  const total = clipDur.reduce((a, b) => a + b, 0) - bts.reduce((a, b) => a + b, 0);

  // 2) Ana klipleri normalize et + outro klibini üret.
  const clips = [];
  for (let i = 0; i < N; i += 1) {
    const clipPath = path.join(workDir, `clip-${String(i).padStart(2, '0')}.mp4`);
    await normalizeClip(
      media[i],
      Math.max(0.6, clipDur[i] + (M > 1 ? 0.05 : 0)),
      clipPath,
      { width, height, fps, index: i, category },
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
      // Sinematik arka plan: son klibi bulanıklaştırıp koyulaştırarak kullan.
      bgClip: clips[N - 1],
    });
    clips.push(outroPath);
  }

  // 3) Altyazı + hook kartı (ikisi de aynı ASS içinde; hook otomatik satır kaydırır).
  const hasHook = config.video.hookOverlay && Boolean(hookText);
  const hasSubs = wordTimings.length > 0;
  const useAss = hasSubs || hasHook;
  if (useAss) {
    await writeFile(
      path.join(workDir, 'subs.ass'),
      buildAss(wordTimings, { width, height, hookText: hasHook ? hookText : '' }),
    );
  }

  // 4) VİDEO PASS: xfade -> logo -> abone uyarısı -> altyazı -> hook (sessiz).
  const dtxt = (s) =>
    String(s || '').toUpperCase().replace(/[\r\n]+/g, ' ').replace(/[\\:'%]/g, '').trim();
  const montFont = path.resolve(config.video.fontsDir, 'Montserrat-Black.ttf');
  const drawFontFile = existsSync(montFont) ? montFont : findFontFile();
  const drawFontOpt = drawFontFile ? `fontfile=${drawFontFile}:` : '';

  const vInputs = [];
  clips.forEach((p) => vInputs.push('-i', path.resolve(p)));
  let nextIdx = clips.length;

  // Köşe filigranı: kompakt monogram varsa onu, yoksa tam logoyu kullan.
  const markImg = config.video.logoMarkPath ? path.resolve(config.video.logoMarkPath) : '';
  const logoImg = existsSync(markImg) ? markImg : path.resolve(config.video.logoPath);
  const hasLogoImg = existsSync(logoImg);
  let logoIdx = -1;
  if (hasLogoImg) { logoIdx = nextIdx; nextIdx += 1; vInputs.push('-i', logoImg); }

  // Video-içi abone uyarısı (loop-dostu): pill + like ikonu, ortalarda kısa süre belirir.
  const pillPath = path.resolve('assets/icons/subbtn.png');
  const likePath = path.resolve('assets/icons/like.png');
  const spOn = config.video.subPrompt && existsSync(pillPath) && total > 9;
  let pillIdx = -1;
  let likeIdx = -1;
  let T1 = 0;
  let T2 = 0;
  if (spOn) {
    T1 = Math.min(Math.max(total * 0.42, 3.5), Math.max(3.5, total - 4.8));
    T2 = T1 + 2.6;
    pillIdx = nextIdx; nextIdx += 1;
    vInputs.push('-loop', '1', '-framerate', String(fps), '-t', total.toFixed(3), '-i', pillPath);
    if (existsSync(likePath)) {
      likeIdx = nextIdx; nextIdx += 1;
      vInputs.push('-loop', '1', '-framerate', String(fps), '-t', total.toFixed(3), '-i', likePath);
    }
  }

  const vfc = [];
  let vbase = '[0:v]';
  if (M > 1) {
    let prev = '[0:v]';
    let cum = 0;
    let btSum = 0;
    for (let k = 1; k < M; k += 1) {
      cum += clipDur[k - 1];
      btSum += bts[k - 1];
      const off = (cum - btSum).toFixed(3);
      const out = k === M - 1 ? '[vx]' : `[x${k}]`;
      vfc.push(
        `${prev}[${k}:v]xfade=transition=${btName[k - 1]}:duration=${bts[k - 1].toFixed(3)}:offset=${off}${out}`,
      );
      prev = out;
    }
    vbase = '[vx]';
  }

  // Logo
  let last;
  if (hasLogoImg) {
    vfc.push(`[${logoIdx}:v]scale=-1:72[lg]`);
    vfc.push(`${vbase}[lg]overlay=72:64[vlogo]`);
    last = '[vlogo]';
  } else {
    const txt = dtxt(config.video.logoText);
    vfc.push(
      `${vbase}drawtext=${drawFontOpt}text='${txt}':x=40:y=48:fontsize=44:` +
        'fontcolor=white@0.92:borderw=2:bordercolor=black@0.5[vlogo]',
    );
    last = '[vlogo]';
  }

  // Abone uyarısı: yukarıdan ease ile süzülür, bekler, yukarı kayarak çıkar
  // (düpedüz bitivermesin — canlı bir eleman gibi hareket etsin).
  if (spOn) {
    const win = `format=rgba,fade=t=in:st=${T1.toFixed(2)}:d=0.3:alpha=1,fade=t=out:st=${T2.toFixed(2)}:d=0.3:alpha=1`;
    const groupLeft = Math.round((width - (88 + 14 + 300)) / 2);
    const pillX = groupLeft + 88 + 14;
    const pillY = 158;
    const t1 = T1.toFixed(2);
    const t2 = T2.toFixed(2);
    // base konumuna kayan y ifadesi: giriş ease-out (0.45s), oturunca hafif
    // SALLANMA (canlı dursun), çıkış ease-in (0.35s). amp/faz eleman başına.
    const slideY = (base, amp = 4, phase = 0) => {
      const B = base + 400;
      const bob = `${amp}*sin(2*PI*1.3*t+${phase})*gt(t,${t1}+0.5)`;
      return (
        `'if(lt(t,${t2}),` +
        `-400+${B}*(1-pow(1-min(max(t-${t1},0)/0.45,1),2))+${bob},` +
        `${base}-${B}*pow(min((t-${t2})/0.35,1),2))'`
      );
    };
    vfc.push(`[${pillIdx}:v]scale=300:-1,${win}[pill]`);
    if (likeIdx >= 0) {
      vfc.push(`[${likeIdx}:v]scale=88:88,${win}[lk]`);
      // like ikonu ters fazda ve daha geniş sallanır ("beğen" dürtmesi hissi)
      vfc.push(`${last}[lk]overlay=x=${groupLeft}:y=${slideY(152, 7, 3.14)}[vsp0]`);
      last = '[vsp0]';
    }
    vfc.push(`${last}[pill]overlay=x=${pillX}:y=${slideY(158, 4, 0)}[vsp1]`);
    const t1b = (T1 + 0.3).toFixed(2);
    const t2b = (T2 + 0.3).toFixed(2);
    const spAlpha =
      `alpha='if(lt(t,${t1}),0,if(lt(t,${t1b}),(t-${t1})/0.3,if(lt(t,${t2}),1,if(lt(t,${t2b}),1-(t-${t2})/0.3,0))))'`;
    const pillCx = pillX + 150;
    vfc.push(
      `[vsp1]drawtext=${drawFontOpt}text='SUBSCRIBE':fontcolor=white:fontsize=40:` +
        `x=${pillCx}-text_w/2:y=${slideY(pillY + 15, 4, 0)}:${spAlpha}[vsp2]`,
    );
    last = '[vsp2]';
  }

  // Altyazı + hook (aynı ASS dosyasında; hook otomatik satır kaydırır, sığar).
  const fontsDir = path.resolve(config.video.fontsDir);
  const assFilter = existsSync(fontsDir) ? `ass=subs.ass:fontsdir=${fontsDir}` : 'ass=subs.ass';
  if (useAss) {
    vfc.push(`${last}${assFilter}[v]`);
  } else {
    vfc.push(`${last}null[v]`);
  }

  const fullv = path.join(workDir, 'fullv.mp4');
  await run('ffmpeg', [
    '-y', ...vInputs,
    '-filter_complex', vfc.join(';'),
    '-map', '[v]', '-an',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '21',
    '-maxrate', '12M', '-bufsize', '24M',
    '-pix_fmt', 'yuv420p', '-r', String(fps),
    path.resolve(fullv),
  ], { cwd: workDir, maxBuffer: 20 * 1024 * 1024 });

  // 5) SES PASS: narrasyon + arka plan müziği (ducking) + geçiş whoosh + outro chime.
  const fulla = path.join(workDir, 'fulla.m4a');
  await buildFullAudio(
    { workDir, narrationPath: path.resolve(audioPath), total, clipDur, bts, N, M, useOutro, category },
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
