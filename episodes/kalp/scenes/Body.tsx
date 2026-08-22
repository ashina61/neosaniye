import React from 'react';

/**
 * GÖVDE, İSKELET VE DOLAŞIM AĞACI — hepsi kod.
 *
 * Giriş bir yakın plan değil, bir YOLCULUK: insan görünür, derisi çekilir,
 * göğüs kafesi çıkar, kafesin arkasında kalp zaten atıyordur. O yüzden bunlar
 * kalple AYNI dünyada çizilir; kamera içeri girerken hiçbir şey yeniden
 * konumlanmaz, sadece yaklaşılır. Kesitler arası sıçrama olsaydı izleyen her
 * sahnede şemayı yeniden öğrenirdi.
 *
 * Koordinatlar gövdenin kendi 1080x1920 alanıdır; kalp uzayına yerleşimi
 * index.tsx içindeki tek bir transform ile yapılır.
 */

const SPINE_X = 540;

/** Kaburga çifti: omurdan çıkar, yana açılır, öne ve aşağı kıvrılıp sternuma iner. */
function rib(i: number, side: 1 | -1) {
  const y0 = 452 + i * 40;
  const spread = 168 + i * 15 - Math.max(0, i - 8) * 34;
  const drop = 62 + i * 9;
  const sx = SPINE_X + side * 16;
  const lateralX = SPINE_X + side * spread;
  const endX = SPINE_X + side * (52 + i * 3.2);
  const endY = y0 + drop + 42;
  return (
    `M ${sx} ${y0} ` +
    `C ${sx + side * spread * 0.62} ${y0 - 12}, ${lateralX} ${y0 + drop * 0.34}, ${lateralX} ${y0 + drop} ` +
    `C ${lateralX} ${y0 + drop + 70}, ${endX + side * 78} ${endY + 22}, ${endX} ${endY}`
  );
}

/** Kaburgaya bağlanan kıkırdak — sternuma inen kısa, açık renk parça. */
function cartilage(i: number, side: 1 | -1) {
  const y0 = 452 + i * 40;
  const drop = 62 + i * 9;
  const endX = SPINE_X + side * (52 + i * 3.2);
  const endY = y0 + drop + 42;
  const stern = SPINE_X + side * 22;
  const sy = 520 + i * 34;
  return `M ${endX} ${endY} C ${endX - side * 26} ${endY + 10}, ${stern + side * 26} ${sy + 16}, ${stern} ${sy}`;
}

export const Skeleton: React.FC<{opacity: number; bone: string; boneDim: string}> = ({opacity, bone, boneDim}) => (
  <g opacity={opacity}>
    {/* Kafatası ve çene */}
    <path
      d="M 540 96 C 452 96, 400 168, 404 254 C 406 306, 424 344, 452 366 L 452 404 C 452 424, 486 438, 540 438 C 594 438, 628 424, 628 404 L 628 366 C 656 344, 674 306, 676 254 C 680 168, 628 96, 540 96 Z"
      fill={boneDim}
      stroke={bone}
      strokeWidth={5}
    />
    <ellipse cx={496} cy={252} rx={26} ry={30} fill="#0d0c0b" opacity={0.75} />
    <ellipse cx={584} cy={252} rx={26} ry={30} fill="#0d0c0b" opacity={0.75} />

    {/* Omurga — boyun, sırt, bel */}
    {Array.from({length: 22}).map((_, i) => (
      <rect
        key={i}
        x={SPINE_X - 26 - (i > 12 ? 6 : 0)}
        y={392 + i * 34}
        width={52 + (i > 12 ? 12 : 0)}
        height={24}
        rx={9}
        fill={boneDim}
        stroke={bone}
        strokeWidth={3.5}
      />
    ))}

    {/* Köprücük kemikleri */}
    <path d="M 540 470 C 470 452, 400 448, 322 470" fill="none" stroke={bone} strokeWidth={18} strokeLinecap="round" />
    <path d="M 540 470 C 610 452, 680 448, 758 470" fill="none" stroke={bone} strokeWidth={18} strokeLinecap="round" />

    {/* Kürek kemikleri */}
    <path d="M 318 496 C 268 540, 262 640, 306 700 L 356 640 C 330 596, 330 540, 350 508 Z" fill={boneDim} stroke={bone} strokeWidth={4} />
    <path d="M 762 496 C 812 540, 818 640, 774 700 L 724 640 C 750 596, 750 540, 730 508 Z" fill={boneDim} stroke={bone} strokeWidth={4} />

    {/* Sternum: manubrium, gövde, ksifoid */}
    <path
      d="M 508 486 L 572 486 L 566 556 L 560 800 C 560 830, 520 830, 520 800 L 514 556 Z"
      fill={boneDim}
      stroke={bone}
      strokeWidth={4.5}
    />
    <path d="M 528 830 C 528 862, 552 862, 552 830 L 546 806 L 534 806 Z" fill={boneDim} stroke={bone} strokeWidth={4} />

    {/* On iki kaburga çifti + kıkırdakları */}
    {Array.from({length: 12}).map((_, i) => (
      <g key={i}>
        <path d={rib(i, 1)} fill="none" stroke={bone} strokeWidth={i > 9 ? 9 : 13} strokeLinecap="round" />
        <path d={rib(i, -1)} fill="none" stroke={bone} strokeWidth={i > 9 ? 9 : 13} strokeLinecap="round" />
        {i < 10 ? (
          <>
            <path d={cartilage(i, 1)} fill="none" stroke={boneDim} strokeWidth={10} strokeLinecap="round" opacity={0.9} />
            <path d={cartilage(i, -1)} fill="none" stroke={boneDim} strokeWidth={10} strokeLinecap="round" opacity={0.9} />
          </>
        ) : null}
      </g>
    ))}

    {/* Leğen kemiği ve sakrum */}
    <path
      d="M 540 1150 C 460 1140, 372 1160, 350 1216 C 330 1268, 356 1340, 412 1372 C 452 1394, 486 1380, 500 1344 L 540 1300 Z"
      fill={boneDim}
      stroke={bone}
      strokeWidth={5}
    />
    <path
      d="M 540 1150 C 620 1140, 708 1160, 730 1216 C 750 1268, 724 1340, 668 1372 C 628 1394, 594 1380, 580 1344 L 540 1300 Z"
      fill={boneDim}
      stroke={bone}
      strokeWidth={5}
    />

    {/* Kollar ve bacaklar — uzun kemikler */}
    {[
      'M 322 486 C 292 596, 282 700, 292 792',
      'M 758 486 C 788 596, 798 700, 788 792',
      'M 292 800 C 282 890, 276 966, 282 1042',
      'M 788 800 C 798 890, 804 966, 798 1042',
      'M 452 1360 C 436 1500, 430 1610, 440 1700',
      'M 628 1360 C 644 1500, 650 1610, 640 1700',
      'M 440 1710 C 432 1790, 430 1846, 436 1892',
      'M 640 1710 C 648 1790, 650 1846, 644 1892',
    ].map((p, i) => (
      <path key={i} d={p} fill="none" stroke={bone} strokeWidth={i < 4 ? 22 : 26} strokeLinecap="round" opacity={0.92} />
    ))}
  </g>
);

/** Gövde silüeti — derinin kendisi, içerisi görünsün diye yarı saydam. */
export const Figure: React.FC<{opacity: number; fill: string; edge: string}> = ({opacity, fill, edge}) => (
  <g opacity={opacity}>
    <path
      d={
        'M 540 60 C 452 60, 396 140, 400 240 C 402 300, 424 348, 452 372 ' +
        'C 452 410, 430 428, 372 448 C 300 472, 268 512, 262 586 ' +
        'C 254 700, 250 860, 258 1004 C 262 1064, 274 1092, 288 1104 ' +
        'C 284 1180, 296 1260, 318 1330 C 340 1400, 366 1470, 392 1560 ' +
        'C 414 1640, 424 1740, 428 1860 L 512 1860 C 512 1740, 508 1640, 514 1560 ' +
        'C 520 1470, 532 1400, 540 1348 C 548 1400, 560 1470, 566 1560 ' +
        'C 572 1640, 568 1740, 568 1860 L 652 1860 C 656 1740, 666 1640, 688 1560 ' +
        'C 714 1470, 740 1400, 762 1330 C 784 1260, 796 1180, 792 1104 ' +
        'C 806 1092, 818 1064, 822 1004 C 830 860, 826 700, 818 586 ' +
        'C 812 512, 780 472, 708 448 C 650 428, 628 410, 628 372 ' +
        'C 656 348, 678 300, 680 240 C 684 140, 628 60, 540 60 Z'
      }
      fill={fill}
      stroke={edge}
      strokeWidth={6}
    />
  </g>
);

/**
 * DOLAŞIM AĞACI — kanın vücuda dağıldığı yer.
 *
 * Kalpten çıkan aort aşağı iner, iliak arterlere ayrılır, bacaklara gider;
 * yukarıda karotisler başa, subklavyenler kollara. Dönüş mavi, aynı yolun
 * yanından. Bu ağaç olmadan "tüm vücuda dağılır" cümlesinin resmi yok.
 */
export const ARTERIES: string[] = [
  // aort: kavisten aşağı, karın boyunca
  'M 566 700 C 574 900, 570 1050, 560 1160',
  // iliak → femoral → bacak
  'M 560 1160 C 540 1230, 500 1300, 476 1400 C 452 1500, 444 1640, 444 1800',
  'M 560 1160 C 588 1230, 620 1300, 640 1400 C 662 1500, 660 1640, 652 1800',
  // karotisler ve boyun
  'M 566 606 C 560 540, 556 480, 552 420 C 548 360, 546 300, 548 250',
  'M 566 606 C 586 540, 596 480, 600 420 C 604 360, 604 300, 600 250',
  // subklavyen → kol
  'M 566 606 C 640 570, 700 520, 746 486 C 780 560, 792 700, 788 800 C 784 900, 780 980, 784 1046',
  'M 540 606 C 466 570, 406 520, 360 486 C 326 560, 314 700, 318 800 C 322 900, 326 980, 322 1046',
];

export const VEINS: string[] = [
  'M 508 700 C 500 900, 504 1050, 514 1160',
  'M 514 1160 C 496 1230, 462 1300, 440 1400 C 418 1500, 410 1640, 410 1800',
  'M 514 1160 C 542 1230, 574 1300, 594 1400 C 616 1500, 614 1640, 606 1800',
  'M 508 606 C 502 540, 498 480, 494 420 C 490 360, 488 300, 490 250',
  'M 508 606 C 440 570, 386 520, 340 486 C 306 560, 294 700, 298 800',
];

/** Akciğer — üç loblu sağ, iki loblu sol; ortada kalbin oturduğu çentik. */
export const LUNG_RIGHT =
  'M 452 470 C 372 466, 316 520, 300 610 C 282 712, 296 852, 326 946 ' +
  'C 350 1020, 396 1052, 440 1030 C 470 1014, 480 940, 482 852 ' +
  'C 484 740, 478 580, 472 512 Z';
export const LUNG_LEFT =
  'M 628 470 C 708 466, 764 520, 780 610 C 798 712, 784 852, 754 946 ' +
  'C 730 1020, 684 1052, 640 1030 C 626 1000, 630 940, 612 900 ' +
  'C 600 872, 606 800, 604 720 C 602 620, 612 520, 620 500 Z';
/** Bronş ağacı: trakea, iki ana bronş, dallar. */
export const BRONCHI: string[] = [
  'M 540 400 L 540 500',
  'M 540 500 C 512 512, 470 528, 436 556',
  'M 540 500 C 568 512, 610 528, 644 556',
  'M 436 556 C 412 588, 396 626, 388 668',
  'M 436 556 C 424 600, 420 650, 424 700',
  'M 644 556 C 668 588, 684 626, 692 668',
  'M 644 556 C 656 600, 660 650, 656 700',
];
