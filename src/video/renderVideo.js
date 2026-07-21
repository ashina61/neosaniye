import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { buildOutro } from './outro.js';
import { groupCaptionWords, layoutGroup } from './captionLayout.js';
import { makeMusicBed } from '../audio/makeMusic.js';
import { selectMusic } from '../audio/musicSelect.js';

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
    // Referans stil: BAĞIRAN CAPS değil, doğal cümle akışı (premium his).
    uppercase = false,
    hookText = '',
    hookDuration = config.video.hookDuration,
    emphasisWords = [],
    finaleText = '',
  } = opts;

  // Vurgu sözlüğü: yönetmenin işaretlediği kelimeler (normalize edilmiş).
  const normWord = (w) => String(w).toLowerCase().replace(/[^a-z0-9]/g, '');
  const emphSet = new Set(emphasisWords.map(normWord).filter(Boolean));
  const isEmph = (w) =>
    config.video.emphasis && (/\d/.test(w) || emphSet.has(normWord(w)));

  const marginH = 90;
  const usableW = width - 2 * marginH;
  const charFactor = 0.56; // Montserrat SemiBold karışık harf yaklaşık genişlik oranı

  // Normal altyazı: SemiBold, alt-orta, beyaz. Okunabilirlik için GÜÇLÜ
  // kenarlık (2.6) + belirgin gölge (2.6) — küçük/düşük kontrast şikâyeti
  // sonrası artırıldı; her zeminde net, banda gerek kalmadan okunur.
  const capStyle =
    `Style: Cap,Montserrat SemiBold,${size},&H00FFFFFF,&H00000000,&HB4000000,` +
    `0,1,2.6,2.6,2,${marginH},${marginH},${marginV},1`;
  // Vurgu parçası: AYRI ve FARKLI FONTTA (zarif italik serif) — referans stil.
  // Temiz BEYAZ dolgu + KALIN opak siyah kenarlık (outline 0 idi, aydınlık arka
  // planda soluk kalıyordu; altın deneyince cırtlak oldu). Beyaz + güçlü kenarlık
  // her zeminde net okunur ve premium/zarif durur. Kendi bandında, akan altyazının
  // ÜSTÜNDE durur; böylece ekranda daha uzun kalsa da çakışmaz.
  // Vurgu ALTYAZI POZİSYONUNDA, akışın içinde tek başına görünür (ayrı orta
  // bant "arada uçuyor" hissi veriyordu ve kartların üstüne biniyordu —
  // kullanıcı geri bildirimi). Aynı taban çizgisi, daha büyük + serif italik.
  const emphSize = Math.round(size * 1.5);
  const emphStyle =
    `Style: Emph,Playfair Display,${emphSize},&H00FFFFFF,&H00000000,&H64000000,` +
    `1,1,4,2,2,${marginH},${marginH},${marginV},1`;
  const styleLines = [capStyle, emphStyle];

  const events = [];

  // Hook kartı: BÜYÜK, KALIN SANS-SERIF (Montserrat Black), YÜKSEK KONTRAST,
  // BÜYÜK HARF — ilk 0-1.5sn'de telefonda ilk bakışta okunmalı. İnce dekoratif
  // serif (Playfair) küçük/soluk kalıyordu (kullanıcı geri bildirimi); scroll-stop
  // gücü için kalın sans + kalın kenarlık + yarı opak zemin kutusu.
  const hkRaw = String(hookText || '').trim();
  const hk = assEscape(hkRaw.toUpperCase());
  if (hk) {
    // Kalın sans daha geniş: tek satıra sığmazsa 2 satıra sarar, sonra küçülür.
    const hookFactor = 0.62; // Montserrat Black büyük-harf ortalama genişlik
    let hfs = 104;
    if (hkRaw.length * hookFactor * hfs > 2 * usableW) {
      hfs = Math.max(60, Math.floor((2 * usableW) / (hkRaw.length * hookFactor)));
    }
    // BorderStyle 3 = opak zemin kutusu (BackColour) → en karmaşık arka planda
    // bile hook net okunur. Kalın kenarlık + güçlü gölge.
    const hStyle =
      `Style: Hook,Montserrat Black,${hfs},&H00FFFFFF,&H00000000,&HA0000000,` +
      `1,3,4,3,8,${marginH},${marginH},360,1`;
    styleLines.push(hStyle);
    const cx = Math.round(width / 2);
    events.push(
      `Dialogue: 1,0:00:00.00,${assTime(hookDuration)},Hook,,0,0,0,,` +
        `{\\b1\\fad(140,340)\\move(${cx},322,${cx},384,0,460)` +
        `\\blur4\\t(0,460,\\blur0)\\fscy90\\t(0,460,\\fscy100)}${hk}`,
    );
  }

  // FİNAL VURUŞU: hikâyenin mic-drop cümlesi — normal altyazının ÜSTÜNDE,
  // bambaşka tonda (zarif italik serif), son saniyelerde belirir (referans stil).
  const fin = assEscape(String(finaleText || '').trim());
  if (fin && words.length) {
    let ffs = 84;
    const finFactor = 0.5; // Playfair italik ortalama genişlik
    if (fin.length * finFactor * ffs > usableW) {
      ffs = Math.max(52, Math.floor(usableW / (fin.length * finFactor)));
    }
    // Kapanış cümlesi: outline 0 + blur yüzünden hayalet gibi soluk kalıyordu.
    // Artık gerçek kenarlık (2.6) + net (blur yok) — okunur ama yine zarif.
    // İnce harf aralığı (\fsp) + yumuşak oturma ile "kapanış başlığı" havası.
    const fStyle =
      `Style: Finale,Playfair Display,${ffs},&H00FFFFFF,&H00000000,&H8C000000,` +
      `0,1,2.6,2,2,${marginH},${marginH},${marginV + 210},1`;
    styleLines.push(fStyle);
    const tEnd = words[words.length - 1].end;
    const st = Math.max(0.5, tEnd - 2.6);
    events.push(
      `Dialogue: 2,${assTime(st)},${assTime(tEnd + 1.6)},Finale,,0,0,0,,` +
        `{\\i1\\fsp2\\fad(420,320)\\fscx103\\fscy103\\t(0,520,\\fscx100\\fscy100)}${fin}`,
    );
  }

  // Konuşma ritmine göre grupla ve yerleştir — matematik captionLayout.js'te
  // (Retention QC aynı hesabı kullanır; render ile QC asla ayrışmaz).
  // Vurgulu kelimeler kendi koşusunu alır; normal gruplar fontu ezmek yerine
  // önce bölünür (split-before-shrink), taban captionMinPx'in altına inilmez.
  const groups = groupCaptionWords(words, { perLine, isEmph });
  const laid = [];
  for (const g of groups) {
    const opts = g.isEmph
      ? // Vurgu koşusu bölünmez (splitRatio 0) — "100,000 acres" ikilisi bir arada.
        { usableW, baseSize: emphSize, minSize: config.video.captionEmphMinPx, charFactor: 0.5, wordFactor: 0.5, splitRatio: 0 }
      : { usableW, baseSize: size, minSize: config.video.captionMinPx, charFactor, wordFactor: 0.62, splitRatio: config.video.captionSplitRatio };
    for (const ev of layoutGroup(g, opts)) laid.push({ ...ev, isEmph: Boolean(g.isEmph) });
  }

  for (let gi = 0; gi < laid.length; gi += 1) {
    const ev = laid[gi];
    const start = ev.words[0].start;
    const nextStart = laid[gi + 1]?.words[0]?.start;
    const lastEnd = ev.words[ev.words.length - 1].end;
    // Bir sonraki grup hemen geliyorsa boşluk bırakma; uzun suskunlukta kaybol.
    const end = nextStart !== undefined && nextStart - lastEnd < 0.6
      ? Math.max(lastEnd, nextStart)
      : lastEnd + 0.15;
    const text = assEscape(uppercase ? ev.text.toUpperCase() : ev.text);
    if (ev.isEmph) {
      // VURGU PARÇASI: altyazı bandında akışın PARÇASI, farklı font (Playfair
      // italik), daha büyük. Kendi zaman dilimini kullanır (uzatma yok —
      // aynı banttaki sonraki altyazı grubunu ezerdi).
      events.push(
        `Dialogue: 0,${assTime(start)},${assTime(end)},Emph,,0,0,0,,` +
          `{\\fs${ev.fontSize}\\i1\\b1\\fad(90,110)\\fscx92\\fscy92\\t(0,150,\\fscx100\\fscy100)}${text}`,
      );
    } else {
      events.push(
        `Dialogue: 0,${assTime(start)},${assTime(end)},Cap,,0,0,0,,{\\fs${ev.fontSize}\\fad(120,90)\\blur1.2}${text}`,
      );
    }
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
async function normalizeClip(item, duration, outPath, { width, height, fps, index = 0, category = '', animated = false }) {
  // Supersample çözünürlüğü (Ken Burns zoom'unda titremeyi azaltır).
  const sw = width * 2;
  const sh = height * 2;
  const frames = Math.max(1, Math.round(duration * fps));

  // Organik Ken Burns: zoom miktarı, yönü ve pan sürüklenmesi klip başına
  // değişir (deterministik "rastgele"). Sabit hız/merkez = makine hissi verir.
  // Animasyonlu stil: daha agresif kamera (illüstrasyona canlılık verir).
  const zMax = (animated ? 1.14 : 1.09) + ((index * 37) % 9) / 100; // 1.09..1.17 | 1.14..1.22
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

/** Geçiş ses efektleri — katmanlı + echo kuyruklu (ham sentez "cacık" durur;
 *  küçük bir mekân kuyruğu prodüksiyon sesi hissi verir):
 *  - impact:  sub + gövde + klik + kuyruk (twist vuruşu)
 *  - riser:   kesime tırmanan gerilim süpürmesi
 *  - whoosh:  orta bant süpürme + kuyruk
 *  - shimmer: parlak çan + uzun yumuşak kuyruk
 *  - click:   UI tık sesi (abone kartı belirirken) */
async function makeSfx(type, outPath) {
  let args;
  if (type === 'impact') {
    args = [
      '-f', 'lavfi', '-i', 'sine=frequency=48:duration=0.9',
      '-f', 'lavfi', '-i', 'sine=frequency=90:duration=0.5',
      '-f', 'lavfi', '-i', 'anoisesrc=d=0.05:c=white:a=0.8',
      '-filter_complex',
      '[0]afade=t=out:st=0.05:d=0.8,volume=2.2[sub];' +
        '[1]afade=t=out:st=0.03:d=0.4,volume=1.6[body];' +
        '[2]highpass=f=1800,afade=t=out:st=0.005:d=0.045,volume=0.6[clk];' +
        '[sub][body][clk]amix=inputs=3:normalize=0,' +
        'aecho=0.7:0.4:40|75:0.35|0.2[o]',
      '-map', '[o]',
    ];
  } else if (type === 'riser') {
    args = [
      '-f', 'lavfi', '-i', 'anoisesrc=d=0.9:c=pink:a=0.6',
      '-af',
      'highpass=f=350,lowpass=f=7000,vibrato=f=10:d=0.5,' +
        'afade=t=in:st=0:d=0.75,afade=t=out:st=0.78:d=0.12,' +
        // Normalize the complete envelope before it enters the delayed SFX
        // bus.  The old source had no loudness control, so its quiet attack
        // never crossed the sidechain threshold and received no local pocket.
        'aecho=0.5:0.3:35:0.3,loudnorm=I=-18:TP=-3:LRA=3',
    ];
  } else if (type === 'shimmer') {
    args = [
      '-f', 'lavfi', '-i', 'sine=frequency=1567:duration=0.7',
      '-f', 'lavfi', '-i', 'sine=frequency=2093:duration=0.7',
      '-f', 'lavfi', '-i', 'sine=frequency=3136:duration=0.7',
      '-filter_complex',
      '[0][1][2]amix=inputs=3:normalize=0,tremolo=f=8:d=0.5,' +
        'afade=t=in:st=0:d=0.02,afade=t=out:st=0.18:d=0.5,' +
        'aecho=0.6:0.45:80|140:0.4|0.25,volume=0.8[o]',
      '-map', '[o]',
    ];
  } else if (type === 'click') {
    args = [
      '-f', 'lavfi', '-i', 'sine=frequency=1150:duration=0.06',
      '-f', 'lavfi', '-i', 'anoisesrc=d=0.03:c=white:a=0.6',
      '-filter_complex',
      '[0]afade=t=out:st=0.015:d=0.045,volume=1.2[t];' +
        '[1]highpass=f=3000,afade=t=out:st=0.004:d=0.026,volume=0.7[n];' +
        '[t][n]amix=inputs=2:normalize=0,aecho=0.4:0.2:25:0.18[o]',
      '-map', '[o]',
    ];
  } else {
    // whoosh
    args = [
      '-f', 'lavfi', '-i', 'anoisesrc=d=0.55:c=pink:a=0.75',
      '-af',
      'bandpass=f=850:w=700,vibrato=f=7:d=0.6,' +
        'afade=t=in:st=0:d=0.16,afade=t=out:st=0.28:d=0.27,' +
        'aecho=0.6:0.35:45:0.3,volume=1.7',
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

/** Animasyonlu stil için canlı doku katmanı: yukarı süzülen bulanık toz
 *  zerreleri + yavaş gezinen çok saydam sıcak ışık lekesi. Saf ASS (libass)
 *  çizimleriyle — ek bağımlılık yok, encode maliyeti ihmal edilebilir.
 *  Altyazı ASS'inden AYRI dosya; captions'ın ALTINA (önce) uygulanır. */
function buildFxAss(total, { width, height, seed = 1 } = {}) {
  let s = (seed >>> 0) || 1;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const t2a = (t) => {
    const cs = Math.max(0, Math.round(t * 100));
    const h = Math.floor(cs / 360000);
    const m = Math.floor((cs % 360000) / 6000);
    const sec = Math.floor((cs % 6000) / 100);
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
  };
  const circle = 'm 0 -5 b 7 -5 7 5 0 5 b -7 5 -7 -5 0 -5';
  const ev = [];

  // Toz zerreleri (~0.8 adet/sn doğar; 3.5-7sn yaşar, yukarı süzülür).
  const count = Math.round(total * 0.8);
  for (let i = 0; i < count; i += 1) {
    const born = rnd() * Math.max(0.1, total - 3);
    const end = Math.min(total, born + 3.5 + rnd() * 3.5);
    const x1 = Math.round(rnd() * width);
    const y1 = Math.round(height * (0.25 + rnd() * 0.75));
    const x2 = Math.round(x1 + (rnd() - 0.5) * 260);
    const y2 = Math.round(y1 - (120 + rnd() * 260));
    const sc = Math.round(35 + rnd() * 85);
    const alpha = (160 + Math.floor(rnd() * 60)).toString(16).toUpperCase(); // A0..DB
    ev.push(
      `Dialogue: 1,${t2a(born)},${t2a(end)},Fx,,0,0,0,,` +
        `{\\an7\\move(${x1},${y1},${x2},${y2})\\fad(700,900)\\blur3` +
        `\\1c&HFFFFFF&\\1a&H${alpha}&\\fscx${sc}\\fscy${sc}\\p1}${circle}{\\p0}`,
    );
  }

  // Işık lekesi: dev, aşırı saydam, sıcak; ~18sn'de bir yenisi gezinir.
  const blobs = Math.max(1, Math.round(total / 18));
  for (let i = 0; i < blobs; i += 1) {
    const born = i * (total / blobs);
    const end = Math.min(total, born + total / blobs + 2);
    const x1 = Math.round(rnd() * width);
    const y1 = Math.round(rnd() * height * 0.5);
    const x2 = Math.round(rnd() * width);
    const y2 = Math.round(rnd() * height * 0.5);
    ev.push(
      `Dialogue: 0,${t2a(born)},${t2a(end)},Fx,,0,0,0,,` +
        `{\\an7\\move(${x1},${y1},${x2},${y2})\\fad(1500,1500)\\blur60` +
        `\\1c&HD8F0FF&\\1a&HE8&\\fscx2600\\fscy2600\\p1}${circle}{\\p0}`,
    );
  }

  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Fx,Arial,20,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${ev.join('\n')}
`;
}

// Müzik seçimi src/audio/musicSelect.js'e taşındı: CC0 kütüphane manifesti
// kapısı + son kullanılan parçaların tekrarını önleme oradadır.

// Havuzda gerçek parça yoksa müzik, src/audio/makeMusic.js'teki prosedürel
// motorla sentezlenir (kategoriye uygun akor progresyonu, %100 telifsiz).

/**
 * Tam ses yatağını üretir: narrasyon + arka plan müziği (ducking ile kısılır)
 * + geçiş whoosh'ları + outro chime. Toplam süre `total`.
 */
async function buildFullAudio(
  {
    workDir, narrationPath, total, clipDur, bts, N, M, useOutro,
    category = '', sfxTypes = [], clickAt = null, ambiencePath = null,
    avoidMusic = [], musicSeed = '',
  },
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

  const inputs = ['-i', narrationPath]; // 0 = narrasyon
  let idx = 1;

  let musicIdx = -1;
  let musicIsReal = false;
  let musicTrack = null;
  let musicDecision = null;
  if (useMusic) {
    // Deterministik seed = videoya özgü (aynı video → aynı, farklı video → çeşitli).
    const decision = selectMusic(category, { avoid: avoidMusic, seed: musicSeed || `${category}:${N}:${Math.round(total)}` });
    musicDecision = decision;
    const track = decision.track;
    if (track) {
      musicTrack = track;
      musicIsReal = true;
      inputs.push('-stream_loop', '-1', '-i', track);
      console.log(`[audio] müzik: ${path.basename(track)} (${category || 'havuz'}, ${decision.reason})`);
      if (decision.poolExhausted) console.warn(`[audio] ⚠️ müzik havuzu tükendi (${decision.reason}) — çeşitlilik kısıtlı.`);
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

  // Ambiyans yatağı (Freesound, best-effort): kısa kayıtlar loop'lanır.
  let ambIdx = -1;
  if (ambiencePath && existsSync(ambiencePath)) {
    inputs.push('-stream_loop', '-1', '-i', path.resolve(ambiencePath));
    ambIdx = idx;
    idx += 1;
  }

  // SFX planı renderVideo'da belirlendi (kurgucu ya da mekanik): sınır başına
  // tip veya null. Sadece dolu olanlar üretilip mix'e girer.
  const sfxPlan = []; // { idx, k }
  if (sfx) {
    for (let k = 1; k <= Math.max(0, N - 1); k += 1) {
      const type = sfxTypes[k - 1];
      if (!type) continue;
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

  // Abone kartı belirirken UI 'tık' sesi (kart görselle senkron).
  let clickIdx = -1;
  if (sfx && Number.isFinite(clickAt) && clickAt > 0) {
    const click = path.join(workDir, 'click.wav');
    await makeSfx('click', click);
    inputs.push('-i', path.resolve(click));
    clickIdx = idx;
    idx += 1;
  }

  const fc = [];
  const bedMix = [];    // konuşma + müzik + ambiyans (SFX olmayan yataklar)
  const sfxLabels = []; // gecikmeli SFX akış etiketleri
  const sfxCues = [];   // {atSeconds, sfxId, assetPath, mixedInGraph} — çıktı doğrulaması için

  // SFX seviyesi: GERÇEK yoğun mikste (TTS+müzik+ambiyans, -14 LUFS) vuruş
  // maskeleniyordu — gerçek koşuda riser/shimmer/CTA pop gömüldü (+-1/-0.1/+0.4 dB),
  // yalnız impact geçti (+3.6). Taban seviye yükseltildi; ayrıca cue anında HEM
  // müzik HEM konuşma sidechain ile kısılıp vuruşa "pocket" açılır (aşağıda).
  // Calibrated per sound class: short bright cues need more separation than a
  // dense impact source.  This avoids a blind global SFX boost.
  const sfxVol = Math.max(1.0, config.video.transitionSoundVolume);
  const sfxGain = { impact: 1.7, shimmer: 2.35, riser: 1, whoosh: 1.8, click: 1.55 };

  // Anlatım sesini "yayın" zincirinden geçir: alçak-frekans temizliği +
  // presence EQ + kompresör. Ham TTS'ten çok daha dolgun/pro tınlar.
  const voiceChain =
    'highpass=f=70,equalizer=f=3200:t=q:w=1.2:g=1.5,' +
    'acompressor=threshold=0.12:ratio=2.5:attack=8:release=140:makeup=1.4,' +
    'aresample=44100';

  let musKey = null;        // müzik akışı (SFX bus ile ayrıca duck edilecek)
  let voiceOut = '[nmix]';  // final mikse giren konuşma (SFX ile pocket açılır)
  if (useMusic) {
    fc.push(`[0:a]${voiceChain},asplit=2[nkey][nmix]`);
    // Gerçek (mastered) parçalar sentetik yataktan çok daha sıcak basar —
    // seviyeyi ona göre düşür; prosedürel yatak config seviyesinde kalır.
    const musVol = musicIsReal ? Math.min(config.video.musicVolume, 0.32) : config.video.musicVolume;
    fc.push(
      `[${musicIdx}:a]aresample=44100,atrim=0:${total.toFixed(3)},volume=${musVol}[mus]`,
    );
    // Narrasyon konuşurken müziği HAFİFÇE kıs (önceki 8:1 oran müziği tamamen
    // susturuyordu — "müzik yok" şikayetinin sebebi buydu).
    fc.push('[mus][nkey]sidechaincompress=threshold=0.09:ratio=2.2:attack=30:release=700[musd]');
    musKey = '[musd]';
  } else {
    fc.push(`[0:a]${voiceChain}[nmix]`);
  }

  // Ambiyans: bant sınırlı (anlatımın konuşma bandını boğmasın) + çok düşük
  // seviye + yumuşak giriş. Ducking'e gerek yok — zaten fısıltı seviyesinde.
  if (ambIdx >= 0) {
    fc.push(
      `[${ambIdx}:a]aresample=44100,atrim=0:${total.toFixed(3)},` +
        `highpass=f=70,lowpass=f=7000,volume=${config.video.ambienceVolume},` +
        'afade=t=in:st=0:d=1.5[amb]',
    );
    bedMix.push('[amb]');
  }

  for (const { idx: inIdx, k } of sfxPlan) {
    const at = off[k - 1] + bts[k - 1] / 2;
    const type = sfxTypes[k - 1];
    // A riser resolves AT the cut; delaying its start to the cut made the
    // verifier inspect only its near-silent attack.  Other SFX remain centred
    // on the visual transition.
    const cueStart = type === 'riser' ? Math.max(0, at - 0.78) : at;
    const ms = Math.round(cueStart * 1000);
    const gain = sfxVol * (sfxGain[type] || 1);
    fc.push(`[${inIdx}:a]aresample=44100,adelay=${ms}|${ms},volume=${gain}[wd${k}]`);
    sfxLabels.push(`[wd${k}]`);
    sfxCues.push({ atSeconds: +cueStart.toFixed(2), durationSec: type === 'riser' ? 0.9 : undefined, sfxId: type, assetResolved: true, mixedInGraph: true });
  }

  if (chimeIdx >= 0) {
    const at = off[N - 1] + bts[N - 1] / 2;
    const ms = Math.round(at * 1000);
    fc.push(`[${chimeIdx}:a]aresample=44100,adelay=${ms}|${ms},volume=0.7[chm]`);
    sfxLabels.push('[chm]');
    sfxCues.push({ atSeconds: +at.toFixed(2), sfxId: 'chime', assetResolved: true, mixedInGraph: true });
  }

  if (clickIdx >= 0) {
    const ms = Math.round(clickAt * 1000);
    fc.push(`[${clickIdx}:a]aresample=44100,adelay=${ms}|${ms},volume=${sfxVol * sfxGain.click}[clk]`);
    sfxLabels.push('[clk]');
    sfxCues.push({ atSeconds: +clickAt.toFixed(2), sfxId: 'click', assetResolved: true, mixedInGraph: true });
  }

  // SFX bus'ı: cue anında HEM müzik HEM konuşma sidechain ile kısılır → vuruşa
  // "pocket" açılır. Böylece yoğun -14 LUFS mikste (TTS+müzik+ambiyans) SFX
  // gömülmez. Konuşma ducking'i SIĞ + HIZLI (anlaşılırlık korunur, vuruş öne çıkar).
  // sidechaincompress EN KISA girdide biter → anahtar apad ile doldurulur.
  const finalMix = [...bedMix];
  if (sfxLabels.length) {
    const sfxAll = sfxLabels.length === 1 ? sfxLabels[0] : '[sfxall]';
    if (sfxLabels.length > 1) {
      fc.push(`${sfxLabels.join('')}amix=inputs=${sfxLabels.length}:normalize=0:duration=longest[sfxall]`);
    }
    fc.push(`${sfxAll}asplit=2[sfxkey0][sfxmix]`);
    if (musKey) {
      // Start the key 100 ms before the audible cue, so music yields before
      // the transient while the picture-aligned [sfxmix] is unchanged.
      fc.push(`[sfxkey0]asetpts=PTS-0.1/TB,apad,asplit=2[sfxkeyM][sfxkeyV]`);
      // Konuşmaya sığ pocket (≈2-3 dB), müziğe daha derin dip (≈4-5 dB).
      fc.push(`${voiceOut}[sfxkeyV]sidechaincompress=threshold=0.05:ratio=2:attack=4:release=170[voiced]`);
      fc.push(`${musKey}[sfxkeyM]sidechaincompress=threshold=0.1:ratio=4:attack=4:release=240[musd2]`);
      finalMix.push('[voiced]', '[musd2]', '[sfxmix]');
    } else {
      fc.push(`[sfxkey0]asetpts=PTS-0.1/TB,apad[sfxkeyV]`);
      fc.push(`${voiceOut}[sfxkeyV]sidechaincompress=threshold=0.05:ratio=2:attack=4:release=170[voiced]`);
      finalMix.push('[voiced]', '[sfxmix]');
    }
  } else {
    finalMix.push(voiceOut);
    if (musKey) finalMix.push(musKey);
  }

  // Karışım -> kapanışta yumuşak sönüş -> YouTube standardı -14 LUFS loudness.
  const fadeStart = Math.max(0, total - 1.1).toFixed(3);
  // STEREO garanti: rapor "stereo" derken çıktı mono çıkmasın (bee hatası #8).
  const master =
    `apad,atrim=0:${total.toFixed(3)},afade=t=out:st=${fadeStart}:d=1.1,` +
    // Keep the safety limiter before loudness measurement: post-loudnorm
    // limiting was flattening the very transients the editorial gate measures.
    'alimiter=limit=0.89:attack=5:release=80,loudnorm=I=-14:TP=-1.5:LRA=11,' +
    'aresample=44100,aformat=channel_layouts=stereo';
  if (finalMix.length > 1) {
    fc.push(`${finalMix.join('')}amix=inputs=${finalMix.length}:normalize=0:duration=longest,${master}[a]`);
  } else {
    fc.push(`${finalMix[0]}${master}[a]`);
  }

  await run('ffmpeg', [
    '-y', ...inputs,
    '-filter_complex', fc.join(';'),
    '-map', '[a]', '-t', total.toFixed(3),
    '-c:a', 'aac', '-b:a', '160k', '-ac', '2',
    outPath,
  ], { maxBuffer: 20 * 1024 * 1024 });
  return { musicTrack, sfxCues, musicDecision };
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

  // KURGU PLANI: Kurgucu (orkestra) plan verdiyse dramaturjiye göre uygula;
  // yoksa mekanik kesme-geçiş-kesme ritmi. Sert kesmeler tempo verir.
  const CUT = 2 / fps;
  const trsList = config.video.transitions;
  const plan = job.editPlan;
  const planOk =
    plan && Array.isArray(plan.boundaries) && plan.boundaries.length === Math.max(0, N - 1);
  const bts = []; // sınır başına geçiş süresi (k=1..M-1)
  const btName = []; // sınır başına geçiş tipi
  let realCount = 0;
  for (let k = 1; k < M; k += 1) {
    const isOutroBoundary = useOutro && k === M - 1;
    if (planOk && !isOutroBoundary) {
      const b = plan.boundaries[k - 1];
      if (b.transition === 'cut') {
        bts.push(CUT);
        btName.push('fade');
      } else {
        bts.push(td);
        btName.push(b.transition);
      }
      continue;
    }
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

  // SFX planı (ana sınırlar, k=1..N-1): kurgucu seçtiyse onun tipi; yoksa
  // mekanik — animasyonlu sınırlara sırayla döner, sıra videodan videoya kayar.
  const sfxCycleAll = ['whoosh', 'impact', 'riser', 'shimmer'];
  const sfxTypes = [];
  {
    const shift = (N + Math.round(narrationDur)) % sfxCycleAll.length;
    let n = 0;
    for (let k = 1; k <= Math.max(0, N - 1); k += 1) {
      if (planOk) {
        const s = plan.boundaries[k - 1].sfx;
        sfxTypes.push(s && s !== 'none' ? s : null);
      } else if (bts[k - 1] >= 0.2) {
        sfxTypes.push(sfxCycleAll[(shift + n) % sfxCycleAll.length]);
        n += 1;
      } else {
        sfxTypes.push(null);
      }
    }
    // An editorial plan may intentionally leave most cuts quiet, but an
    // all-silent plan makes the final-output SFX gate impossible to satisfy
    // and leaves a real scene transition without any sonic punctuation.  This
    // is a single semantic fallback (whoosh is transition-safe), not a quota:
    // use the first actual transition only when the director selected none.
    if (planOk && !sfxTypes.some(Boolean)) {
      const firstTransition = bts.findIndex((d, i) => i < N - 1 && d >= 0.2);
      if (firstTransition >= 0) sfxTypes[firstTransition] = 'whoosh';
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

  // Animasyonlu hikâye kitabı stili: agresif kamera + canlı doku katmanı.
  const animatedStyle = job.visualStyle === 'animated';

  // 2) Ana klipleri normalize et + outro klibini üret.
  const clips = [];
  for (let i = 0; i < N; i += 1) {
    const clipPath = path.join(workDir, `clip-${String(i).padStart(2, '0')}.mp4`);
    await normalizeClip(
      media[i],
      Math.max(0.6, clipDur[i] + (M > 1 ? 0.05 : 0)),
      clipPath,
      { width, height, fps, index: i, category, animated: animatedStyle },
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
      buildAss(wordTimings, {
        width,
        height,
        hookText: hasHook ? hookText : '',
        emphasisWords: job.emphasisWords || [],
        finaleText: job.finaleText || '',
      }),
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
  // Neo Motion CTA açıkken eski ham abone-uyarısı kapanır (çift CTA olmasın);
  // job.subPrompt=false ile de zorlanabilir. Motion kapalıysa eski davranış birebir.
  const motionCtaOn = config.motion?.enabled && config.motion?.cta?.enabled;
  const subPromptWanted = job.subPrompt !== undefined ? job.subPrompt : (config.video.subPrompt && !motionCtaOn);
  const spOn = subPromptWanted && existsSync(pillPath) && total > 9;
  let pillIdx = -1;
  let likeIdx = -1;
  let T1 = 0;
  let T2 = 0;
  if (spOn) {
    // Kurgucu doğal bir "nefes anı" seçtiyse kart o sahnenin başında çıkar;
    // yoksa videonun ~%42'si (mekanik varsayılan).
    let tCand = total * 0.42;
    const subScene = plan?.subscribeScene;
    if (planOk && Number.isInteger(subScene) && subScene >= 1 && subScene < N) {
      let cum2 = 0;
      let btSum2 = 0;
      for (let i = 0; i < subScene; i += 1) {
        cum2 += clipDur[i];
        btSum2 += bts[i];
      }
      tCand = cum2 - btSum2 + 0.35;
    }
    T1 = Math.min(Math.max(tCand, 3.5), Math.max(3.5, total - 4.8));
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

  // Işık vuruşu: gerçek geçiş anlarında ~4 karelik parlama ("flash cut") —
  // pro kurgunun enerji hilesi; sadece animasyonlu sınırlarda, en fazla 4 kez.
  {
    const flashes = [];
    let cum = 0;
    let btSum = 0;
    for (let k = 1; k < M && flashes.length < 4; k += 1) {
      cum += clipDur[k - 1];
      btSum += bts[k - 1];
      if (k <= N - 1 && bts[k - 1] >= 0.2) {
        const T = cum - btSum + bts[k - 1] * 0.35;
        flashes.push(
          `eq=brightness=0.15:saturation=1.05:enable='between(t,${T.toFixed(2)},${(T + 0.13).toFixed(2)})'`,
        );
      }
    }
    if (flashes.length) {
      vfc.push(`${vbase}${flashes.join(',')}[vfl]`);
      vbase = '[vfl]';
    }
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

  // Animasyonlu stil: canlı doku katmanı (toz + ışık) — altyazının ALTINA.
  let fxFilter = '';
  const fontsDir = path.resolve(config.video.fontsDir);

  if (animatedStyle) {
    await writeFile(
      path.join(workDir, 'fx.ass'),
      buildFxAss(total, { width, height, seed: Math.round(total * 131) + N }),
    );
    fxFilter = 'ass=fx.ass,';
  }

  // Ok+etiket katmanı KALDIRILDI: "WATCH THIS / HERE IT COMES" + sarı ok
  // rastgele/anlamsız noktaları gösteriyordu, dikkat çekmek yerine kafa
  // karıştırıyordu (kullanıcı geri bildirimi). Artık hiç çizilmiyor.
  const annoFilter = '';

  // Altyazı + hook (aynı ASS dosyasında; hook otomatik satır kaydırır, sığar).
  const assFilter = existsSync(fontsDir) ? `ass=subs.ass:fontsdir=${fontsDir}` : 'ass=subs.ass';
  // Hafif keskinleştirme (altyazıdan ÖNCE — yazı kenarları temiz kalsın):
  // telefonda sıkıştırma sonrası algılanan netliği belirgin artırır.
  // Katman sırası: [fx altta] -> keskinleştir -> [altyazı] -> [ok/etiket en üstte].
  if (useAss) {
    vfc.push(`${last}${fxFilter}unsharp=5:5:0.35:3:3:0,${assFilter}${annoFilter}[v]`);
  } else {
    vfc.push(`${last}${fxFilter}unsharp=5:5:0.35:3:3:0${annoFilter}[v]`);
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
  const audioInfo = await buildFullAudio(
    {
      workDir,
      narrationPath: path.resolve(audioPath),
      total, clipDur, bts, N, M, useOutro,
      // Ses yönetmeni müzik ruhu seçtiyse o; yoksa konu kategorisi.
      category: job.musicMood || category,
      sfxTypes,
      // Sahne ambiyansı (Freesound'dan indirilmiş yerel dosya; yoksa katman yok).
      ambiencePath: job.ambiencePath || null,
      // Abone kartı otururken tık sesi (giriş animasyonunun bitişiyle senkron).
      clickAt: spOn ? T1 + 0.4 : null,
      // Son videolarda kullanılan müzikler (tekrar önleme; run.js state'ten geçirir).
      avoidMusic: job.avoidMusic || [],
      // Deterministik müzik seed'i (aynı video → aynı parça; farklı → çeşitli).
      musicSeed: job.musicSeed || '',
    },
    path.resolve(fulla),
  );

  // 6) MUX: video + ses.
  await run('ffmpeg', [
    '-y', '-i', path.resolve(fullv), '-i', path.resolve(fulla),
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ac', '2',
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
    // Kullanılan müzik (lisans künyesi report/record'a yazılır; null = prosedürel).
    musicTrack: audioInfo?.musicTrack || null,
    // Müzik seçim kararı (çeşitlilik + sert kapı için: poolExhausted vb.).
    musicDecision: audioInfo?.musicDecision || null,
    // Filtre grafiğine GERÇEKTEN giren SFX cue'ları (adı planda geçmesi değil,
    // fiilen miks edildiği) — render sonrası çıktı doğrulaması bunları ölçer.
    sfxCues: audioInfo?.sfxCues || [],
  };
}
