import React from 'react';

/**
 * GÖVDE, İSKELET VE DOLAŞIM AĞACI.
 *
 * İlk sürümde kaburgalar sayılamıyordu: on iki çift çizilmişti ama her çiftin
 * yanında bir de kıkırdak vardı ve hepsi aynı kalınlıkta, aynı renkteydi —
 * ekranda otuz küsur çubuk. İnsanın on iki çift kaburgası vardır ve bir
 * çizimde SAYILABİLMELİDİR; kıkırdak ince ve sönük, kemik kalın ve parlak.
 */

const SPINE_X = 540;

/** On iki çiftin her biri: omurdan çıkar, yanı sarar, öne ve aşağı kıvrılır. */
function rib(i: number, side: 1 | -1) {
  const y0 = 470 + i * 34;
  // Kafes yukarıdan aşağı önce genişler, sonra daralır — göğüs fıçı biçimidir.
  const bulge = Math.sin(((i + 1.2) / 13) * Math.PI);
  const spread = 96 + bulge * 138;
  const drop = 40 + i * 12;
  const sx = SPINE_X + side * 14;
  const lat = SPINE_X + side * spread;
  const endX = SPINE_X + side * (40 + i * 4.5);
  const endY = y0 + drop + 46;
  return (
    `M ${sx} ${y0} C ${sx + side * spread * 0.66} ${y0 - 8}, ${lat} ${y0 + drop * 0.4}, ${lat} ${y0 + drop} ` +
    `C ${lat} ${y0 + drop + 62}, ${endX + side * 74} ${endY + 18}, ${endX} ${endY}`
  );
}

/** Kıkırdak: kemiğin ucundan sternuma. İnce ve sönük, yoksa kaburga sayılır. */
function cartilage(i: number, side: 1 | -1) {
  const y0 = 470 + i * 34;
  const drop = 40 + i * 12;
  const endX = SPINE_X + side * (40 + i * 4.5);
  const endY = y0 + drop + 46;
  const stern = SPINE_X + side * 16;
  const sy = 528 + i * 30;
  return `M ${endX} ${endY} C ${endX - side * 20} ${endY + 6}, ${stern + side * 22} ${sy + 14}, ${stern} ${sy}`;
}

export const Skeleton: React.FC<{opacity: number; bone: string; boneDim: string}> = ({opacity, bone, boneDim}) => (
  <g opacity={opacity}>
    {/* Kafatası: kubbe, göz çukurları, elmacık ve çene — iki yuvarlak delik değil */}
    <path
      d="M 540 108 C 462 108, 412 168, 410 246 C 408 300, 424 340, 448 362 
         C 452 388, 460 402, 476 410 C 492 428, 514 438, 540 438 
         C 566 438, 588 428, 604 410 C 620 402, 628 388, 632 362 
         C 656 340, 672 300, 670 246 C 668 168, 618 108, 540 108 Z"
      fill={boneDim}
      stroke={bone}
      strokeWidth={5}
    />
    <path d="M 470 236 C 470 214, 494 206, 508 216 C 520 224, 518 254, 504 264 C 488 274, 470 260, 470 236 Z" fill="#0d0c0b" opacity={0.82} />
    <path d="M 610 236 C 610 214, 586 206, 572 216 C 560 224, 562 254, 576 264 C 592 274, 610 260, 610 236 Z" fill="#0d0c0b" opacity={0.82} />
    <path d="M 540 268 L 528 302 L 552 302 Z" fill="#0d0c0b" opacity={0.7} />
    {/* Üst çene ve diş sırası. Tek bir kavisli çizgi GÜLÜMSEME olarak okunuyordu. */}
    <path d="M 488 342 L 592 342" fill="none" stroke="#0d0c0b" strokeWidth={4} opacity={0.45} />
    {Array.from({length: 7}).map((_, i) => (
      <path key={i} d={`M ${494 + i * 15} 342 L ${494 + i * 15} 356`} stroke="#0d0c0b" strokeWidth={3} opacity={0.4} />
    ))}

    {/* Omurga */}
    {Array.from({length: 21}).map((_, i) => (
      <rect
        key={i}
        x={SPINE_X - 22 - (i > 12 ? 6 : 0)}
        y={432 + i * 33}
        width={44 + (i > 12 ? 12 : 0)}
        height={22}
        rx={8}
        fill={boneDim}
        stroke={bone}
        strokeWidth={3}
      />
    ))}

    {/* Köprücük ve kürek */}
    <path d="M 528 486 C 466 470, 402 466, 336 484" fill="none" stroke={bone} strokeWidth={16} strokeLinecap="round" />
    <path d="M 552 486 C 614 470, 678 466, 744 484" fill="none" stroke={bone} strokeWidth={16} strokeLinecap="round" />
    <path d="M 330 502 C 288 542, 284 622, 320 674 L 362 622 C 342 584, 342 540, 358 512 Z" fill={boneDim} stroke={bone} strokeWidth={4} />
    <path d="M 750 502 C 792 542, 796 622, 760 674 L 718 622 C 738 584, 738 540, 722 512 Z" fill={boneDim} stroke={bone} strokeWidth={4} />

    {/* Sternum */}
    <path d="M 512 492 L 568 492 L 562 552 L 556 790 C 556 816, 524 816, 524 790 L 518 552 Z" fill={boneDim} stroke={bone} strokeWidth={4} />
    <path d="M 530 816 C 530 846, 550 846, 550 816 L 545 796 L 535 796 Z" fill={boneDim} stroke={bone} strokeWidth={3.5} />

    {/* ON İKİ ÇİFT. Kıkırdak önce ve sönük çizilir ki kemik sayılabilsin. */}
    {Array.from({length: 12}).map((_, i) =>
      i < 10 ? (
        <g key={`c${i}`} opacity={0.45}>
          <path d={cartilage(i, 1)} fill="none" stroke={boneDim} strokeWidth={7} strokeLinecap="round" />
          <path d={cartilage(i, -1)} fill="none" stroke={boneDim} strokeWidth={7} strokeLinecap="round" />
        </g>
      ) : null,
    )}
    {Array.from({length: 12}).map((_, i) => (
      <g key={`r${i}`}>
        <path d={rib(i, 1)} fill="none" stroke={bone} strokeWidth={i > 9 ? 8 : 12} strokeLinecap="round" />
        <path d={rib(i, -1)} fill="none" stroke={bone} strokeWidth={i > 9 ? 8 : 12} strokeLinecap="round" />
      </g>
    ))}

    {/* Leğen */}
    <path d="M 540 1128 C 468 1120, 392 1140, 368 1194 C 348 1244, 372 1312, 424 1344 C 462 1366, 492 1352, 504 1318 L 540 1276 Z" fill={boneDim} stroke={bone} strokeWidth={5} />
    <path d="M 540 1128 C 612 1120, 688 1140, 712 1194 C 732 1244, 708 1312, 656 1344 C 618 1366, 588 1352, 576 1318 L 540 1276 Z" fill={boneDim} stroke={bone} strokeWidth={5} />

    {/* Uzun kemikler */}
    {[
      ['M 336 500 C 312 604, 306 700, 314 786', 20],
      ['M 744 500 C 768 604, 774 700, 766 786', 20],
      ['M 314 794 C 306 878, 302 950, 308 1020', 15],
      ['M 766 794 C 774 878, 778 950, 772 1020', 15],
      ['M 462 1336 C 448 1470, 442 1576, 450 1664', 24],
      ['M 618 1336 C 632 1470, 638 1576, 630 1664', 24],
      ['M 450 1674 C 444 1756, 442 1818, 448 1878', 19],
      ['M 630 1674 C 636 1756, 638 1818, 632 1878', 19],
    ].map(([p, w], i) => (
      <path key={i} d={p as string} fill="none" stroke={bone} strokeWidth={w as number} strokeLinecap="round" opacity={0.92} />
    ))}
  </g>
);

/**
 * GÖVDE SİLÜETİ — omuzlar geniş, bel dar, kollar yanda, bacaklar ayrı.
 * İlk sürüm bir manken kütlesiydi: kollar gövdeye yapışık, bacaklar tek parça.
 */
export const Figure: React.FC<{opacity: number; fill: string; edge: string}> = ({opacity, fill, edge}) => (
  <g opacity={opacity}>
    <path
      d={
        'M 540 72 C 476 72, 428 126, 428 200 C 428 246, 446 284, 474 306 ' +
        'C 476 344, 464 362, 430 378 C 380 400, 342 412, 316 440 ' +
        'C 296 462, 288 512, 286 566 ' +
        'C 282 660, 276 760, 268 856 C 262 928, 256 990, 252 1036 ' +
        'C 248 1076, 292 1084, 300 1044 C 310 986, 320 906, 328 828 ' +
        'C 332 906, 330 986, 338 1058 C 346 1130, 360 1196, 376 1258 ' +
        'C 392 1320, 404 1394, 410 1478 C 416 1566, 418 1706, 414 1854 ' +
        'C 412 1886, 486 1888, 490 1856 C 500 1712, 512 1566, 524 1450 ' +
        'C 530 1392, 550 1392, 556 1450 C 568 1566, 580 1712, 590 1856 ' +
        'C 594 1888, 668 1886, 666 1854 C 662 1706, 664 1566, 670 1478 ' +
        'C 676 1394, 688 1320, 704 1258 C 720 1196, 734 1130, 742 1058 ' +
        'C 750 986, 748 906, 752 828 C 760 906, 770 986, 780 1044 ' +
        'C 788 1084, 832 1076, 828 1036 C 824 990, 818 928, 812 856 ' +
        'C 804 760, 798 660, 794 566 C 792 512, 784 462, 764 440 ' +
        'C 738 412, 700 400, 650 378 C 616 362, 604 344, 606 306 ' +
        'C 634 284, 652 246, 652 200 C 652 126, 604 72, 540 72 Z'
      }
      fill={fill}
      stroke={edge}
      strokeWidth={6}
    />
  </g>
);

/** Akciğer — sağ üç, sol iki lob; ortada kalbin oturduğu çentik. */
export const LUNG_RIGHT =
  'M 452 470 C 372 466, 316 520, 300 610 C 282 712, 296 852, 326 946 ' +
  'C 350 1020, 396 1052, 440 1030 C 470 1014, 480 940, 482 852 ' +
  'C 484 740, 478 580, 472 512 Z';
export const LUNG_LEFT =
  'M 628 470 C 708 466, 764 520, 780 610 C 798 712, 784 852, 754 946 ' +
  'C 730 1020, 684 1052, 640 1030 C 626 1000, 630 940, 612 900 ' +
  'C 600 872, 606 800, 604 720 C 602 620, 612 520, 620 500 Z';
export const LUNG_FISSURES = [
  'M 470 620 C 428 660, 372 690, 306 700',
  'M 478 830 C 436 846, 380 856, 320 858',
  'M 610 640 C 656 686, 716 716, 776 726',
];
export const BRONCHI: string[] = [
  'M 540 402 L 540 500',
  'M 540 500 C 512 512, 470 528, 436 556',
  'M 540 500 C 568 512, 610 528, 644 556',
  'M 436 556 C 412 588, 396 626, 388 668',
  'M 436 556 C 424 600, 420 650, 424 700',
  'M 644 556 C 668 588, 684 626, 692 668',
  'M 644 556 C 656 600, 660 650, 656 700',
];

type Pt = [number, number];
/**
 * VÜCUDA DAĞILIM — kanın kalpten çıkıp nereye gittiği.
 *
 * Kırmızı ağaç aorttan iner, iliak arterlere ayrılır, bacaklara; yukarıda
 * karotisler başa, subklavyenler kollara. Mavi ağaç aynı yolun dönüşü. Bunlar
 * çizgi değil YOL: kan noktaları bunların üstünde yürür, yoksa "tüm vücuda
 * dağılır" cümlesi bir çizgi resmi olarak kalır.
 */
export const BODY_ARTERIES: Pt[][][] = [
  [
    [[566, 700], [574, 900], [568, 1040], [560, 1150]],
    [[560, 1150], [540, 1230], [500, 1300], [478, 1400]],
    [[478, 1400], [456, 1520], [448, 1660], [448, 1830]],
  ],
  [
    [[566, 700], [574, 900], [568, 1040], [560, 1150]],
    [[560, 1150], [586, 1230], [618, 1300], [638, 1400]],
    [[638, 1400], [660, 1520], [658, 1660], [652, 1830]],
  ],
  [
    [[566, 640], [560, 540], [556, 440], [552, 330]],
    [[552, 330], [548, 280], [546, 240], [546, 200]],
  ],
  [
    [[566, 620], [640, 570], [700, 520], [744, 486]],
    [[744, 486], [778, 570], [790, 700], [786, 800]],
    [[786, 800], [782, 900], [780, 980], [784, 1046]],
  ],
  [
    [[540, 620], [466, 570], [406, 520], [362, 486]],
    [[362, 486], [328, 570], [316, 700], [320, 800]],
    [[320, 800], [324, 900], [326, 980], [322, 1046]],
  ],
];

export const BODY_VEINS: Pt[][][] = [
  [
    [[506, 1800], [500, 1600], [498, 1420], [512, 1260]],
    [[512, 1260], [516, 1120], [510, 900], [506, 700]],
  ],
  [
    [[610, 1800], [604, 1600], [590, 1420], [560, 1260]],
    [[560, 1260], [536, 1120], [516, 900], [508, 700]],
  ],
  [
    [[492, 210], [492, 320], [496, 460], [504, 600]],
    [[504, 600], [506, 640], [506, 670], [506, 700]],
  ],
];
