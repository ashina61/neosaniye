import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { config } from '../config.js';

const run = promisify(execFile);

/**
 * MOTION GRAPHICS — template tabanlı sahne üreticisi (saf ffmpeg, yeni bağımlılık yok).
 *
 * Felsefe (audit kararı): AI RUNTIME'DA KOD YAZMAZ. Görüntü Yönetmeni yalnızca
 * doğrulanmış bir PARAMETRE üretir (ör. {value, unit, label}); burada önceden
 * TEST EDİLMİŞ bir ffmpeg template'i o parametreyle deterministik bir sahne
 * mp4'ü render eder. Compile hatası yok, arbitrary code yok, cache'lenebilir.
 *
 * Şu an tek template: STAT CARD — büyük bir sayının 0'dan hedefe sayılması.
 * Bizim içeriğimizin can damarı ("saniyede 50 kanat", "20.000 dönüm").
 *
 * Herhangi bir hata → çağıran taraf (generateImages) normal görsel zincirine
 * düşer; boru hattı asla kırılmaz.
 */

const FONTS_DIR = path.resolve(config.video.fontsDir || 'assets/fonts');
const FONT_BLACK = path.join(FONTS_DIR, 'Montserrat-Black.ttf');
const FONT_SEMI = path.join(FONTS_DIR, 'Montserrat-SemiBold.ttf');

/** ffmpeg drawtext metin/parametre kaçışı. */
function dt(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, '’') // düz tırnağı tipografik tırnağa çevir (kaçış derdi yok)
    .replace(/%/g, '\\%');
}

/** ffmpeg expr içindeki sayıyı güvenli aralığa çeker. */
function clampInt(n, lo, hi) {
  const v = Math.round(Number(n) || 0);
  return Math.max(lo, Math.min(hi, v));
}

/**
 * STAT CARD sahnesi render eder: koyu marka zemini + 0'dan `value`'ya sayılan
 * dev sayı + altında birim + en altta kısa etiket. Yumuşak fade-in.
 *
 * @param {object} stat - { value:number, unit?:string, label?:string }
 * @param {string} dest - çıktı .mp4 yolu
 * @param {object} opts - { width, height, fps, duration }
 * @returns {Promise<{path:string,type:'video'}>}
 */
export async function renderStatCard(stat, dest, opts = {}) {
  const { width = 1080, height = 1920, fps = 30, duration = 4, bgImage = null } = opts;
  if (!existsSync(FONT_BLACK)) throw new Error('Montserrat-Black fontu yok — stat card atlandı');

  let value = clampInt(stat.value, 0, 1e12);
  let unit = String(stat.unit || '').trim().slice(0, 28);
  const label = String(stat.label || '').trim().slice(0, 60);
  const dur = Math.max(2.2, Math.min(9, Number(duration) || 4));

  // BÜYÜK SAYI NORMALİZASYONU (canlıda "50000000" ekrana sığmadı — sadece
  // sıfırlar görünüyordu): milyon/milyar kompakta indirilir, ölçek birime taşınır.
  // "50 million years" gibi okunur; sayaç da 0→50 sayar (0→50.000.000 değil).
  const scale = (word, div) => {
    if (value >= div && value % (div / 10) === 0) {
      const n = value / div;
      if (n === Math.round(n) && n < 1000) {
        value = n;
        if (!new RegExp(word, 'i').test(unit)) unit = `${word} ${unit}`.trim();
        return true;
      }
    }
    return false;
  };
  scale('billion', 1e9) || scale('million', 1e6);

  // 10.000-999.999 arası: sayaç yerine binlik ayraçlı SABİT reveal
  // (%{eif} ifadesi ayraç basamaz; ham "20000" da ucuz görünür → "20,000").
  const useCounter = value < 10000;
  const staticText = value.toLocaleString('en-US');

  const sb = config.video.styleBible;
  const cx = Math.round(width / 2);
  const marginH = 70;
  const usableW = width - 2 * marginH;

  // Sayaç SABİT ~1.8 sn'de hedefe ulaşır (kart süresinden bağımsız), kalanı
  // sabit tutar. Kart uzun render edilir; renderVideo/normalizeClip sahne
  // süresine göre kırpar — bu yüzden sayaç HER durumda tamamlanmış görünür.
  const countDur = Math.min(1.8, dur * 0.5).toFixed(2);
  const countExpr = `min(t/${countDur}\\,1)*${value}`;
  const numText = useCounter ? `%{eif\\:${countExpr}\\:d}` : dt(staticText);

  // Konum: vurgu bandı ve akan altyazıyla çakışmasın diye yukarı alındı
  // (canlıda kart etiketi ile vurgu kelimesi üst üste bindi).
  const yNum = Math.round(height * 0.34);
  const yUnit = Math.round(height * 0.435);
  const yLabel = Math.round(height * 0.50);
  // GENİŞLİĞE OTOSİĞDİRMA: en geniş hal (hedef değer/formatlı metin) usableW'i
  // aşarsa font küçülür — sayı hiçbir karede ekran dışına taşamaz.
  const numLen = Math.max(1, (useCounter ? String(value) : staticText).length);
  const numSize = Math.min(Math.round(width * 0.26), Math.floor(usableW / (numLen * 0.68)));
  const unitSize = Math.round(width * 0.058);
  const labelSize = Math.round(width * 0.045);

  // İnce altın ayraç (birim ile etiket arası) — premium factual dokunuş.
  const ruleY = Math.round(height * 0.472);
  const ruleW = Math.round(width * 0.14);

  const drawNum =
    `drawtext=fontfile='${FONT_BLACK}':text='${numText}':` +
    `fontcolor=0x${sb.ink}:fontsize=${numSize}:x=(w-text_w)/2:y=${yNum}-text_h/2:` +
    `shadowcolor=0x000000@0.55:shadowx=0:shadowy=6:` +
    `alpha='min((t)/0.5,1)'`;

  const drawUnit = unit
    ? `,drawtext=fontfile='${FONT_SEMI}':text='${dt(unit)}':` +
      `fontcolor=0x${sb.accent}:fontsize=${unitSize}:x=(w-text_w)/2:y=${yUnit}:` +
      `alpha='min(max((t-0.25)/0.5,0),1)'`
    : '';

  const drawRule =
    `,drawbox=x=${cx - Math.round(ruleW / 2)}:y=${ruleY}:w=${ruleW}:h=4:` +
    `color=0x${sb.accent}@0.9:t=fill:enable='gte(t,0.35)'`;

  const drawLabel = label
    ? `,drawtext=fontfile='${FONT_SEMI}':text='${dt(label)}':` +
      `fontcolor=0x${sb.ink}@0.92:fontsize=${labelSize}:x=(w-text_w)/2:y=${yLabel}:` +
      `alpha='min(max((t-0.45)/0.6,0),1)'`
    : '';

  // Koyu dikey gradyan zemin + hafif vignette (marka bg). gradients kaynağı
  // yoksa düz koyu renge düşülür (aşağıdaki catch).
  const bgSrc =
    `gradients=s=${width}x${height}:c0=0x${sb.bg0}:c1=0x${sb.bg1}:` +
    `x0=0:y0=0:x1=0:y1=${height}:d=${dur}:r=${fps}`;

  const frame =
    `drawbox=x=44:y=44:w=${width - 88}:h=${height - 88}:color=0x${sb.accent}@0.22:t=2:enable='gte(t,0.15)',`;

  // AKIŞI KORUYAN MOD: sahnenin gerçek görseli arka planda, sayı ÜSTÜNE biner
  // (kullanıcı geri bildirimi: düz kara kart akışı kesiyordu). Okunurluk için
  // koyu scrim + vignette. Görsel yoksa/işlenemezse marka gradyanına düşer.
  if (bgImage && existsSync(bgImage)) {
    const vfImg =
      `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},` +
      `drawbox=x=0:y=0:w=${width}:h=${height}:color=0x${sb.bg1}@0.42:t=fill,` +
      // Sayı/etiket bölgesine ekstra koyu bant (üst-orta) → beyaz sayı parlak
      // görselde bile okunur; kenarlarda görsel açık kalır (akış korunur).
      `drawbox=x=0:y=${Math.round(height * 0.26)}:w=${width}:h=${Math.round(height * 0.26)}:color=0x0a0e14@0.32:t=fill,vignette=PI/7,` +
      `${frame}${drawNum}${drawUnit}${drawRule}${drawLabel},fade=t=in:st=0:d=0.4,format=yuv420p`;
    try {
      await run('ffmpeg', ['-y', '-loop', '1', '-i', path.resolve(bgImage),
        '-t', String(dur.toFixed(3)), '-vf', vfImg, '-r', String(fps),
        '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', dest],
        { maxBuffer: 20 * 1024 * 1024 });
      return { path: dest, type: 'video' };
    } catch {
      /* görsel işlenemedi → aşağıdaki marka gradyanı moduna düş */
    }
  }

  const vf =
    `vignette=PI/7,${frame}${drawNum}${drawUnit}${drawRule}${drawLabel},` +
    `fade=t=in:st=0:d=0.4,format=yuv420p`;

  const args = [
    '-y',
    '-f', 'lavfi', '-i', bgSrc,
    '-t', String(dur.toFixed(3)),
    '-vf', vf,
    '-r', String(fps),
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    dest,
  ];

  try {
    await run('ffmpeg', args, { maxBuffer: 20 * 1024 * 1024 });
  } catch {
    // gradients filtresi bazı ffmpeg derlemelerinde yok → düz koyu zemine düş.
    const flat = args.slice();
    const i = flat.indexOf(bgSrc);
    flat[i] = `color=c=0x${sb.bg1}:s=${width}x${height}:r=${fps}`;
    await run('ffmpeg', flat, { maxBuffer: 20 * 1024 * 1024 });
  }
  return { path: dest, type: 'video' };
}

/**
 * HOW IT WORKS kartı: çalışma prensibini 2-4 ultra kısa adımla, sırayla
 * beliren satırlar hâlinde gösterir (altın numara + kırık beyaz metin).
 * howworks/process videolarında güçlü bir "pattern interrupt".
 *
 * @param {object} diagram - { title:string, steps:string[] (2-4) }
 * @param {string} dest - çıktı .mp4 yolu
 * @param {object} opts - { width, height, fps, duration }
 */
export async function renderStepsCard(diagram, dest, opts = {}) {
  const { width = 1080, height = 1920, fps = 30, duration = 8 } = opts;
  if (!existsSync(FONT_BLACK)) throw new Error('Montserrat fontu yok — steps card atlandı');

  const title = String(diagram.title || '').trim().slice(0, 30).toUpperCase();
  const steps = (diagram.steps || []).map((s) => String(s).trim().slice(0, 44)).filter(Boolean).slice(0, 4);
  if (steps.length < 2) throw new Error('steps card: en az 2 adım gerekli');
  const dur = Math.max(3, Math.min(9, Number(duration) || 8));

  const sb = config.video.styleBible;
  const cx = Math.round(width / 2);
  const titleSize = Math.round(width * 0.056);
  const stepSize = Math.round(width * 0.047);
  const numSize = Math.round(width * 0.044);
  // Yerleşim yukarı + sıkı: alt altyazı bandı ve vurguyla çakışmasın
  // (canlıda 2. satırın üstüne vurgu kelimesi bindi).
  const yTitle = Math.round(height * 0.27);
  const yStart = Math.round(height * 0.355);
  const gap = Math.round(height * 0.074);
  const chip = Math.round(width * 0.076); // numara rozeti (kare, altın çerçeveli)
  const xChip = 132;
  const xText = xChip + chip + 44;

  const parts = [
    // İnce altın çerçeve (kenarlardan içeride) — premium belgesel dokunuşu.
    `drawbox=x=44:y=44:w=${width - 88}:h=${height - 88}:color=0x${sb.accent}@0.22:t=2:enable='gte(t,0.15)'`,
    // Başlık: altın; altında ince altın ayraç.
    `drawtext=fontfile='${FONT_SEMI}':text='${dt(title)}':fontcolor=0x${sb.accent}:` +
      `fontsize=${titleSize}:x=(w-text_w)/2:y=${yTitle}:alpha='min(t/0.5,1)'`,
    `drawbox=x=${cx - 70}:y=${yTitle + titleSize + 24}:w=140:h=3:color=0x${sb.accent}@0.9:t=fill:enable='gte(t,0.3)'`,
  ];
  // Adımlar: 0.9sn arayla belirir. Numara: koyu rozet + altın çerçeve içinde;
  // satır altlarında hayalet ayraç çizgileri (yapılandırılmış, premium his).
  steps.forEach((step, i) => {
    const y = yStart + i * gap;
    const t0 = (0.7 + i * 0.9).toFixed(2);
    const a = `alpha='min(max((t-${t0})/0.45,0),1)'`;
    const en = `enable='gte(t,${t0})'`;
    parts.push(
      // rozet: koyu dolgu + altın kenar
      `drawbox=x=${xChip}:y=${y - Math.round(chip * 0.18)}:w=${chip}:h=${chip}:color=0x0c1119@0.85:t=fill:${en}`,
      `drawbox=x=${xChip}:y=${y - Math.round(chip * 0.18)}:w=${chip}:h=${chip}:color=0x${sb.accent}@0.85:t=2:${en}`,
      `drawtext=fontfile='${FONT_BLACK}':text='${i + 1}':fontcolor=0x${sb.accent}:` +
        `fontsize=${numSize}:x=${xChip}+(${chip}-text_w)/2:y=${y - Math.round(chip * 0.18)}+(${chip}-text_h)/2:${a}`,
      `drawtext=fontfile='${FONT_SEMI}':text='${dt(step)}':fontcolor=0x${sb.ink}:` +
        `fontsize=${stepSize}:x=${xText}:y=${y}:` +
        `shadowcolor=0x000000@0.5:shadowx=0:shadowy=4:${a}`,
    );
    if (i < steps.length - 1) {
      parts.push(
        `drawbox=x=${xChip}:y=${y + Math.round(gap * 0.72)}:w=${width - xChip - 132}:h=2:` +
          `color=0x${sb.ink}@0.10:t=fill:${en}`,
      );
    }
  });

  const bgSrc =
    `gradients=s=${width}x${height}:c0=0x${sb.bg0}:c1=0x${sb.bg1}:` +
    `x0=0:y0=0:x1=0:y1=${height}:d=${dur}:r=${fps}`;
  const vf = `vignette=PI/7,${parts.join(',')},fade=t=in:st=0:d=0.4,format=yuv420p`;
  const args = [
    '-y', '-f', 'lavfi', '-i', bgSrc, '-t', String(dur.toFixed(3)),
    '-vf', vf, '-r', String(fps),
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', dest,
  ];
  try {
    await run('ffmpeg', args, { maxBuffer: 20 * 1024 * 1024 });
  } catch {
    const flat = args.slice();
    flat[flat.indexOf(bgSrc)] = `color=c=0x${sb.bg1}:s=${width}x${height}:r=${fps}`;
    await run('ffmpeg', flat, { maxBuffer: 20 * 1024 * 1024 });
  }
  return { path: dest, type: 'video' };
}

/** Diagram parametresi kullanılabilir mi? (2-4 kısa adım + başlık) */
export function isUsableDiagram(diagram) {
  if (!diagram || typeof diagram !== 'object') return false;
  const steps = (diagram.steps || []).map((s) => String(s).trim()).filter((s) => s.length >= 3);
  return Boolean(String(diagram.title || '').trim()) && steps.length >= 2 && steps.length <= 4;
}

const NUM_UNITS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const NUM_TENS = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const NUM_SCALES = { hundred: 100, thousand: 1000, million: 1e6, billion: 1e9 };

/** Bir metindeki sayıları çıkarır — hem rakam ("20,000") hem yazı ("fifty
 *  thousand", "one thousand two hundred") biçimlerini. Set<number> döner. */
function extractNumbers(text) {
  const found = new Set();
  const clean = String(text).toLowerCase();
  // Rakam grupları (virgül ayraçlarını temizle).
  for (const m of clean.replace(/[,](?=\d)/g, '').match(/\d+/g) || []) found.add(Number(m));
  // Yazıyla sayılar.
  const tokens = clean.replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/).filter(Boolean);
  let current = 0;
  let result = 0;
  let active = false;
  const flush = () => {
    if (active) found.add(result + current);
    current = 0; result = 0; active = false;
  };
  for (const tok of tokens) {
    if (tok in NUM_UNITS) { current += NUM_UNITS[tok]; active = true; }
    else if (tok in NUM_TENS) { current += NUM_TENS[tok]; active = true; }
    else if (tok === 'hundred') { current = (current || 1) * 100; active = true; }
    else if (tok in NUM_SCALES) { result += (current || 1) * NUM_SCALES[tok]; current = 0; active = true; }
    else flush();
  }
  flush();
  return found;
}

/** Bir sahnenin stat parametresi geçerli/kullanılabilir mi?
 *  ANTI-HALÜSİNASYON: sayı anlatımda GERÇEKTEN geçmeli (rakam VEYA yazıyla);
 *  yoksa ekrana uydurma sayı basmayız (olgu doğruluğu ilkesi). */
export function isUsableStat(stat, narration = '') {
  if (!stat || typeof stat !== 'object') return false;
  const v = Math.round(Number(stat.value) || 0);
  if (!Number.isFinite(v) || v <= 0) return false;
  return extractNumbers(narration).has(v);
}
