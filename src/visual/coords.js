/**
 * GÖRSEL ANLATIM — KOORDİNAT SİSTEMİ (saf, deterministik).
 *
 * Tüm efekt koordinatları NORMALİZE tutulur (x,y,w,h ∈ 0..1). Burada 1080x1920
 * piksele çevrilir ve altyazı safe-area'sıyla çakışma otomatik düzeltilir.
 * Yanlış yere ok/daire çizmemek için: koordinat yoksa güvenli merkez döner.
 */

export const CANVAS = { w: 1080, h: 1920 };

/** Config'ten safe-area (normalize). Efekt bu banda GİRMEMELİ (ok/etiket/sayaç). */
export function safeArea(cfg = {}) {
  const s = cfg.subtitleSafeArea || {};
  return {
    top: num(s.top, 0.08),
    bottom: num(s.bottom, 0.25), // ekranın ALT %25'i altyazı bandı
    left: num(s.left, 0.06),
    right: num(s.right, 0.06),
  };
}

function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }
export function clamp01(v) { return Math.max(0, Math.min(1, Number(v) || 0)); }

/** Normalize nokta → piksel {x,y} (yuvarlanmış). */
export function toPx(nx, ny, canvas = CANVAS) {
  return { x: Math.round(clamp01(nx) * canvas.w), y: Math.round(clamp01(ny) * canvas.h) };
}

/** Normalize bölge → piksel {x,y,w,h}, tümü ekran içinde kalacak şekilde kırpılır. */
export function regionToPx(region = {}, canvas = CANVAS) {
  let x = clamp01(region.x);
  let y = clamp01(region.y);
  let w = clamp01(region.width);
  let h = clamp01(region.height);
  if (x + w > 1) w = 1 - x;
  if (y + h > 1) h = 1 - y;
  return {
    x: Math.round(x * canvas.w),
    y: Math.round(y * canvas.h),
    w: Math.max(1, Math.round(w * canvas.w)),
    h: Math.max(1, Math.round(h * canvas.h)),
  };
}

/**
 * Bir efekt noktasının altyazı bandına düşüp düşmediğini söyler (normalize y).
 * Alt banttaysa güvenli tavana çekilir; sol/sağ/üst kenar payları da uygulanır.
 * @returns {{x:number,y:number,collided:boolean}} düzeltilmiş normalize nokta
 */
export function avoidSubtitle(nx, ny, cfg = {}) {
  const sa = safeArea(cfg);
  let x = clamp01(nx);
  let y = clamp01(ny);
  let collided = false;
  const bottomLimit = 1 - sa.bottom; // bunun ALTI altyazı bölgesi
  if (y > bottomLimit) { y = bottomLimit - 0.02; collided = true; }
  if (y < sa.top) { y = sa.top + 0.02; collided = true; }
  if (x < sa.left) { x = sa.left; collided = true; }
  if (x > 1 - sa.right) { x = 1 - sa.right; collided = true; }
  return { x, y, collided };
}

/** Bir bölgenin altyazı bandıyla dikey çakışması var mı (QC + yerleşim için). */
export function regionHitsSubtitle(region = {}, cfg = {}) {
  const sa = safeArea(cfg);
  const bottomBandTop = 1 - sa.bottom;
  const rBottom = clamp01(region.y) + clamp01(region.height);
  return rBottom > bottomBandTop + 0.001;
}
