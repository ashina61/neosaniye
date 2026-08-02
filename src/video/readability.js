/**
 * OKUNABİLİRLİK MODELİ — saf, deterministik.
 *
 * "fontSize ≥ 52" tek başına yetmez: asıl soru telefonda GERÇEK görünür
 * boyut ve kontrast. Bu modül render'ın kullandığı font matematiğini birebir
 * yansıtır ve 360x640 mobil ön izlemedeki görünür piksel yüksekliğini hesaplar.
 * Gerçek kare piksel analizi (OCR) yerine deterministik model kullanılır —
 * böylece QC tekrarlanabilir kalır ve render ile ayrışmaz.
 */

const PREVIEW_H = 640; // referans mobil ön izleme yüksekliği
const SCREEN_H = 1920;
const MARGIN_H = 90;

/** 1080x1920 render fontunu 360x640 ön izlemedeki görünür piksele indir. */
export function previewPx(fontPx, screenH = SCREEN_H, previewH = PREVIEW_H) {
  return +((fontPx * previewH) / screenH).toFixed(1);
}

/** Render'daki hook font boyutu (renderVideo ile AYNI formül). */
export function hookFontPx(hookText, width = 1080) {
  const raw = String(hookText || '').trim();
  const usableW = width - 2 * MARGIN_H;
  const factor = 0.62; // Montserrat Black büyük-harf ortalama genişlik
  let hfs = 104;
  if (raw.length * factor * hfs > 2 * usableW) {
    hfs = Math.max(60, Math.floor((2 * usableW) / (raw.length * factor)));
  }
  return hfs;
}

/**
 * Hook okunabilirliği: mobil ön izlemede görünür boyut + kelime yoğunluğu.
 * Kontrast render tarafında opak zemin kutusuyla (BorderStyle 3) yapısal
 * olarak garanti; burada boyut ve yoğunluk ölçülür.
 * @returns {{previewPx:number, words:number, ok:boolean, reasons:string[]}}
 */
export function assessHookReadability(hookText, {
  minPreviewPx = 20,
  maxWords = 7,
  hasContrastBox = true,
  width = 1080,
} = {}) {
  const words = String(hookText || '').trim().split(/\s+/).filter(Boolean).length;
  const pv = previewPx(hookFontPx(hookText, width));
  const reasons = [];
  if (pv < minPreviewPx) reasons.push(`hook ön izlemede ${pv}px (< ${minPreviewPx}px) — telefonda küçük`);
  if (words > maxWords) reasons.push(`hook ${words} kelime (> ${maxWords}) — ilk bakışta okunmaz`);
  if (!hasContrastBox) reasons.push('hook yüksek kontrast zemini yok');
  return { previewPx: pv, words, ok: reasons.length === 0, reasons };
}

/**
 * Altyazı okunabilirliği: güvenli alan içinde OLSA BİLE görünür boyut düşükse
 * yakalanır. minFontPx render'da fiilen kullanılan en küçük altyazı fontudur
 * (captionLayout'tan gelir).
 * @returns {{previewPx:number, ok:boolean, hasStroke:boolean, reason:string|null}}
 */
export function assessCaptionReadability({
  minFontPx,
  outlinePx = 2.6,
  minPreviewPx = 15,
  minStrokePx = 2.0,
} = {}) {
  const pv = previewPx(minFontPx ?? 0);
  const hasStroke = outlinePx >= minStrokePx;
  let reason = null;
  if (pv < minPreviewPx) reason = `altyazı ön izlemede ${pv}px (< ${minPreviewPx}px) — küçük`;
  else if (!hasStroke) reason = `altyazı kenarlığı ${outlinePx}px (< ${minStrokePx}px) — düşük kontrast`;
  return { previewPx: pv, hasStroke, ok: reason === null, reason };
}
