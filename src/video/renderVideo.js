import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { buildOutro } from './outro.js';
import { groupCaptionWords, layoutGroup } from './captionLayout.js';
import { makeMusicBed } from '../audio/makeMusic.js';
import { normalizeSfxPlan } from '../audio/sfxPlan.js';
import { selectMusic } from '../audio/musicSelect.js';
import { selectSceneMotion, validateMotionPlan } from './motionPlan.js';
import { directSemantics } from '../visual/semanticDirector.js';
import { buildSemanticAss } from '../visual/semanticShots.js';
import { planActors, FOCUS_TEMPLATES } from '../visual/beatToActors.js';
import { buildActorAss } from '../visual/actors.js';
import { detectFocus } from '../visual/focusDetect.js';
import { planSemanticSfx, describeSfxPlan } from '../audio/semanticSfx.js';

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
  const normWord = (w) => String(w).toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]/gu, '');
  const emphSet = new Set(emphasisWords.map(normWord).filter(Boolean));
  const isEmph = (w) =>
    config.video.emphasis && (/\d/.test(w) || emphSet.has(normWord(w)));

  const marginH = 90;
  const usableW = width - 2 * marginH;
  const charFactor = 0.56; // Montserrat SemiBold karışık harf yaklaşık genişlik oranı

  // Normal altyazı: SemiBold, alt-orta, beyaz. Okunabilirlik için GÜÇLÜ
  // kenarlık (2.6) + belirgin gölge (2.6) — küçük/düşük kontrast şikâyeti
  // sonrası artırıldı; her zeminde net, banda gerek kalmadan okunur.
  // captionBox açıkken BorderStyle 3 = metin arkasında yarı saydam koyu kutu
  // (blur/box zemin) → en karmaşık görüntüde bile altyazı net okunur. Kutu rengi
  // hem OutlineColour hem BackColour'a verilir; geniş Outline metne dolgu (padding)
  // bırakır. Kapalıyken eski güçlü kenarlık+gölge stiline düşer (geriye dönük uyum).
  const capStyle = config.video.captionBox
    ? `Style: Cap,Montserrat SemiBold,${size},&H00FFFFFF,${config.video.captionBoxColor},${config.video.captionBoxColor},` +
      `0,3,18,0,2,${marginH},${marginH},${marginV},1`
    : `Style: Cap,Montserrat SemiBold,${size},&H00FFFFFF,&H00000000,&HB4000000,` +
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
    // DİKKAT ÇEKEN HOOK: beyaz metin + kalın koyu kenarlık (her arka planda
    // okunur) + MARKA TURKUAZ neon parıltısı (renkli gölge \4c). Eski düz
    // siyah-beyaz kutu cansız duruyordu (kullanıcı geri bildirimi). Accent BGR:
    // 3BD0C8 → C8D03B. BorderStyle 1 (kutu değil), kalın kenarlık okunurluğu tutar.
    const hookAccentBGR = 'C8D03B'; // config.motion.style.accent (3BD0C8) BGR
    const hStyle =
      `Style: Hook,Montserrat Black,${hfs},&H00FFFFFF,&H00121212,&H00${hookAccentBGR},` +
      `1,1,6,4,8,${marginH},${marginH},360,1`;
    styleLines.push(hStyle);
    const cx = Math.round(width / 2);
    // Giriş: alttan süzülme + blur çözülme + %88→%100 pop, sonra hafif nabız
    // (turkuaz parıltı canlı dursun). Renkli gölge (\4c accent) + \blur = neon hâle.
    events.push(
      `Dialogue: 1,0:00:00.00,${assTime(hookDuration)},Hook,,0,0,0,,` +
        `{\\b1\\4c&H00${hookAccentBGR}&\\shad4\\blur7\\fad(140,340)\\move(${cx},322,${cx},384,0,460)` +
        `\\t(0,460,\\blur3)\\fscx88\\fscy88\\t(0,300,\\fscx104\\fscy104)\\t(300,460,\\fscx100\\fscy100)` +
        `\\t(700,1100,\\blur5)\\t(1100,1500,\\blur3)}${hk}`,
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
    // Vurgu kelimeleri BÜYÜK HARF + kalın (captionUppercaseEmphasis): sayılar ve
    // şok kelimeleri gözden kaçmasın. Normal akış küçük harf kalır (premium his).
    const doUpper = uppercase || (ev.isEmph && config.video.captionUppercaseEmphasis);
    const text = assEscape(doUpper ? ev.text.toUpperCase() : ev.text);
    if (config.video.captionKaraoke && ev.words.length > 1) {
      // KARAOKE: o an konuşulan kelime büyür + vurgu rengine döner (aktif kelime
      // takibi, TikTok/Reels tarzı). Her kelime için ayrı Dialogue; tüm satır
      // görünür kalır, yalnız aktif kelime öne çıkar. \r stili sıfırlar, sonra
      // taban fontuna geri döneriz.
      const big = Math.round(ev.fontSize * config.video.captionKaraokeScale);
      const accent = config.video.accentColor;
      for (let wi = 0; wi < ev.words.length; wi += 1) {
        const wStart = ev.words[wi].start;
        const wEnd = wi + 1 < ev.words.length ? ev.words[wi + 1].start : end;
        const parts = ev.words.map((w, k) => {
          const t = assEscape(doUpper ? String(w.word).toUpperCase() : w.word);
          if (k === wi) return `{\\fs${big}\\c${accent}\\b1}${t}{\\r\\fs${ev.fontSize}}`;
          // SATIR İÇİ VURGU: kelime cümleden KOPARILMADAN öne çıkar. Boyut
          // değişmez (satır zıplamasın), yalnızca kalın + marka rengi.
          if (isEmph(w.word)) return `{\\c${accent}\\b1}${t}{\\r\\fs${ev.fontSize}}`;
          return t;
        });
        const fadeIn = wi === 0 ? '\\fad(120,0)' : '';
        events.push(
          `Dialogue: 0,${assTime(wStart)},${assTime(Math.max(wStart + 0.05, wEnd))},Cap,,0,0,0,,` +
            `{\\fs${ev.fontSize}${fadeIn}\\blur1.2}${parts.join(' ')}`,
        );
      }
    } else {
      // Karaoke kapalıyken de vurgu satır içi verilir (ayrı olay YOK).
      const inline = ev.words.map((w) => {
        const t = assEscape(doUpper ? String(w.word).toUpperCase() : w.word);
        return isEmph(w.word) ? `{\\c${config.video.accentColor}\\b1}${t}{\\r\\fs${ev.fontSize}}` : t;
      }).join(' ');
      events.push(
        `Dialogue: 0,${assTime(start)},${assTime(end)},Cap,,0,0,0,,{\\fs${ev.fontSize}\\fad(120,90)\\blur1.2}${inline}`,
      );
      void text;
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
async function normalizeClip(item, duration, outPath, { width, height, fps, index = 0, category = '', motion = null }) {
  // Supersample çözünürlüğü (Ken Burns zoom'unda titremeyi azaltır).
  const sw = width * 2;
  const sh = height * 2;
  const frames = Math.max(1, Math.round(duration * fps));

  const motionType = motion?.type || 'slow-push-in';
  const zMax = Math.min(1.15, Math.max(1, motion?.maxZoom || 1.10));
  const inc = ((zMax - 1) / frames).toFixed(6);
  const pull = motionType === 'slow-pull-out';
  const zExpr = motionType === 'static-hold' ? '1' : pull ? `max(${zMax.toFixed(3)}-${inc}*on,1)` : `min(1+${inc}*on,${zMax.toFixed(3)})`;
  const xExpr = motionType === 'pan-left-to-right'
    ? `(iw-iw/zoom)*on/${frames}`
    : motionType === 'pan-right-to-left' ? `(iw-iw/zoom)*(1-on/${frames})` : '(iw-iw/zoom)/2';
  const yExpr = motionType === 'top-to-bottom-reveal' ? `(ih-ih/zoom)*on/${frames}` : '(ih-ih/zoom)/2';

  const vf = [
    // Kategoriye uygun sinematik grade (tarih=sıcak, uzay=soğuk...).
    gradeFor(category),
    `scale=${sw}:${sh}:force_original_aspect_ratio=increase`,
    `crop=${sw}:${sh}`,
    'setsar=1',
    ...((item.type === 'video' || motionType === 'native-motion') ? [] : [`zoompan=z='${zExpr}':d=1:x='${xExpr}':y='${yExpr}':s=${sw}x${sh}:fps=${fps}`]),
    `scale=${width}:${height}`,
    `fps=${fps}`,
    // Hafif film greni: AI/stok görüntünün steril temizliğini kırar.
    // Dinamik film greni: kategoriye göre yoğunluk (history:7, mystery:6, space:3, science:4, nature:5, default:5)
    ...(config.video.grain ? [`noise=alls=${(() => { const map = { history:7, mystery:6, space:3, science:4, nature:5 }; return map[String(category||'').toLowerCase()] || 5; })()}:allf=t`] : []),
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

/**
 * SFX HAVUZU (kullanıcı-sağlanan telifsiz dosyalar) — sentezden ÖNCE denenir.
 * assets/sfx/<tip>/ içinde .wav/.mp3/... varsa deterministik-rastgele biri seçilir
 * (aynı video→aynı ses, farklı video→çeşitlenir) ve outPath'e 44.1kHz mono WAV
 * olarak normalize edilir. Klasör boş/yoksa false → sentez fallback devreye girer.
 * Böylece "hep aynı geçiş sesi" biter; dosya eklemek yeter, kod değişmez.
 * SFX_POOL_DIR ile kök klasör değiştirilebilir.
 * @returns {Promise<boolean>} havuzdan gerçek dosya kullanıldıysa true
 */
async function resolveSfxAsset(type, outPath, seed) {
  const poolRoot = process.env.SFX_POOL_DIR || 'assets/sfx';
  const dir = path.join(poolRoot, String(type || ''));
  if (!type || !existsSync(dir)) return false;
  let files;
  try {
    files = readdirSync(dir).filter((f) => /\.(wav|mp3|ogg|m4a|aac|flac)$/i.test(f)).sort();
  } catch { return false; }
  if (!files.length) return false;
  // Deterministik seçim (FNV-1a): aynı seed → aynı parça, tekrar render tutarlı.
  let h = 2166136261;
  const s = String(seed);
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  const pick = files[(h >>> 0) % files.length];
  try {
    // Mono + 44.1kHz + hafif tepe sınırlama → mix'e tutarlı girsin.
    await run('ffmpeg', ['-y', '-v', 'error', '-i', path.resolve(path.join(dir, pick)),
      '-ac', '1', '-ar', '44100', '-af', 'alimiter=limit=0.95', outPath], { maxBuffer: 12 * 1024 * 1024 });
    return true;
  } catch { return false; }
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
        'aecho=0.5:0.3:35:0.3,volume=1.3',
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
    avoidMusic = [], musicSeed = '', hookSfx = null,
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
  const sfxPlan = []; // { idx, k, type, at }
  if (sfx) {
    for (let k = 1; k <= Math.max(0, N - 1); k += 1) {
      const type = sfxTypes[k - 1];
      if (!type) continue;
      const f = path.join(workDir, `sfx-${k}.wav`);
      // Önce kullanıcı havuzu (assets/sfx/<tip>/), yoksa sentez.
      const fromPool = await resolveSfxAsset(type, f, `${musicSeed}:${type}:${k}`);
      if (!fromPool) await makeSfx(type, f);
      inputs.push('-i', path.resolve(f));
      const boundary = off[k - 1];
      const at = type === 'riser' ? Math.max(0, boundary - 0.75) : boundary;
      sfxPlan.push({ idx, k, type, at });
      idx += 1;
    }
    if (hookSfx) {
      const f = path.join(workDir, 'sfx-hook.wav');
      const fromPool = await resolveSfxAsset(hookSfx, f, `${musicSeed}:hook:${hookSfx}`);
      if (!fromPool) await makeSfx(hookSfx, f);
      inputs.push('-i', path.resolve(f));
      sfxPlan.push({ idx, k: 'hook', type: hookSfx, at: 0.12 });
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
  const sfxVol = Math.max(1.4, config.video.transitionSoundVolume);

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
    // DİNAMİK DUCKING (dB tabanlı): müziğin TABAN seviyesi "konuşma yok" hedefi
    // (-12dB); narrasyon konuşurken sidechain ile "konuşma var" hedefine (-18dB)
    // düşer. Böylece intro/outro/nefes anlarında müzik dolgun, konuşma sırasında
    // geri çekilip anlaşılırlığı korur. dB → lineer: 10^(dB/20).
    const dbToLin = (db) => Math.pow(10, db / 20);
    const silenceLin = dbToLin(config.video.musicDuckSilenceDb);   // -12dB ≈ 0.251 (taban)
    // Konuşurken hedef ≈ config.video.musicDuckSpeakingDb (-18dB ≈ 0.126 lineer).
    // Konuşma sırasında hedeflenen bastırma (dB) → sidechain ratio yaklaşımı.
    const duckDb = Math.max(0, config.video.musicDuckSilenceDb - config.video.musicDuckSpeakingDb);
    // Gerçek (mastered) parçalar sentetik yataktan sıcak basar; taban seviyeyi
    // yine de "konuşma yok" hedefinin üstüne çıkarma.
    const musBaseLin = musicIsReal
      ? Math.min(silenceLin, dbToLin(config.video.musicDuckSilenceDb - 2))
      : silenceLin;
    fc.push(
      `[${musicIdx}:a]aresample=44100,atrim=0:${total.toFixed(3)},volume=${musBaseLin.toFixed(3)}[mus]`,
    );
    // Sidechaincompress konuşma anahtarıyla müziği ~duckDb kadar kıs (taban
    // -12dB → konuşurken ≈ -18dB). ratio duckDb hedefine göre ölçekli.
    const duckRatio = Math.max(2, Math.min(8, 1 + duckDb / 2)).toFixed(1);
    fc.push(`[mus][nkey]sidechaincompress=threshold=0.06:ratio=${duckRatio}:attack=25:release=500[musd]`);
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

  for (const { idx: inIdx, k, type, at } of sfxPlan) {
    const ms = Math.round(at * 1000);
    fc.push(
      `[${inIdx}:a]aresample=44100,adelay=${ms}|${ms},volume=${k === 'hook' ? Math.min(sfxVol, 1.0) : sfxVol}[wd${k}]`,
    );
    sfxLabels.push(`[wd${k}]`);
    sfxCues.push({ atSeconds: +at.toFixed(2), sfxId: type, event: k === 'hook' ? 'hook' : 'scene-boundary', assetResolved: true, mixedInGraph: true });
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
    fc.push(`[${clickIdx}:a]aresample=44100,adelay=${ms}|${ms},volume=1.0[clk]`);
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
      fc.push(`[sfxkey0]apad,asplit=2[sfxkeyM][sfxkeyV]`);
      // Konuşmaya sığ pocket (≈2-3 dB), müziğe daha derin dip (≈4-5 dB).
      fc.push(`${voiceOut}[sfxkeyV]sidechaincompress=threshold=0.05:ratio=2:attack=4:release=170[voiced]`);
      fc.push(`${musKey}[sfxkeyM]sidechaincompress=threshold=0.1:ratio=4:attack=4:release=240[musd2]`);
      finalMix.push('[voiced]', '[musd2]', '[sfxmix]');
    } else {
      fc.push(`[sfxkey0]apad[sfxkeyV]`);
      fc.push(`${voiceOut}[sfxkeyV]sidechaincompress=threshold=0.05:ratio=2:attack=4:release=170[voiced]`);
      finalMix.push('[voiced]', '[sfxmix]');
    }
  } else {
    finalMix.push(voiceOut);
    if (musKey) finalMix.push(musKey);
  }

  // Karışım -> intro fade-in + kapanışta yumuşak sönüş -> -14 LUFS loudness.
  // Intro/outro fade süresi config'ten (0.5s): sert giriş/çıkış yok. Fade-in
  // ilk konuşmadan (~0.9s) önce biter, hook kelimesini kesmez.
  const fadeDur = Math.max(0.1, config.video.audioFadeSeconds);
  const fadeStart = Math.max(0, total - fadeDur).toFixed(3);
  // STEREO garanti: rapor "stereo" derken çıktı mono çıkmasın (bee hatası #8).
  const master =
    `apad,atrim=0:${total.toFixed(3)},` +
    `afade=t=in:st=0:d=${fadeDur.toFixed(2)},afade=t=out:st=${fadeStart}:d=${fadeDur.toFixed(2)},` +
    'loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100,aformat=channel_layouts=stereo';
  if (finalMix.length > 1) {
    fc.push(`${finalMix.join('')}amix=inputs=${finalMix.length}:normalize=0:duration=longest,${master}[a]`);
  } else {
    fc.push(`${finalMix[0]}${master}[a]`);
  }

  await run('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', '-nostats', ...inputs,
    '-filter_complex', fc.join(';'),
    '-map', '[a]', '-t', total.toFixed(3),
    '-c:a', 'aac', '-b:a', config.video.audioBitrate, '-ac', '2',
    outPath,
  ], { maxBuffer: 128 * 1024 * 1024 });
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
    // KESME ÇOĞUNLUKTA: eskiden sınırların YARISI (k % 2) animasyonluydu ve
    // video sürekli eriyordu. Artık yalnızca her 3. sınır yumuşak geçiş alır
    // (outro hariç) → çoğu sınır sert kesme, tempo kurguya benzer.
    const real = isOutroBoundary || k % 3 === 0;
    if (real) {
      bts.push(td);
      btName.push(trsList[realCount % trsList.length] || 'fade');
      realCount += 1;
    } else {
      bts.push(CUT);
      btName.push('fade');
    }
  }

  // SFX adayları (ana sınırlar, k=1..N-1): kurgucu seçtiyse onun tipi; yoksa
  // mekanik — animasyonlu sınırlara sırayla döner, sıra videodan videoya kayar.
  // ANLAMLI SES: artık sınıra ne düştüğüne değil, o sınırda BAŞLAYAN sahnenin
  // NE ANLATTIĞINA bakılır. Eski mekanik döngü (whoosh→impact→riser→shimmer)
  // sesi ekranla ilgisiz yerlere basıyordu; canlıda "alakasız" bulundu.
  // Anlatım bir sesi hak etmiyorsa o sınır SESSİZ kalır (kota/dolgu yok).
  let sfxTypes = [];
  {
    // Sınır zamanları ve sahne metinleri kanonik zaman çizelgesinden gelir.
    const tlItems = Array.isArray(job.timeline?.items) ? job.timeline.items : [];
    const boundaryTimes = [];
    // Sınırda BAŞLAYAN sahnenin anlatımı (ses geleni duyurur, gideni değil).
    const sfxScenes = [];
    for (let k = 0; k < N; k += 1) {
      const it = tlItems[k];
      sfxScenes.push({ narration: job.scenes?.[it?.scene]?.narration || '' });
      if (k < N - 1) boundaryTimes.push(Number.isFinite(it?.end) ? it.end : null);
    }
    const editorPlan = planOk
      ? plan.boundaries.slice(0, Math.max(0, N - 1)).map((b) => b.sfx || 'none')
      : null;
    sfxTypes = planSemanticSfx(sfxScenes, boundaryTimes, {
      maxCues: config.video.maxSfxPerVideo,
      minGapSeconds: config.video.minSfxGapSeconds,
      editorPlan,
    });
    const summary = describeSfxPlan(sfxTypes);
    console.log(`[sfx] anlamlı plan: ${summary.count} ses (${
      Object.entries(summary.types).map(([t, c]) => `${t}:${c}`).join(' ') || 'yok'})`);
  }
  const mainBts = bts.slice(0, Math.max(0, N - 1));
  const mainTdSum = mainBts.reduce((a, b) => a + b, 0);

  // Canonical item spans are the single edit authority. Each xfade input owns
  // its visible span plus its outgoing overlap, so cut offsets equal canonical
  // boundaries exactly. Legacy weights remain fallback-only.
  const canonicalItems = Array.isArray(job.timeline?.items) && job.timeline.items.length === N
    ? job.timeline.items : null;
  const span = narrationDur + mainTdSum;
  const weights =
    Array.isArray(job.sceneWeights) && job.sceneWeights.length === N
      ? job.sceneWeights
      : null;
  let mainDurs;
  if (canonicalItems) {
    mainDurs = canonicalItems.map((item, i) => Math.max(0.6, item.duration + (mainBts[i] || 0)));
  } else if (weights) {
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
  // Director planı tek bir efekt seçse bile 35-58 saniyelik videoda hook,
  // reveal ve payoff işitilebilir şekilde noktalanmalı. Zamanlar gerçek render
  // sınırlarından hesaplanır; aynı anda efekt yığılmaz.
  const boundaryTimes = [];
  let boundaryCursor = 0;
  for (let i = 0; i < N - 1; i += 1) {
    boundaryCursor += clipDur[i] - bts[i];
    boundaryTimes.push(boundaryCursor);
  }
  if (config.video.sfx) {
    sfxTypes = normalizeSfxPlan(sfxTypes, boundaryTimes, {
      minCues: config.video.minSfxPerVideo,
      maxCues: config.video.maxSfxPerVideo,
      minGapSeconds: config.video.minSfxGapSeconds,
    });
  }
  const animatedStyle = job.visualStyle === 'animated';

  const motionPlan = [];
  const priorMotions = [];
  for (let i = 0; i < N; i += 1) {
    const sceneIndex = canonicalItems?.[i]?.scene ?? job.mediaScene?.[i] ?? i;
    const selected = selectSceneMotion(job.scenes?.[sceneIndex] || {}, media[i], { previous: priorMotions, index: i });
    const rec = { ...selected, duration: canonicalItems?.[i]?.duration ?? mainDurs[i] - (mainBts[i] || 0), scene: sceneIndex };
    motionPlan.push(rec);
    priorMotions.push(selected.type);
  }
  const motionIssues = validateMotionPlan(motionPlan, motionPlan.map((m) => m.duration));

  // 2) Ana klipleri normalize et + outro klibini üret.
  const clips = [];
  for (let i = 0; i < N; i += 1) {
    const clipPath = path.join(workDir, `clip-${String(i).padStart(2, '0')}.mp4`);
    await normalizeClip(
      media[i],
      Math.max(0.6, clipDur[i] + (M > 1 ? 0.05 : 0)),
      clipPath,
      { width, height, fps, index: i, category, motion: motionPlan[i] },
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

  // SEMANTİK GÖRSEL ANLATIM (V3): anlatım cümlesinin YAPISINI çıkarıp ekranda
  // gerçekleştirir (süreç→adım+ok, karşılaştırma→split, sayı→sayaç+ölçek,
  // konum→harita, davranış→yön izi). Yapı yoksa hiçbir şey basılmaz — eski V2
  // dekoratif oval/etiket katmanı bu yüzden kaldırıldı. Altyazı safe-area'sına
  // girmez; hata olursa render eski davranışa döner (üretim kırılmaz).
  let effectsFilter = '';
  let semanticBeatsUsed = [];
  let actorStatsUsed = null;
  // Bildirim bayrakları (renderPlan.overlayLayers bunlardan kurulur).
  let actorAssWritten = false;
  let cardAssWritten = false;
  const actorsBySceneUsed = {};
  const sceneFocusUsed = {};
  const semCfg = config.motion?.semanticVisuals;
  if (semCfg?.enabled && canonicalItems && Array.isArray(job.scenes)) {
    try {
      const vtl = canonicalItems.map((it, i) => ({
        narration: job.scenes[it.scene]?.narration || '',
        index: i, start: it.start, end: it.end, part: media[i]?.part,
      }));
      // V3 Faz 2: hikâye planı ÖNCEDEN yapıldıysa (storyPlanner) onu kullan —
      // renderVideo cümleyi yeniden sınıflandırmasın. Plan yoksa (eski akış,
      // doğrudan renderVideo çağrısı) eskisi gibi burada çözümlenir.
      // TEK SAHNE = TEK KOREOGRAFİ. Mikro plan merdiveni (Faz 4) bir sahneyi
      // 2-3 kadraja bölüyor; her kadraja aynı beat'i vermek aynı izi/halkayı
      // arka arkaya üç kez çizerdi (aksaklık gibi okunur). Beat sahnenin İLK
      // kadrajına bağlanır, diğer kadrajlar saf kamera olarak kalır.
      const seenScene = new Set();
      const planned = vtl
        .map((it, i) => {
          const sceneIdx = canonicalItems[i]?.scene;
          const sc = job.scenes?.[sceneIdx];
          if (!sc?.story_beat) return null;
          if (seenScene.has(sceneIdx)) return null;
          seenScene.add(sceneIdx);
          return { ...sc.story_beat, index: i, scene: sceneIdx, start: it.start, end: it.end };
        })
        .filter(Boolean);
      let beats = planned.length
        ? planned
        : directSemantics(vtl).beats;
      if (planned.length) {
        console.log(`[visual] hikâye planı kullanıldı: ${planned.length} beat (yeniden sınıflandırma yok).`);
      }

      // ÇAKIŞMA KORUMASI: sahne zaten bir GFX kartıysa (sayı kartı / adım
      // kartı) o klip KENDİ sayacını ve grafiğini içerir. Üstüne bir de
      // semantik kompozisyon binince canlıda İKİ SAYAÇ üst üste sayıyordu
      // ("71/125", "160/250" iç içe — 26 Tem, 0:18). Gfx sahnesi semantik
      // katmandan muaftır: kart zaten bilgiyi gösteriyor.
      const gfxScenes = new Set(
        (media || []).map((m, i) => (m?.gfx ? i : -1)).filter((i) => i >= 0),
      );
      if (gfxScenes.size) {
        const before = beats.length;
        beats = beats.filter((b) => !gfxScenes.has(b.index));
        if (beats.length !== before) {
          console.log(`[visual] ${before - beats.length} kompozisyon atlandı (sahnede zaten gfx kartı var).`);
        }
      }

      // Kalabalık olmasın: en bilgilendirici tipleri koru, üst sınırı uygula.
      // Aktöre çevrilebilen beat'ler kadrajın İÇİNDE yaşar; kart gibi ekranı
      // kaplamazlar. Bu yüzden üst sınır aktörler için daha geniştir ve
      // sıralamada önce onlar korunur (kesilen ilk şey kart olsun).
      const actorable = (b) => b.kind === 'behavior' || b.kind === 'process'
        || b.kind === 'number' || FOCUS_TEMPLATES.has(b.template) || b.template === 'timeline';
      const max = Math.max(1, semCfg.maxPerVideo || 6);
      const actorMax = Math.max(max, semCfg.maxActorsPerVideo || 9);
      if (beats.length > actorMax) {
        const rank = { process: 0, number: 1, compare: 2, location: 3, behavior: 4 };
        beats = [...beats]
          .sort((a, b) => (actorable(b) ? 1 : 0) - (actorable(a) ? 1 : 0)
            || (rank[a.kind] ?? 5) - (rank[b.kind] ?? 5) || a.start - b.start)
          .slice(0, actorMax)
          .sort((a, b) => a.start - b.start);
      }
      // NOT: kart sınırı BURADA uygulanamaz. Bir beat'in aktöre dönüşüp
      // dönüşmeyeceği ancak odak ölçümünden SONRA belli olur; burada "aktör
      // olacak" diye geçirdiğimiz beat, ölçüm tutmazsa karta düşüyordu.
      // Canlıda sonuç 7 karttı (26 Tem, deniz hıyarı). Sınır artık
      // planActors'tan SONRA, gerçek kart listesine uygulanıyor.
      // ODAK: "davranış" kompozisyonu görüntüdeki özneyi DAİRE İÇİNE alır.
      // Daireyi ancak konumu ÖLÇÜLDÜYSE çiziyoruz — focusDetect emin değilse
      // (her yeri eşit dokulu kare gibi) null döner ve daire hiç çizilmez.
      // Rastgele konuma daire çizmek düzeltilen asıl hataydı.
      if (semCfg.focusHighlight !== false) {
        for (const b of beats) {
          // Konum gerektiren HER şablon ölçülür (Faz 3d): davranışın yanı sıra
          // sinyal/yayılma/rota/arama şablonları da gerçek bir konuma dayanmak
          // zorunda. Ölçüm yoksa o sahnede aktör hiç üretilmez.
          if (b.kind !== 'behavior' && !FOCUS_TEMPLATES.has(b.template)) continue;
          const src = media[b.index]?.path;
          if (!src) continue;
          const focus = await detectFocus(src).catch(() => null);
          if (focus) {
            b.focus = focus;
            if (Number.isFinite(b.scene)) sceneFocusUsed[b.scene] = focus;
            console.log(`[visual] sahne ${b.index + 1}: odak (${focus.x}, ${focus.y}) güven ${focus.confidence}`);
          } else {
            console.log(`[visual] sahne ${b.index + 1}: odak belirsiz — daire çizilmedi.`);
          }
        }
      }

      // V3: önce AKTÖR koreografisi (kadrajın İÇİNDE durum değiştiren
      // elemanlar), aktöre çevrilemeyen beat'ler eski kart yoluna düşer.
      const { actors, cardBeats: allCardBeats, stats: actorStats } = planActors(beats);
      // Sahne → aktör eşlemesi (denetim için): hangi sahnede NE çizildi.
      for (const b of beats) {
        if (!Number.isFinite(b.scene)) continue;
        const made = planActors([b]).actors;
        if (made.length) actorsBySceneUsed[b.scene] = made;
      }
      // KART TAVANI (aktör planından sonra, gerçek listeye). Kart kadrajın
      // ÜSTÜNDE durur; sayısı arttıkça video "kart gösterisi"ne döner.
      // En bilgilendirici tipler önce: sayı ve karşılaştırma bir kartla
      // gerçekten anlatılır, konum/davranış çoğu zaman anlatılmaz.
      const cardRank = { number: 0, compare: 1, process: 2, location: 3 };
      const cardBeats = [...allCardBeats]
        .sort((a, b) => (cardRank[a.kind] ?? 9) - (cardRank[b.kind] ?? 9) || a.start - b.start)
        .slice(0, max)
        .sort((a, b) => a.start - b.start);
      if (allCardBeats.length > cardBeats.length) {
        console.log(`[visual] ${allCardBeats.length - cardBeats.length} kart atlandı (tavan ${max}).`);
      }
      const filters = [];

      const actorAss = buildActorAss(actors, { width, height });
      if (actorAss) {
        actorAssWritten = true;
        await writeFile(path.join(workDir, 'actors.ass'), actorAss);
        filters.push(existsSync(fontsDir) ? `ass=actors.ass:fontsdir=${fontsDir}` : 'ass=actors.ass');
        console.log(`[visual] AKTÖR koreografisi: ${actors.length} aktör / ` +
          `${actorStats.actorScenes} sahne — ${Object.entries(actorStats.byActor)
            .map(([k, v]) => `${k}:${v}`).join(' ')}`);
      }

      const ass = buildSemanticAss(cardBeats, { width, height, cfg: semCfg });
      if (ass) {
        cardAssWritten = true;
        await writeFile(path.join(workDir, 'semantic.ass'), ass);
        filters.push(existsSync(fontsDir) ? `ass=semantic.ass:fontsdir=${fontsDir}` : 'ass=semantic.ass');
        console.log(`[visual] kart katmanı: ${cardBeats.length} kompozisyon (${
          cardBeats.map((b) => b.kind).join(', ')})`);
      }

      if (filters.length) {
        effectsFilter = filters.join(',');
        semanticBeatsUsed = beats.map((b) => ({ kind: b.kind, index: b.index, start: b.start }));
        actorStatsUsed = actorStats;
      } else {
        console.log('[visual] gösterilecek yapı yok — ekran temiz bırakıldı.');
      }
    } catch (err) {
      console.warn(`[visual] semantik katman atlandı: ${String(err.message).slice(0, 90)}`);
    }
  }

  // Hafif keskinleştirme (altyazıdan ÖNCE — yazı kenarları temiz kalsın).
  // Katman sırası: [fx altta] -> keskinleştir -> [görsel efektler] -> [altyazı üstte].
  const post = ['unsharp=5:5:0.35:3:3:0'];
  // LİSTE NUMARALARI — "5 facts" vaadinin ekrandaki karşılığı. Küçük, üst
  // güvenli alanda, ekranı kaplamaz. Canlıda video "5 incredible facts" diye
  // açılıyor ama tek bir numara görünmüyordu.
  const listMarkers = [];
  if (canonicalItems && Array.isArray(job.scenes)) {
    const shownFor = new Set();
    canonicalItems.forEach((it, i) => {
      const sceneIdx = it?.scene ?? job.mediaScene?.[i];
      const n = job.scenes?.[sceneIdx]?.list_index;
      if (!Number.isFinite(n) || shownFor.has(n)) return;
      shownFor.add(n);
      listMarkers.push({ n, start: it.start, end: Math.min(it.end, it.start + 1.6) });
    });
  }
  if (listMarkers.length) {
    const head = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\n` +
      'ScaledBorderAndShadow: yes\nWrapStyle: 2\n\n[V4+ Styles]\n' +
      'Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n' +
      `Style: ListNo,Montserrat Black,64,&H00FFFFFF,&H00121212,&H64000000,1,0,0,0,100,100,0,0,1,4,2,7,72,72,0,1\n\n` +
      '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
    const evs = listMarkers.map((m) => (
      `Dialogue: 3,${assTime(m.start)},${assTime(m.end)},ListNo,,0,0,0,,` +
      `{\\an7\\pos(72,470)\\fad(160,220)\\fscx86\\fscy86\\t(0,220,\\fscx100\\fscy100)}${m.n}`
    ));
    await writeFile(path.join(workDir, 'list.ass'), head + evs.join('\n') + '\n');
    post.push(existsSync(fontsDir) ? `ass=list.ass:fontsdir=${fontsDir}` : 'ass=list.ass');
    console.log(`[visual] liste numaraları: ${listMarkers.map((m) => m.n).join(', ')}`);
  }
  if (effectsFilter) post.push(effectsFilter);
  if (useAss) post.push(assFilter);
  vfc.push(`${last}${fxFilter}${post.join(',')}${annoFilter}[v]`);

  const fullv = path.join(workDir, 'fullv.mp4');
  // NOT: -loglevel error + -nostats ŞART — sahne bölme ile klip sayısı artınca
  // (10→18) ffmpeg'in varsayılan progress/filtre-graph stderr'i 20MB tamponu
  // aşıp "stderr maxBuffer length exceeded" ile üretimi çökertti. Hata satırları
  // yine görünür; sadece progress spam susar. Tampon da bol tutulur.
  await run('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', '-nostats', ...vInputs,
    '-filter_complex', vfc.join(';'),
    '-map', '[v]', '-an',
    '-c:v', 'libx264', '-preset', config.video.encodePreset, '-crf', String(config.video.encodeCrf),
    '-maxrate', config.video.encodeMaxrate, '-bufsize', config.video.encodeBufsize,
    '-pix_fmt', 'yuv420p', '-r', String(fps),
    path.resolve(fullv),
  ], { cwd: workDir, maxBuffer: 128 * 1024 * 1024 });

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
      hookSfx: job.hookText ? 'impact' : null,
    },
    path.resolve(fulla),
  );

  // 6) MUX: video + ses.
  await run('ffmpeg', [
    '-y', '-i', path.resolve(fullv), '-i', path.resolve(fulla),
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-c:a', 'copy',
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
    timeline: job.timeline || null,
    // Ekranda GERÇEKTEN çizilen semantik kompozisyonlar (görsel anlatım QC'si bunu ölçer).
    semanticBeats: semanticBeatsUsed,
    // V3: aktör/kart ayrımı (sessiz anlaşılırlık QC'si bunu ölçer).
    actorStats: actorStatsUsed,
    // Sahne başına GERÇEKTEN çizilen aktörler + ölçülen odak — semantik eylem
    // tamamlama denetimi bunları okur ("çizgi var" ile "olay oldu" farkı).
    actorsByScene: actorsBySceneUsed,
    sceneFocus: sceneFocusUsed,
    renderPlan: {
      // BİLDİRİM TAMLIĞI — render'ın ekrana KOYDUĞU her katman burada listelenir.
      //
      // 26 Tem kolibri koşusu: production report "CTA uygulanmadı" diyordu ve
      // doğruydu — motion.cta gerçekten çalışmamıştı. Ama ekranda 40-42.6s
      // arasında bir SUBSCRIBE pili vardı; onu bu dosyanın BAŞKA bir kod yolu
      // (spOn) çiziyor ve hiçbir rapora kendini bildirmiyordu. Final video
      // doğrulayıcısı, referans penceresi olmayan bir bindirmeyi piksel
      // taramasıyla bulamaz; bu yüzden bildirim ZORUNLUdur.
      overlayLayers: [
        ...(hasHook ? ['hook'] : []),
        ...(hasSubs ? ['caption'] : []),
        ...(listMarkers.length ? ['listMarker'] : []),
        ...(actorAssWritten ? ['actor'] : []),
        ...(cardAssWritten ? ['card'] : []),
        ...(spOn ? ['cta'] : []),
        ...(job.finaleText ? ['finale'] : []),
      ],
      // Bindirmelerin GERÇEK zaman pencereleri — doğrulayıcının referansı.
      overlayWindows: {
        hook: hasHook ? [[0, config.video.hookDuration]] : [],
        cta: spOn ? [[+T1.toFixed(2), +T2.toFixed(2)]] : [],
        diagram: (media || []).map((m, i) => (m?.gfx && canonicalItems?.[i]
          ? [+canonicalItems[i].start.toFixed(2), +canonicalItems[i].end.toFixed(2)] : null))
          .filter(Boolean),
        loopEcho: (media || []).map((m, i) => (m?.loopEcho && canonicalItems?.[i]
          ? [+canonicalItems[i].start.toFixed(2), +canonicalItems[i].end.toFixed(2)] : null))
          .filter(Boolean),
        listMarker: listMarkers.map((m) => [+m.start.toFixed(2), +m.end.toFixed(2)]),
      },
      // TIMELINE BÜTÜNLÜĞÜ: her klibin kimliği + sırası. scene_03_clip_02,
      // scene_04_clip_00'dan önce gelmeli; doğrulayıcı bunu denetler.
      // KİMLİK ÇAKIŞMASI: (sahne, parça) çifti tek başına BENZERSİZ DEĞİLDİR.
      // Döngü kapanışı klibi ilk görseli KASITLI olarak yeniden kullanır, yani
      // scene=0/part=0 ile gelir ve zaman çizelgesinin ilk klibiyle aynı
      // kimliği alır. Roma su kemerleri koşusunda doğrulayıcı bunu haklı olarak
      // TIMELINE_ORDER_INVALID:DUPLICATE_CLIP_ID diye bildirdi — kusur planda
      // değil, kimlik şemasındaydı. Döngü yankısı kendi adını alır; kalan her
      // çakışma da render sırasıyla ayrıştırılır ki kimlik daima tekil olsun.
      clips: (() => {
        const used = new Set();
        return (canonicalItems || []).map((it, i) => {
          const sceneIdx = it?.scene ?? job.mediaScene?.[i] ?? i;
          const part = media?.[i]?.part ?? 0;
          const kind = media?.[i]?.loopEcho ? 'loopecho' : 'clip';
          let id = `scene_${String(sceneIdx).padStart(2, '0')}_${kind}_${String(part).padStart(2, '0')}`;
          if (used.has(id)) id += `_r${String(i).padStart(2, '0')}`;
          used.add(id);
          return {
            id,
            scene: sceneIdx,
            sequence: part,
            renderOrder: i,
            loopEcho: Boolean(media?.[i]?.loopEcho),
            start: +Number(it.start).toFixed(3),
            end: +Number(it.end).toFixed(3),
            assetId: media?.[i]?.assetId || media?.[i]?.path || null,
            source: media?.[i]?.source || null,
          };
        });
      })(),
      expectedSceneCount: N,
      sceneBoundaries: canonicalItems ? canonicalItems.slice(0, -1).map((x) => x.end) : [],
      transitions: btName.slice(0, Math.max(0, N - 1)).map((type, i) => ({ type: planOk ? plan.boundaries[i]?.transition || 'cut' : type, atSeconds: canonicalItems?.[i]?.end ?? null })),
      captionsIncluded: hasSubs,
      captionEventCount: wordTimings.length,
      expectedSfxCount: audioInfo?.sfxCues?.length || 0,
      motion: motionPlan,
      motionIssues,
    },
  };
}
