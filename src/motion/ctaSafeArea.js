import { config } from '../config.js';

/**
 * CTA GÜVENLİ ALAN — saf, deterministik.
 *
 * CTA kartının ekranda nereye oturacağını hesaplar; kaçınılan bölgeler:
 *  - altyazı bandı (captionMarginV + tahmini yükseklik)
 *  - alt platform UI bandı (captionBottomSafePx)
 *  - sağ taraftaki Shorts aksiyon ikonları şeridi
 *  - üst hook/başlık bölgesi
 *  - varsa yüz/ana konu bounding box
 * Uygun yer yoksa null döner → CTA görseli kapatmaz, güvenle atlanır.
 */

const DEFAULTS = {
  width: 1080,
  height: 1920,
  cardW: 384,
  cardH: 112,
  margin: 56, // kenar boşluğu
  rightStrip: 150, // Shorts sağ ikon şeridi
  hookBottom: 470, // üst hook bölgesi
  captionBandHeight: 170, // altyazının kapladığı dikey bant (2 satır + pay)
};

/** İki dikdörtgen kesişiyor mu (üst-sol köşe + genişlik/yükseklik). */
function intersects(a, b) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

/**
 * Kaçınılan bölgeler (ADLANDIRILMIŞ) — hem yerleşim hem render sonrası CTA
 * çıktı doğrulaması aynı gerçeği kullansın diye tek kaynaktan üretilir.
 * @returns {Array<{name:string,x:number,y:number,w:number,h:number}>}
 */
export function avoidZones(opts = {}) {
  const d = { ...DEFAULTS, ...opts };
  const { width, height, rightStrip, hookBottom, captionBandHeight } = d;
  const captionMarginV = opts.captionMarginV ?? config.video.captionMarginV ?? 460;
  const bottomSafe = opts.bottomSafePx ?? config.retention.captionBottomSafePx ?? 220;
  const captionTop = height - captionMarginV - captionBandHeight;
  const zones = [
    { name: 'hook', x: 0, y: 0, w: width, h: hookBottom },
    { name: 'caption', x: 0, y: captionTop, w: width, h: captionBandHeight },
    { name: 'bottom-ui', x: 0, y: height - bottomSafe, w: width, h: bottomSafe },
    { name: 'right-icon-strip', x: width - rightStrip, y: 0, w: rightStrip, h: height },
  ];
  if (opts.subjectBox) zones.push({ name: 'subject', ...opts.subjectBox });
  return zones;
}

/**
 * @param {object} opts
 * @param {string} [opts.position] bottom_left|bottom_center|lower_third_left|
 *   lower_third_right|center_left|auto
 * @param {number} [opts.captionMarginV] altyazı alt boşluğu (config'ten)
 * @param {{x,y,w,h}} [opts.subjectBox] yüz/ana konu (opsiyonel)
 * @param {number} [opts.outroStartSec] outro başlangıcı (görsel değil, zaman — burada kullanılmaz)
 * @returns {{position:string, x:number, y:number, w:number, h:number}|null}
 */
export function computeSafeArea(opts = {}) {
  const d = { ...DEFAULTS, ...opts };
  const { width, height, cardW, cardH, margin, rightStrip, hookBottom, captionBandHeight } = d;
  const captionMarginV = opts.captionMarginV ?? config.video.captionMarginV ?? 460;
  const bottomSafe = opts.bottomSafePx ?? config.retention.captionBottomSafePx ?? 220;

  // Kaçınılacak bölgeler — render sonrası doğrulama ile TEK kaynaktan.
  const captionTop = height - captionMarginV - captionBandHeight;
  const avoid = avoidZones(opts);

  // Aday konumlar (üst-sol köşe).
  const leftX = margin;
  const rightX = width - rightStrip - cardW - margin;
  const centerX = Math.round((width - cardW) / 2);
  const candidates = {
    lower_third_left: { x: leftX, y: Math.round(height * 0.60) - cardH },
    bottom_left: { x: leftX, y: captionTop - cardH - 20 },
    center_left: { x: leftX, y: Math.round(height * 0.46) },
    lower_third_right: { x: rightX, y: Math.round(height * 0.60) - cardH },
    bottom_center: { x: centerX, y: hookBottom + 40 },
  };

  const order = opts.position && opts.position !== 'auto'
    ? [opts.position]
    : ['lower_third_left', 'bottom_left', 'center_left', 'lower_third_right'];

  for (const pos of order) {
    const c = candidates[pos];
    if (!c) continue;
    const box = { x: c.x, y: c.y, w: cardW, h: cardH };
    // Ekran içinde mi + hiçbir yasak bölgeyle çakışmıyor mu?
    if (box.x < margin || box.y < hookBottom) continue;
    if (box.x + box.w > width - margin || box.y + box.h > height - bottomSafe) continue;
    if (avoid.some((a) => intersects(box, a))) continue;
    return { position: pos, ...box };
  }
  return null; // güvenli yer yok → CTA atlanır
}
