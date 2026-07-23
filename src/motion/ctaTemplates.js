import { config } from '../config.js';

/**
 * NEO MOTION ENGINE — CTA ŞABLONLARI (ASS/libass, tamamen özgün).
 *
 * Her şablon: koyu cam kart + turkuaz vektör ikon + kısa etiket + giriş/bekle/
 * çıkış hareketi. Referans videolar birebir kopyalanmaz; ortak NeoSaniye dili:
 * minimal, teknolojik, akıcı. PNG/asset YOK — hepsi ASS vektör + \move/\t/\fad.
 */

const CARD_W = 384;
const CARD_H = 112;
const ICON = 52; // ikon kutu boyu

/** &HAABBGGRR& ASS rengi (RRGGBB hex → BGR, alpha 00 = opak). */
function assColor(hex, alpha = '00') {
  const r = hex.slice(0, 2);
  const g = hex.slice(2, 4);
  const b = hex.slice(4, 6);
  return `&H${alpha}${b}${g}${r}&`.toUpperCase();
}

function assTime(sec) {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = (s % 60).toFixed(2).padStart(5, '0');
  return `${h}:${String(m).padStart(2, '0')}:${ss}`;
}

/** Yuvarlatılmış dikdörtgen ASS çizim yolu (üst-sol orijin, w×h, köşe r). */
function roundRect(w, h, r) {
  return `m ${r} 0 l ${w - r} 0 b ${w} 0 ${w} 0 ${w} ${r} l ${w} ${h - r} ` +
    `b ${w} ${h} ${w} ${h} ${w - r} ${h} l ${r} ${h} b 0 ${h} 0 ${h} 0 ${h - r} ` +
    `l 0 ${r} b 0 0 0 0 ${r} 0`;
}

/** İkon vektör yolları (ICON kutusu içinde, üst-sol orijin). */
function iconPath(kind, s = ICON) {
  const p = (n) => +(n * s).toFixed(1);
  switch (kind) {
    case 'plus':
      return `m ${p(0.42)} 0 l ${p(0.58)} 0 l ${p(0.58)} ${p(0.42)} l ${s} ${p(0.42)} ` +
        `l ${s} ${p(0.58)} l ${p(0.58)} ${p(0.58)} l ${p(0.58)} ${s} l ${p(0.42)} ${s} ` +
        `l ${p(0.42)} ${p(0.58)} l 0 ${p(0.58)} l 0 ${p(0.42)} l ${p(0.42)} ${p(0.42)}`;
    case 'heart':
      return `m ${p(0.5)} ${p(0.88)} b ${p(-0.02)} ${p(0.46)} ${p(0.06)} ${p(0.04)} ${p(0.29)} ${p(0.08)} ` +
        `b ${p(0.42)} ${p(0.1)} ${p(0.5)} ${p(0.24)} ${p(0.5)} ${p(0.32)} ` +
        `b ${p(0.5)} ${p(0.24)} ${p(0.58)} ${p(0.1)} ${p(0.71)} ${p(0.08)} ` +
        `b ${p(0.94)} ${p(0.04)} ${p(1.02)} ${p(0.46)} ${p(0.5)} ${p(0.88)}`;
    case 'bell':
      return `m ${p(0.5)} ${p(0.06)} b ${p(0.72)} ${p(0.1)} ${p(0.74)} ${p(0.4)} ${p(0.78)} ${p(0.6)} ` +
        `l ${p(0.86)} ${p(0.72)} l ${p(0.14)} ${p(0.72)} l ${p(0.22)} ${p(0.6)} ` +
        `b ${p(0.26)} ${p(0.4)} ${p(0.28)} ${p(0.1)} ${p(0.5)} ${p(0.06)} ` +
        `m ${p(0.42)} ${p(0.78)} b ${p(0.42)} ${p(0.9)} ${p(0.58)} ${p(0.9)} ${p(0.58)} ${p(0.78)} l ${p(0.42)} ${p(0.78)}`;
    case 'thumbup':
      // YouTube "beğen" başparmağı: el gövdesi + yukarı başparmak (kapalı yol)
      // + sol-alt bilek bloğu (ayrı alt-yol). ICON kutusuna fit, üst-sol orijin.
      return `m ${p(0.36)} ${p(0.44)} l ${p(0.36)} ${p(0.95)} l ${p(0.80)} ${p(0.95)} ` +
        `b ${p(0.90)} ${p(0.95)} ${p(0.92)} ${p(0.86)} ${p(0.90)} ${p(0.78)} ` +
        `l ${p(0.84)} ${p(0.54)} b ${p(0.82)} ${p(0.46)} ${p(0.86)} ${p(0.44)} ${p(0.76)} ${p(0.44)} ` +
        `l ${p(0.54)} ${p(0.44)} l ${p(0.60)} ${p(0.20)} ` +
        `b ${p(0.62)} ${p(0.05)} ${p(0.46)} ${p(0.03)} ${p(0.44)} ${p(0.17)} ` +
        `l ${p(0.38)} ${p(0.40)} b ${p(0.37)} ${p(0.43)} ${p(0.38)} ${p(0.44)} ${p(0.36)} ${p(0.44)} ` +
        `m ${p(0.10)} ${p(0.52)} l ${p(0.30)} ${p(0.52)} l ${p(0.30)} ${p(0.95)} l ${p(0.10)} ${p(0.95)} l ${p(0.10)} ${p(0.52)}`;
    case 'bubble':
      return `m ${p(0.1)} ${p(0.12)} l ${p(0.9)} ${p(0.12)} l ${p(0.9)} ${p(0.58)} ` +
        `l ${p(0.42)} ${p(0.58)} l ${p(0.3)} ${p(0.8)} l ${p(0.3)} ${p(0.58)} ` +
        `l ${p(0.1)} ${p(0.58)} l ${p(0.1)} ${p(0.12)}`;
    case 'bookmark':
      return `m ${p(0.26)} ${p(0.08)} l ${p(0.74)} ${p(0.08)} l ${p(0.74)} ${p(0.9)} ` +
        `l ${p(0.5)} ${p(0.7)} l ${p(0.26)} ${p(0.9)} l ${p(0.26)} ${p(0.08)}`;
    default:
      return roundRect(s, s, 8);
  }
}

// Tip → ikon + DİLE GÖRE etiket. Kanal İngilizce/ABD → varsayılan 'en'.
// Türkçe etiket YALNIZCA Türkçe içerikte (config.content.language==='tr').
const ICON_BY_TYPE = { subscribe: 'plus', like: 'heart', bell: 'bell', comment: 'bubble', follow: 'plus', save: 'bookmark' };
const LABELS = {
  en: { subscribe: 'SUBSCRIBE', like: 'LIKE', bell: 'TURN ON NOTIFICATIONS', comment: 'COMMENT', follow: 'FOLLOW', save: 'SAVE' },
  tr: { subscribe: 'ABONE OL', like: 'BEĞEN', bell: 'BİLDİRİM AÇ', comment: 'YORUM YAP', follow: 'TAKİP ET', save: 'KAYDET' },
};

/** Dile göre CTA künyesi: {label, icon, resolvedLanguage}. */
export function ctaMeta(type, language = config.content?.language || 'en') {
  const lang = LABELS[language] ? language : 'en';
  return { label: (LABELS[lang][type] || LABELS[lang].subscribe), icon: ICON_BY_TYPE[type] || 'plus', resolvedLanguage: lang };
}

// Geriye dönük: eski TYPE_META adı (varsayılan içerik diliyle).
const TYPE_META = Object.fromEntries(Object.keys(ICON_BY_TYPE).map((t) => [t, ctaMeta(t)]));

/**
 * Etiket uzunluğuna göre önerilen kart ölçüsü (safe-area yerleşiminden ÖNCE).
 * Uzun İngilizce etiket ("TURN ON NOTIFICATIONS") için kart genişler; font
 * buildCtaAss içinde bu genişliğe fit edilir (≈40px hedef).
 * @returns {{w:number, h:number}}
 */
export function ctaCardSize(type, language = config.content?.language || 'en') {
  const meta = ctaMeta(type, language);
  // YouTube subscribe kartı iki yan ikon taşır (sol çan + sağ beğen) → metin
  // için ~2 ikon slotu (≈180px) fazladan yer aç, yoksa etiket ikonlara girer.
  const iconAllowance = (type === 'subscribe' && config.motion?.cta?.youtubeStyle) ? 190 : 0;
  const w = Math.max(300, Math.min(760, 150 + Math.round(24 * meta.label.length) + iconAllowance));
  return { w, h: CARD_H };
}

/** ASS başlığı (CTA'ya özel; captions'tan bağımsız dosya). */
function header(width, height, styleLines) {
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${styleLines}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

export const TEMPLATE_IDS = [
  'neo_subscribe_minimal', 'neo_subscribe_pulse',
];

/**
 * Bir CTA için tam ASS içeriği üretir.
 * @param {object} o { templateId, type, box:{x,y,w,h}, startSec, durSec, width, height }
 * @returns {string} ASS dosya içeriği
 */
export function buildCtaAss(o) {
  const width = o.width || 1080;
  const height = o.height || 1920;
  const st = config.motion.style;
  const accent = assColor(st.accent);
  const ink = assColor(st.ink);
  const card = assColor(st.card, '26'); // hafif şeffaf cam (alpha 26 ≈ %85 opak)
  const shadow = assColor('000000', '64');
  const font = st.font;
  const box = o.box;
  const S = o.startSec;
  const E = o.startSec + o.durSec;
  const type = o.type;
  const meta = ctaMeta(type, o.language);

  // YOUTUBE TARZI SUBSCRIBE: kırmızı buton + beyaz çan (bildirim) + "SUBSCRIBE"
  // + beyaz beğen (thumbs-up). İzleyicinin refleksle tanıdığı dil.
  if (type === 'subscribe' && config.motion?.cta?.youtubeStyle) {
    return buildYouTubeSubscribeAss(o, { width, height, font, meta, S, E });
  }

  // Kart ölçüsü: safe-area kutusundan (adaptif genişlik) — uzun İngilizce
  // etiket (TURN ON NOTIFICATIONS) sığsın. Font etikete göre fit edilir.
  const cardW = box.w || CARD_W;
  const cardH = box.h || CARD_H;
  const cardX = box.x;
  const cardY = box.y;
  const iconBox = Math.round(cardH * 0.46);
  const iconX = cardX + 34;
  const iconY = cardY + Math.round((cardH - iconBox) / 2);
  const textX = iconX + iconBox + 24;
  const textY = cardY + Math.round(cardH / 2);
  // Metin fit: kalan genişliğe sığacak font (min 26, tercih 46).
  const usableTextW = cardW - (textX - cardX) - 30;
  const fontSize = Math.max(26, Math.min(46, Math.floor(usableTextW / Math.max(1, meta.label.length * 0.60))));
  const radius = Math.min(26, Math.round(cardH / 4));

  // Giriş: soldan süzülme (\move) + fade. Kart 40px soldan gelir.
  const slideFrom = cardX - 44;
  const fadIn = 200;
  const fadOut = 300; // çıkış YUMUŞAK

  const styles = [
    `Style: NeoShape,${font},40,${accent},${shadow},${shadow},0,0,0,0,100,100,0,0,1,0,3,7,0,0,0,1`,
    `Style: NeoText,${font},${fontSize},${ink},${shadow},${shadow},1,0,0,0,100,100,1,0,1,0,2,4,0,0,0,1`,
  ];

  const ev = [];
  const dlg = (layer, style, tags, text) =>
    `Dialogue: ${layer},${assTime(S)},${assTime(E)},${style},,0,0,0,,${tags}${text}`;

  // 1) Gölge kartı (hafif offset, derinlik hissi).
  ev.push(dlg(0, 'NeoShape',
    `{\\an7\\move(${slideFrom + 4},${cardY + 6},${cardX + 4},${cardY + 6},0,240)\\fad(${fadIn},${fadOut})\\1c${shadow}\\p1}`,
    roundRect(cardW, cardH, radius) + '{\\p0}'));

  // 2) Cam kart gövdesi + sol turkuaz aksan barı.
  ev.push(dlg(1, 'NeoShape',
    `{\\an7\\move(${slideFrom},${cardY},${cardX},${cardY},0,240)\\fad(${fadIn},${fadOut})\\1c${card}\\p1}`,
    roundRect(cardW, cardH, radius) + '{\\p0}'));
  const barTop = Math.round(cardH * 0.2);
  const barBot = cardH - barTop;
  ev.push(dlg(2, 'NeoShape',
    `{\\an7\\move(${slideFrom},${cardY},${cardX},${cardY},0,240)\\fad(${fadIn},${fadOut})\\1c${accent}\\p1}`,
    `m 0 ${barTop} l 7 ${barTop} l 7 ${barBot} l 0 ${barBot}{\\p0}`));

  // 3) İkon — şablona göre hareket (pop / shake / sabit).
  let iconTags = `{\\an7\\pos(${iconX},${iconY})\\fad(${fadIn},${fadOut})\\1c${accent}\\p1}`;
  if (o.templateId === 'neo_like_pop') {
    iconTags = `{\\an7\\pos(${iconX + iconBox / 2},${iconY + iconBox / 2})\\fad(${fadIn},${fadOut})\\1c${accent}` +
      `\\fscx40\\fscy40\\t(${0},${220},\\fscx118\\fscy118)\\t(${220},${360},\\fscx100\\fscy100)\\org(${iconX + iconBox / 2},${iconY + iconBox / 2})\\p1}`;
  } else if (o.templateId === 'neo_bell_ring') {
    iconTags = `{\\an7\\pos(${iconX},${iconY})\\fad(${fadIn},${fadOut})\\1c${accent}\\org(${iconX + iconBox / 2},${iconY})` +
      `\\frz10\\t(0,140,\\frz-10)\\t(140,280,\\frz8)\\t(280,420,\\frz0)\\p1}`;
  }
  // like_pop ikonu merkez-orijinli çizilecek: offset düzelt.
  const iconDraw = o.templateId === 'neo_like_pop'
    ? shiftPath(iconPath(meta.icon, iconBox), -iconBox / 2, -iconBox / 2)
    : iconPath(meta.icon, iconBox);
  ev.push(dlg(3, 'NeoShape', iconTags, iconDraw + '{\\p0}'));

  // 4) Etiket metni.
  let textTags = `{\\an4\\pos(${textX},${textY})\\fad(${fadIn},${fadOut})}`;
  if (o.templateId === 'neo_comment_slide') {
    // Alttan yukarı süzülen metin varyasyonu.
    textTags = `{\\an4\\move(${textX},${textY + 10},${textX},${textY},0,240)\\fad(${fadIn},${fadOut})}`;
  }
  ev.push(dlg(4, 'NeoText', textTags, meta.label));

  // 5) neo_subscribe_pulse: kartın etrafında nabız gibi büyüyen turkuaz halka.
  if (o.templateId === 'neo_subscribe_pulse') {
    for (const delay of [0, 500]) {
      const rs = assTime(S + delay / 1000);
      const re = assTime(Math.min(E, S + delay / 1000 + 0.9));
      ev.push(`Dialogue: 0,${rs},${re},NeoShape,,0,0,0,,` +
        `{\\an7\\pos(${cardX},${cardY})\\1a&HFF&\\3c${accent}\\3a&H40&\\bord3\\fscx100\\fscy100` +
        `\\t(0,900,\\fscx112\\fscy112\\3a&HFF&)\\p1}` + roundRect(cardW, cardH, radius) + '{\\p0}');
    }
  }

  return header(width, height, styles.join('\n')) + ev.join('\n') + '\n';
}

/**
 * YOUTUBE TARZI SUBSCRIBE KARTI (ASS vektör; PNG/asset YOK).
 * Kırmızı yuvarlatılmış buton: [beyaz çan]  SUBSCRIBE  [beyaz beğen].
 * Çan = bildirim, thumbs-up = beğen — YouTube etkileşim dili.
 * @param {object} o buildCtaAss ile aynı girdi
 * @param {object} ctx {width,height,font,meta,S,E}
 */
function buildYouTubeSubscribeAss(o, ctx) {
  const { width, height, font, meta, S, E } = ctx;
  const st = config.motion.style;
  const red = assColor(st.youtubeRed || 'FF0000');
  const white = assColor(st.youtubeInk || 'FFFFFF');
  const shadow = assColor('000000', '64');
  const redShadow = assColor('7A0000', '3C'); // koyu kırmızı derinlik gölgesi

  const box = o.box;
  const cardW = box.w || 520;
  const cardH = box.h || CARD_H;
  const cardX = box.x;
  const cardY = box.y;
  const radius = Math.round(cardH * 0.26); // modern yuvarlatılmış dikdörtgen
  const iconBox = Math.round(cardH * 0.44);
  const iconY = cardY + Math.round((cardH - iconBox) / 2);

  const bellX = cardX + 28;
  const thumbX = cardX + cardW - 28 - iconBox;
  const regionLeft = bellX + iconBox + 14;
  const regionRight = thumbX - 14;
  const centerX = Math.round((regionLeft + regionRight) / 2);
  const centerY = cardY + Math.round(cardH / 2);
  const regionW = Math.max(60, regionRight - regionLeft);
  const fontSize = Math.max(30, Math.min(52, Math.floor(regionW / Math.max(1, meta.label.length * 0.60))));

  const fadIn = 180;
  const fadOut = 280;
  const styles = [
    // Şekiller: fill \1c ile override edilir; outline 0 (temiz düz buton).
    `Style: YtShape,${font},40,${red},${shadow},${shadow},0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1`,
    // Metin: kalın beyaz, ince koyu outline (kırmızı üstünde net okunur).
    `Style: YtText,${font},${fontSize},${white},${assColor('3A0000')},${shadow},1,0,0,0,100,100,1,0,1,1.5,3,5,0,0,0,1`,
  ];

  const ev = [];
  const dlg = (layer, style, tags, text) =>
    `Dialogue: ${layer},${assTime(S)},${assTime(E)},${style},,0,0,0,,${tags}${text}`;

  // 1) Derinlik gölgesi (hafif offset kırmızı-siyah).
  ev.push(dlg(0, 'YtShape',
    `{\\an7\\pos(${cardX + 3},${cardY + 5})\\fad(${fadIn},${fadOut})\\1c${redShadow}\\p1}`,
    roundRect(cardW, cardH, radius) + '{\\p0}'));

  // 2) Kırmızı buton gövdesi — hafif aşağı-yerleşme + %90→%100 pop.
  const cx = cardX + Math.round(cardW / 2);
  const cy = cardY + Math.round(cardH / 2);
  ev.push(dlg(1, 'YtShape',
    `{\\an7\\pos(${cardX},${cardY})\\fad(${fadIn},${fadOut})\\1c${red}\\org(${cx},${cy})` +
    `\\fscx90\\fscy90\\t(0,200,\\fscx100\\fscy100)\\p1}`,
    roundRect(cardW, cardH, radius) + '{\\p0}'));

  // 3) Çan (bildirim) — kısa "çalma" salınımı (neo_bell_ring dili).
  const bellOrg = `\\org(${bellX + iconBox / 2},${iconY})`;
  ev.push(dlg(2, 'YtShape',
    `{\\an7\\pos(${bellX},${iconY})\\fad(${fadIn},${fadOut})\\1c${white}${bellOrg}` +
    `\\frz10\\t(0,140,\\frz-10)\\t(140,280,\\frz8)\\t(280,420,\\frz0)\\p1}`,
    iconPath('bell', iconBox) + '{\\p0}'));

  // 4) "SUBSCRIBE" metni (iki ikon arasında ortalı).
  ev.push(dlg(3, 'YtText', `{\\an5\\pos(${centerX},${centerY})\\fad(${fadIn},${fadOut})}`, meta.label));

  // 5) Beğen (thumbs-up) — merkez-orijinli pop.
  const thumbCx = thumbX + iconBox / 2;
  const thumbCy = iconY + iconBox / 2;
  ev.push(dlg(4, 'YtShape',
    `{\\an7\\pos(${thumbCx},${thumbCy})\\fad(${fadIn},${fadOut})\\1c${white}` +
    `\\fscx40\\fscy40\\t(120,340,\\fscx116\\fscy116)\\t(340,480,\\fscx100\\fscy100)` +
    `\\org(${thumbCx},${thumbCy})\\p1}`,
    shiftPath(iconPath('thumbup', iconBox), -iconBox / 2, -iconBox / 2) + '{\\p0}'));

  // 6) neo_subscribe_pulse: butonun etrafında kırmızı nabız halkası.
  if (o.templateId === 'neo_subscribe_pulse') {
    for (const delay of [0, 500]) {
      const rs = assTime(S + delay / 1000);
      const re = assTime(Math.min(E, S + delay / 1000 + 0.9));
      ev.push(`Dialogue: 0,${rs},${re},YtShape,,0,0,0,,` +
        `{\\an7\\pos(${cardX},${cardY})\\1a&HFF&\\3c${red}\\3a&H40&\\bord3\\fscx100\\fscy100` +
        `\\t(0,900,\\fscx110\\fscy110\\3a&HFF&)\\p1}` + roundRect(cardW, cardH, radius) + '{\\p0}');
    }
  }

  return header(width, height, styles.join('\n')) + ev.join('\n') + '\n';
}

/** ASS çizim yolundaki tüm sayısal çiftleri (dx,dy) kadar kaydırır. */
function shiftPath(path, dx, dy) {
  const tokens = path.split(/\s+/);
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === 'm' || t === 'l' || t === 'b') {
      out.push(t);
      i += 1;
      // b: 6 sayı, m/l: 2 sayı — ama zincirleme olabilir; çift çift kaydır.
      while (i + 1 < tokens.length && !Number.isNaN(Number(tokens[i])) && !Number.isNaN(Number(tokens[i + 1]))) {
        out.push((Number(tokens[i]) + dx).toFixed(1), (Number(tokens[i + 1]) + dy).toFixed(1));
        i += 2;
      }
    } else {
      out.push(t);
      i += 1;
    }
  }
  return out.join(' ');
}

export { CARD_W, CARD_H, TYPE_META };
