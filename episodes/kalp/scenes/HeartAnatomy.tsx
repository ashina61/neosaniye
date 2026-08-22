import React from 'react';

/**
 * KALP — KORONAL KESİT, ELDE ÇİZİLMİŞ.
 *
 * Kutu değil. Anlatılan şey kanın kalbin İÇİNDEN geçmesi, ve dikdörtgenlerin
 * içi yoktur: septum, kapak yaprakçıkları, papiller kaslar, korda telleri ve
 * trabeküller olmadan "kapak geri akışı durdurur" cümlesinin gösterecek bir
 * şeyi kalmaz.
 *
 * Görüş ÖNDEN (anterior): hastanın SAĞI resmin SOLUNDA. Kesit önden alınmış,
 * yani dört boşluk da açık duruyor — kanın izlediği yol tek bir çizimde
 * görünür, ki bu şeklin var olma sebebi budur.
 *
 * Ölçüler kare 1080x1920 içindir ve elle yerleştirilmiştir; her eğri bir
 * anatomik sınırdır, süs değil:
 *   sol karıncık duvarı sağınkinin üç katı  — cümlenin kendisi
 *   apeks aşağı ve hastanın soluna bakar    — kalp dik durmaz, yatık durur
 *   kulakçıklar ince, karıncıklar kalın     — basınç farkı budur
 */

export const RED = '#c2312c';
export const RED_DARK = '#8e2320';
export const BLUE = '#3f6f9f';
export const BLUE_DARK = '#2b4f74';
export const MYO = '#a8564a';
export const MYO_DARK = '#6f3a34';
export const MYO_LIGHT = '#c9756a';
export const ENDO = '#f2d9cf';

/** Kalbin dış hattı — kulakçık tümsekleri, AV oluğu ve apeks. */
export const OUTLINE =
  'M 318 560 C 232 556, 168 636, 174 742 C 180 848, 214 906, 262 934 ' +
  'C 236 1006, 262 1130, 330 1236 C 396 1338, 494 1418, 596 1440 ' +
  'C 706 1420, 806 1300, 848 1160 C 884 1040, 878 962, 852 930 ' +
  'C 896 890, 906 780, 878 690 C 850 600, 780 556, 700 566 ' +
  'C 620 576, 560 566, 500 556 C 440 546, 372 562, 318 560 Z';

/** Sağ kulakçık boşluğu. İnce duvar, geniş boşluk. */
export const RA_CAVITY =
  'M 300 600 C 232 606, 206 676, 212 754 C 218 830, 254 886, 314 900 ' +
  'C 380 914, 452 904, 494 884 C 512 812, 512 690, 494 616 ' +
  'C 430 596, 360 594, 300 600 Z';

/** Sol kulakçık boşluğu. */
export const LA_CAVITY =
  'M 586 612 C 640 592, 726 586, 786 610 C 846 634, 866 714, 856 786 ' +
  'C 846 858, 802 894, 740 900 C 678 906, 616 892, 588 872 ' +
  'C 572 800, 570 686, 586 612 Z';

/** Sağ karıncık boşluğu — hilal, çünkü septum içine doğru bombeli. */
export const RV_CAVITY =
  'M 300 962 C 262 1030, 282 1152, 342 1236 C 396 1310, 470 1362, 528 1372 ' +
  'C 544 1300, 536 1140, 520 1010 C 502 966, 480 950, 440 946 ' +
  'C 388 940, 330 944, 300 962 Z';

/** Sol karıncık boşluğu — koni, ve etrafındaki duvar üç kat kalın. */
export const LV_CAVITY =
  'M 620 968 C 592 1046, 590 1200, 606 1320 C 624 1352, 664 1346, 692 1310 ' +
  'C 740 1246, 776 1122, 782 1010 C 760 968, 700 952, 620 968 Z';

/** Kapak yaprakçığı: kapalıyken düz, açıkken duvara yapışır. */
export function leaflet(x: number, y: number, span: number, drop: number, open: number, flip = 1) {
  const tipX = x + flip * span * (0.15 + open * 0.86);
  const tipY = y + drop * (1 - open * 0.72);
  const cx1 = x + flip * span * 0.12;
  const cy1 = y + drop * 0.72;
  return `M ${x} ${y} C ${cx1} ${cy1}, ${tipX - flip * span * 0.1} ${tipY}, ${tipX} ${tipY}`;
}

/** Papiller kas — karıncık duvarından kalkan koni. */
export function papillary(x: number, y: number, w: number, h: number, squeeze: number) {
  const k = 1 - squeeze * 0.18;
  return `M ${x - w / 2} ${y} C ${x - w / 2} ${y - h * 0.5 * k}, ${x - w * 0.22} ${y - h * k}, ${x} ${y - h * k} ` +
    `C ${x + w * 0.22} ${y - h * k}, ${x + w / 2} ${y - h * 0.5 * k}, ${x + w / 2} ${y} Z`;
}

/** Trabeküller — karıncık iç yüzeyindeki et köprüleri. Doku, süs değil. */
export const TRABECULAE_RV = [
  'M 322 1030 C 356 1046, 392 1042, 424 1022',
  'M 316 1096 C 352 1118, 398 1120, 436 1104',
  'M 340 1164 C 374 1188, 420 1196, 458 1184',
  'M 380 1236 C 412 1262, 452 1276, 486 1272',
];
export const TRABECULAE_LV = [
  'M 640 1040 C 672 1058, 706 1054, 736 1032',
  'M 630 1112 C 664 1134, 700 1136, 730 1118',
  'M 636 1188 C 668 1212, 700 1216, 726 1200',
];

/** Korda tendineler — papiller kastan yaprakçık ucuna giden teller. */
export function chordae(fromX: number, fromY: number, toX: number, toY: number, n = 4, spread = 26) {
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const sx = fromX + (t - 0.5) * spread;
    out.push(`M ${sx} ${fromY} C ${sx} ${fromY - 30}, ${toX + (t - 0.5) * spread * 1.6} ${toY + 26}, ${toX + (t - 0.5) * spread * 1.6} ${toY}`);
  }
  return out;
}

/** Yarım ay kapağı (aort ve pulmoner): üç cep, kasılmada açılır. */
export function semilunar(cx: number, cy: number, r: number, open: number) {
  const drop = r * (1 - open) * 0.9;
  return [
    `M ${cx - r} ${cy} C ${cx - r * 0.6} ${cy + drop}, ${cx - r * 0.2} ${cy + drop}, ${cx} ${cy}`,
    `M ${cx} ${cy} C ${cx + r * 0.2} ${cy + drop}, ${cx + r * 0.6} ${cy + drop}, ${cx + r} ${cy}`,
  ];
}
