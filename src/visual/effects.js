/**
 * GÖRSEL ANLATIM — EFEKT MOTORU (ASS/libass, tamamen vektör; PNG/asset YOK).
 *
 * Overlay efektleri (ok, daire, kutu, spotlight, etiket, tarih, sayaç, vurgu)
 * tek bir effects.ass'e derlenir ve montaj pass'inde altyazının ÜSTÜNE bindirilir
 * (CTA motoruyla aynı kanıtlanmış yol). Zaman kapısı ABSOLUTE video saatidir.
 * Koordinatlar normalize (0..1) gelir, burada 1080x1920 piksele çevrilir ve
 * safe-area'ya göre düzeltilir → yanlış yere/altyazı üstüne çizilmez.
 *
 * Clip-seviyesi efektler (zoom_to_region, blur_to_focus, camera_shake) AYRI:
 * onlar normalizeClip'in ffmpeg zincirine girer (bkz. effectPlanner clip-fx).
 */
import { toPx, regionToPx, avoidSubtitle, CANVAS } from './coords.js';

const ACCENT = '3BD0C8';   // marka turkuazı
const WARN = '00C8FF';     // dikkat (amber-ish, BGR)
const INK = 'FFFFFF';

/** RRGGBB → ASS &HAABBGGRR. */
export function assColor(hex, alpha = '00') {
  const r = hex.slice(0, 2); const g = hex.slice(2, 4); const b = hex.slice(4, 6);
  return `&H${alpha}${b}${g}${r}&`.toUpperCase();
}
export function assTime(sec) {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
  const ss = (s % 60).toFixed(2).padStart(5, '0');
  return `${h}:${String(m).padStart(2, '0')}:${ss}`;
}
/** Merkez (r,r), yarıçap r dairesi (4 kübik bezier). */
export function circlePath(r) {
  const k = +(0.5523 * r).toFixed(1); const R = +r.toFixed(1); const D = +(2 * r).toFixed(1);
  return `m ${D} ${R} b ${D} ${R + k} ${R + k} ${D} ${R} ${D} ` +
    `b ${R - k} ${D} 0 ${R + k} 0 ${R} b 0 ${R - k} ${R - k} 0 ${R} 0 ` +
    `b ${R + k} 0 ${D} ${R - k} ${D} ${R}`;
}
/** Yuvarlatılmış dikdörtgen (üst-sol orijin). */
export function roundRect(w, h, r) {
  return `m ${r} 0 l ${w - r} 0 b ${w} 0 ${w} 0 ${w} ${r} l ${w} ${h - r} ` +
    `b ${w} ${h} ${w} ${h} ${w - r} ${h} l ${r} ${h} b 0 ${h} 0 ${h} 0 ${h - r} l 0 ${r} b 0 0 0 0 ${r} 0`;
}
export function esc(t) { return String(t || '').replace(/[{}]/g, '').replace(/\\/g, '/').replace(/\n/g, ' '); }

const HEADER = (w, h) => `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: VEShape,Montserrat SemiBold,40,${assColor(ACCENT)},${assColor('000000','64')},${assColor('000000','64')},0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: VEText,Montserrat SemiBold,46,${assColor(INK)},${assColor('101010')},${assColor('000000','64')},1,0,0,0,100,100,0,0,1,2,3,5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

const D = (layer, style, s, e, tags, text = '') =>
  `Dialogue: ${layer},${assTime(s)},${assTime(e)},${style},,0,0,0,,${tags}${text}`;

/**
 * Tek efekt → ASS event satır(lar)ı. Bilinmeyen/clip-seviyesi tip → [] (atlanır).
 * @param {object} fx {type,start,end, x,y,region,text,color,intensity}
 * @param {object} cfg görsel storytelling config (safe-area)
 */
export function effectEvents(fx, cfg = {}) {
  const s = Number(fx.start) || 0;
  const e = Math.max(s + 0.2, Number(fx.end) || s + 1.5);
  const col = assColor(fx.color || ACCENT);
  const fad = '\\fad(160,220)';

  switch (fx.type) {
    case 'highlight_circle': {
      const p = avoidSubtitle(fx.x, fx.y, cfg);
      const c = toPx(p.x, p.y);
      const r = Math.round((fx.radius ? fx.radius : 0.12) * CANVAS.w);
      // Halka: dolgu şeffaf, kenarlık renkli + hafif nabız.
      return [D(5, 'VEShape', s, e,
        `{\\an7\\pos(${c.x - r},${c.y - r})\\1a&HFF&\\3c${col}\\3a&H10&\\bord5${fad}` +
        `\\fscx70\\fscy70\\t(0,240,\\fscx105\\fscy105)\\t(240,420,\\fscx100\\fscy100)\\p1}` +
        circlePath(r) + '{\\p0}')];
    }
    case 'highlight_box': {
      const box = regionToPx(fx.region || { x: fx.x - 0.15, y: fx.y - 0.1, width: 0.3, height: 0.2 });
      return [D(5, 'VEShape', s, e,
        `{\\an7\\pos(${box.x},${box.y})\\1a&HFF&\\3c${col}\\3a&H10&\\bord5${fad}\\p1}` +
        roundRect(box.w, box.h, 18) + '{\\p0}')];
    }
    case 'arrow_pointer': {
      const p = avoidSubtitle(fx.x, fx.y, cfg);
      const tip = toPx(p.x, p.y);
      // Uç (70,70)'te, gövde sol-üste; \move ile hedefe süzülür (göz çeker).
      const box = 74;
      const arrow = 'm 74 74 l 30 58 l 46 42 l 12 8 l 8 12 l 42 46 l 58 30';
      const px = tip.x - box; const py = tip.y - box;
      return [D(5, 'VEShape', s, e,
        `{\\an7\\move(${px - 26},${py - 26},${px},${py},0,260)${fad}\\1c${col}\\3c${assColor('000000')}\\bord2\\p1}` +
        arrow + '{\\p0}')];
    }
    case 'spotlight': {
      const p = avoidSubtitle(fx.x, fx.y, cfg);
      const c = toPx(p.x, p.y);
      const r = Math.round((fx.radius ? fx.radius : 0.26) * CANVAS.w);
      // Tüm ekranı karart, hedef elipsi \iclip ile OYARAK aydınlık bırak.
      const ell = `m ${c.x - r} ${c.y} b ${c.x - r} ${c.y - r} ${c.x + r} ${c.y - r} ${c.x + r} ${c.y} ` +
        `b ${c.x + r} ${c.y + r} ${c.x - r} ${c.y + r} ${c.x - r} ${c.y}`;
      return [D(4, 'VEShape', s, e,
        `{\\an7\\pos(0,0)\\1c${assColor('05070C')}\\1a&H70&\\bord0\\iclip(${ell})${fad}\\p1}` +
        `m 0 0 l ${CANVAS.w} 0 l ${CANVAS.w} ${CANVAS.h} l 0 ${CANVAS.h}{\\p0}`)];
    }
    case 'label_pop':
    case 'date_pop':
    case 'caption_emphasis': {
      const text = esc(fx.text).toUpperCase().slice(0, 42);
      if (!text) return [];
      const p = avoidSubtitle(fx.x ?? 0.5, fx.y ?? 0.34, cfg);
      const c = toPx(p.x, p.y);
      const bg = assColor(fx.type === 'date_pop' ? '141A1E' : '141A1E', '20');
      const acc = assColor(fx.color || ACCENT);
      const fs = fx.type === 'caption_emphasis' ? 58 : 50;
      const w = Math.min(CANVAS.w - 120, 120 + text.length * Math.round(fs * 0.52));
      const h = Math.round(fs * 1.7);
      // Zemin pill (pop) + accent alt bar + metin.
      return [
        D(4, 'VEShape', s, e, `{\\an5\\pos(${c.x},${c.y})\\1c${bg}\\bord0${fad}\\fscx80\\fscy80\\t(0,200,\\fscx100\\fscy100)\\p1}` +
          roundRect(w, h, 16) + '{\\p0}'),
        D(5, 'VEShape', s, e, `{\\an5\\pos(${c.x},${c.y + Math.round(h / 2) - 5})\\1c${acc}\\bord0${fad}\\p1}` +
          `m ${-Math.round(w * 0.16)} 0 l ${Math.round(w * 0.16)} 0 l ${Math.round(w * 0.16)} 4 l ${-Math.round(w * 0.16)} 4{\\p0}`),
        D(6, 'VEText', s, e, `{\\an5\\pos(${c.x},${c.y})\\fs${fs}${fad}}`, text),
      ];
    }
    case 'number_counter': {
      // Gerçek sayaç: pencereyi adımlara böl, her adımda artan sayı (drawtext
      // %{eif} ASS'te yok → adımlı Dialogue). "30+ DİŞLİ" gibi suffix desteklenir.
      const target = Math.max(0, Math.round(Number(fx.value) || 0));
      const suffix = esc(fx.suffix || fx.text || '').toUpperCase().slice(0, 18);
      const p = avoidSubtitle(fx.x ?? 0.5, fx.y ?? 0.32, cfg);
      const c = toPx(p.x, p.y);
      const acc = assColor(fx.color || ACCENT);
      const steps = Math.min(24, Math.max(6, target > 0 ? 14 : 1));
      const dur = e - s;
      const rise = Math.min(dur * 0.6, 1.2);
      const out = [];
      for (let i = 0; i < steps; i += 1) {
        const t0 = s + (rise * i) / steps;
        const t1 = i === steps - 1 ? e : s + (rise * (i + 1)) / steps;
        const val = Math.round((target * (i + 1)) / steps);
        out.push(D(6, 'VEText', t0, t1, `{\\an5\\pos(${c.x},${c.y})\\fs96\\b1\\3c${acc}\\bord3${i === 0 ? fad : ''}}`, String(val)));
      }
      if (suffix) out.push(D(6, 'VEText', s, e, `{\\an5\\pos(${c.x},${c.y + 84})\\fs40\\1c${acc}${fad}}`, suffix));
      return out;
    }
    default:
      return []; // clip-seviyesi veya desteklenmeyen → ASS'e girmez
  }
}

/**
 * Tüm görsel efektleri tek ASS'e derle.
 * @param {Array} effects effectEvents ile aynı fx objeleri (absolute zamanlı)
 * @param {object} opts {width,height,cfg}
 * @returns {string} ASS içeriği ('' = efekt yok)
 */
export function buildEffectsAss(effects = [], { width = CANVAS.w, height = CANVAS.h, cfg = {} } = {}) {
  const events = [];
  for (const fx of effects) events.push(...effectEvents(fx, cfg));
  if (!events.length) return '';
  return HEADER(width, height) + events.join('\n') + '\n';
}

export const OVERLAY_EFFECT_TYPES = [
  'highlight_circle', 'highlight_box', 'arrow_pointer', 'spotlight',
  'label_pop', 'date_pop', 'caption_emphasis', 'number_counter',
];
export const CLIP_EFFECT_TYPES = ['zoom_to_region', 'crop_reveal', 'blur_to_focus', 'camera_shake', 'parallax'];
