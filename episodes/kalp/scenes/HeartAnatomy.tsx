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

/**
 * Kalbin dış hattı. Yumurta DEĞİL: tabanı geniş, sağ kenarı kulakçık
 * tümseğiyle şişkin, alt kenarı apekse doğru süpüren, ve ucu SİVRİ. Apeks
 * aşağı ve hastanın soluna bakar — kalp göğüste dik durmaz, yatık durur, ve
 * ilk sürümdeki yuvarlak alt kenar bunu tamamen kaybediyordu.
 */
export const OUTLINE =
  'M 296 536 C 214 540, 168 626, 172 742 C 176 852, 208 938, 258 998 ' +
  'C 316 1170, 430 1350, 566 1462 C 610 1500, 664 1508, 700 1466 ' +
  'C 806 1338, 878 1160, 900 990 C 922 856, 916 690, 872 616 ' +
  'C 828 546, 700 528, 596 536 C 496 544, 372 528, 296 536 Z';

/**
 * İNTERVENTRİKÜLER SEPTUM — iki karıncığı ayıran kalın duvar.
 *
 * İlk sürümde hiç yoktu ve iki boşluk yan yana duruyordu; septum olmadan
 * "sağ taraf ve sol taraf" cümlesinin ARASINDA hiçbir şey yok demektir. Sol
 * karıncığa ait olduğu için kalındır ve sağa doğru hafif bombelidir.
 */
export const SEPTUM =
  'M 508 596 C 528 800, 556 1090, 600 1394 C 630 1416, 664 1400, 678 1372 ' +
  'C 630 1070, 596 800, 578 596 Z';

/** Sağ kulakçık boşluğu. İnce duvar, geniş boşluk. */
export const RA_CAVITY =
  'M 330 578 C 254 590, 206 660, 202 742 C 198 822, 232 882, 300 900 ' +
  'C 366 918, 434 900, 470 862 C 486 790, 484 682, 462 616 ' +
  'C 428 586, 380 570, 330 578 Z';

/** Sol kulakçık boşluğu. */
export const LA_CAVITY =
  'M 616 596 C 668 570, 748 572, 802 604 C 852 634, 868 704, 858 780 ' +
  'C 848 852, 806 894, 744 902 C 688 908, 636 886, 614 856 ' +
  'C 600 786, 600 664, 616 596 Z';

/**
 * Sağ karıncık boşluğu — hilal, çünkü septum içine doğru bombeli. Duvarı
 * İNCE: akciğere basar, yolu kısa, basıncı düşük.
 */
export const RV_CAVITY =
  'M 300 962 C 262 1032, 288 1150, 344 1240 C 396 1322, 462 1386, 516 1412 ' +
  'C 534 1330, 516 1120, 496 1000 C 470 962, 344 946, 300 962 Z';

/**
 * Sol karıncık boşluğu — küçük ve dar, ÇÜNKÜ ETRAFI KALIN. Dış hat ile bu
 * boşluk arasındaki mesafe sağ tarafın üç katıdır; sekizinci sahnenin bütün
 * derdi bu, ve bir cümleyle değil bu iki eğrinin arasındaki boşlukla anlatılır.
 */
export const LV_CAVITY =
  'M 636 984 C 610 1066, 620 1230, 652 1360 C 690 1330, 736 1210, 762 1080 ' +
  'C 776 1020, 760 984, 720 972 C 686 962, 652 966, 636 984 Z';

/**
 * AV HALKASI (annulus) — kulakçıkla karıncığın arasındaki lifli yüzük.
 *
 * Yaprakçıklar buna ASILIDIR. İlk sürümde havada duruyorlardı: kulakçığın
 * altında, karıncığın üstünde, ikisine de değmeyen iki yay. Kapak bir çizim
 * öğesi değil, iki odanın ARASINDAKİ kapıdır; bağlı olmadığı anda gösterdiği
 * şey de kalmaz.
 */
export const AV_RING_R = 'M 292 906 C 350 936, 430 940, 496 916 L 496 962 C 428 986, 348 982, 292 952 Z';
export const AV_RING_L = 'M 604 916 C 668 944, 748 942, 812 912 L 812 958 C 748 990, 668 992, 604 962 Z';

/**
 * ÇIKIŞ YOLLARI — damar kalbin YANINDAN geçmez, İÇİNDEN çıkar.
 *
 * Pulmoner trunkus sağ karıncığın konusundan, aort sol karıncığın tabanından
 * doğar. İlk sürümde ikisi de miyokardın arkasına çizilmişti, yani kalbin
 * yanında duran iki boru gibi okunuyordu — bütün dolaşım şemasının bağlandığı
 * yer tam da burasıydı.
 */
export const RV_OUTFLOW = 'M 352 1000 C 338 902, 356 834, 400 818 C 444 834, 460 902, 448 1000 Z';
export const LV_OUTFLOW = 'M 628 1010 C 618 912, 636 844, 678 828 C 720 844, 738 912, 726 1010 Z';

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
