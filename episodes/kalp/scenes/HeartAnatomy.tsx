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

/**
 * LÜMEN — KANIN BOŞLUĞU, TEK PARÇA.
 *
 * Önceki sürümde kulakçık, karıncık, halka ve çıkış yolu AYRI şekillerdi ve
 * aralarında miyokard kalıyordu: kapaklar havada duran iki yay, çıkış yolları
 * ortada duran iki kâse gibi okunuyordu. Kan bir odadan diğerine geçiyorsa
 * aralarında BOŞLUK vardır; o boşluk tek bir kapalı yoldur ve kopması imkânsız
 * olmalıdır.
 *
 * Her yol, o tarafın bütün kan yolunu dolaşır: kulakçığın duvarı boyunca iner,
 * AV deliğinden karıncığa geçer, apekse kadar iner, karşı duvardan çıkar ve
 * çıkış yolundan damar köküne yükselir. Kapaklar bu yolun DARALDIĞI iki yere
 * çizilir — yani ait oldukları yere, tanımı gereği.
 */
export const RIGHT_LUMEN =
  'M 300 950 C 262 1032, 288 1150, 344 1240 C 396 1322, 462 1386, 516 1412 ' +
  'C 534 1330, 522 1130, 512 1020 ' +
  'C 524 986, 528 906, 524 846 C 520 826, 502 818, 490 818 ' +
  'C 476 818, 460 828, 458 848 C 452 906, 450 962, 448 990 ' +
  'C 442 962, 436 930, 430 900 C 476 830, 486 690, 462 616 ' +
  'C 428 586, 380 570, 330 578 C 254 590, 202 660, 202 742 ' +
  'C 198 822, 232 882, 300 900 Z';

export const LEFT_LUMEN =
  'M 604 986 C 594 1080, 620 1240, 652 1360 C 692 1330, 738 1208, 764 1078 ' +
  'C 780 1014, 774 980, 750 966 C 748 940, 748 918, 750 900 ' +
  'C 810 892, 852 850, 862 778 C 872 702, 854 632, 802 602 ' +
  'C 746 570, 664 570, 614 598 C 598 666, 598 788, 612 858 ' +
  'C 632 888, 654 898, 676 900 C 678 930, 676 958, 672 980 ' +
  'C 668 950, 664 890, 660 848 C 658 828, 644 818, 630 818 ' +
  'C 616 818, 604 828, 602 848 C 598 890, 600 946, 604 986 Z';

/** Kulakçık ve karıncığın AYRI vurgulanabilmesi için aynı yolun parçaları. */
export const RA_CAVITY =
  'M 300 900 C 232 882, 198 822, 202 742 C 202 660, 254 590, 330 578 ' +
  'C 380 570, 428 586, 462 616 C 486 690, 476 830, 430 900 Z';
export const LA_CAVITY =
  'M 676 900 C 654 898, 632 888, 612 858 C 598 788, 598 666, 614 598 ' +
  'C 664 570, 746 570, 802 602 C 854 632, 872 702, 862 778 ' +
  'C 852 850, 810 892, 750 900 Z';
export const RV_CAVITY =
  'M 300 950 C 262 1032, 288 1150, 344 1240 C 396 1322, 462 1386, 516 1412 ' +
  'C 534 1330, 520 1120, 506 1010 L 430 950 Z';
export const LV_CAVITY =
  'M 596 966 C 592 1064, 618 1240, 652 1360 C 692 1330, 738 1208, 764 1078 ' +
  'C 780 1014, 774 980, 750 966 Z';

/**
 * ÇIKIŞ YOLLARI artık şekil değil, lümenin kendi kolları — ayrı kâse yok.
 * Kalanı yalnız damar kökünün nereye oturduğunu söyler.
 */
/**
 * AV HALKASI — kulakçıkla karıncığın arasındaki lifli yüzük. Lümen tam burada
 * daralır; yaprakçıklar da buraya asılır, çünkü kapı budur.
 */
export const AV_RING_R = 'M 292 890 C 340 914, 400 916, 438 890 L 438 956 C 398 978, 340 976, 292 952 Z';
export const AV_RING_L = 'M 664 890 C 698 914, 730 916, 760 890 L 760 956 C 730 978, 698 978, 664 956 Z';

export const PULM_ROOT = {x: 490, y: 834, r: 38};
export const AORTIC_ROOT = {x: 630, y: 830, r: 30};

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
