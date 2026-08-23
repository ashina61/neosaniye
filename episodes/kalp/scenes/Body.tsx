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
  const y0 = 466 + i * 38;
  // Kafes yukarıdan aşağı önce genişler, sonra daralır — göğüs fıçı biçimidir.
  const bulge = Math.sin(((i + 1.2) / 13) * Math.PI);
  const spread = 88 + bulge * 128;
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
    {Array.from({length: 18}).map((_, i) => (
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
        <g key={`c${i}`} opacity={0.7}>
          <path d={cartilage(i, 1)} fill="none" stroke={boneDim} strokeWidth={8} strokeLinecap="round" />
          <path d={cartilage(i, -1)} fill="none" stroke={boneDim} strokeWidth={8} strokeLinecap="round" />
        </g>
      ) : null,
    )}
    {Array.from({length: 12}).map((_, i) => (
      <g key={`r${i}`}>
        <path d={rib(i, 1)} fill="none" stroke={bone} strokeWidth={i > 9 ? 7 : 11} strokeLinecap="round" />
        <path d={rib(i, -1)} fill="none" stroke={bone} strokeWidth={i > 9 ? 7 : 11} strokeLinecap="round" />
      </g>
    ))}

    {/* Leğen */}
    {/* Leğen, siluetin kalçasıyla aynı hizada — öncekinde kemik etin altında
        kalıyor, ayrı bir kütle gibi duruyordu. */}
    <path d="M 540 986 C 476 980, 410 998, 390 1044 C 372 1088, 394 1142, 440 1168 C 472 1186, 498 1174, 508 1146 L 540 1110 Z" fill={boneDim} stroke={bone} strokeWidth={5} />
    <path d="M 540 986 C 604 980, 670 998, 690 1044 C 708 1088, 686 1142, 640 1168 C 608 1186, 582 1174, 572 1146 L 540 1110 Z" fill={boneDim} stroke={bone} strokeWidth={5} />
    <path d="M 516 1096 L 564 1096 L 560 1150 L 520 1150 Z" fill={boneDim} stroke={bone} strokeWidth={4} />

    {/* Uzun kemikler */}
    {[
      ['M 348 430 C 326 560, 312 660, 302 726', 22],
      ['M 732 430 C 754 560, 768 660, 778 726', 22],
      ['M 300 742 C 294 830, 290 900, 288 964', 16],
      ['M 780 742 C 786 830, 790 900, 792 964', 16],
      ['M 462 1150 C 452 1250, 448 1330, 452 1396', 26],
      ['M 618 1150 C 628 1250, 632 1330, 628 1396', 26],
      ['M 452 1414 C 446 1540, 442 1670, 444 1786', 20],
      ['M 628 1414 C 634 1540, 638 1670, 636 1786', 20],
    ].map(([p, w], i) => (
      <path key={i} d={p as string} fill="none" stroke={bone} strokeWidth={w as number} strokeLinecap="round" opacity={0.92} />
    ))}
  </g>
);

/**
 * GÖVDE SİLÜETİ — omuzlar geniş, bel dar, kollar yanda, bacaklar ayrı.
 * İlk sürüm bir manken kütlesiydi: kollar gövdeye yapışık, bacaklar tek parça.
 */
export const Figure: React.FC<{opacity: number; fill: string; edge: string}> = ({opacity, fill, edge}) => {
  /**
   * İNSAN TEK BİR KÜTLE DEĞİL.
   *
   * İlk iki sürüm gövdeyi tek bir kapalı yol olarak çizdi ve sonuç bir manken
   * oldu: kollar gövdeye yapışık, bacaklar tek parça, omuz yok. Bir siluetin
   * insan gibi okunması için gereken şey detay değil ORANTI ve EKLEM — omuzun
   * nerede bittiği, dirseğin nerede kırıldığı, baldırın nerede inceldiği.
   * O yüzden her uzuv kendi konik yolu olarak çizilir.
   */
  const limb = (pts: [number, number][], w: number[]) => {
    const left: string[] = [];
    const right: string[] = [];
    pts.forEach(([x, y], i) => {
      left.push(`${i === 0 ? 'M' : 'L'} ${x - w[i]} ${y}`);
      right.unshift(`L ${x + w[i]} ${y}`);
    });
    return `${left.join(' ')} ${right.join(' ')} Z`;
  };
  const skin = {fill, stroke: edge, strokeWidth: 5, strokeLinejoin: 'round' as const};
  return (
    <g opacity={opacity}>
      {/* Baş ve boyun */}
      <ellipse cx={540} cy={196} rx={82} ry={102} {...skin} />
      <path d="M 508 286 L 572 286 L 578 336 L 502 336 Z" {...skin} />

      {/* Gövde: omuz, göğüs, bel, kalça */}
      <path
        d={
          'M 540 330 C 470 336, 406 356, 366 392 C 340 416, 330 470, 328 540 ' +
          'C 326 620, 336 700, 352 768 C 366 828, 372 878, 374 936 ' +
          'C 376 986, 392 1010, 440 1014 C 500 1020, 580 1020, 640 1014 ' +
          'C 688 1010, 704 986, 706 936 C 708 878, 714 828, 728 768 ' +
          'C 744 700, 754 620, 752 540 C 750 470, 740 416, 714 392 ' +
          'C 674 356, 610 336, 540 330 Z'
        }
        {...skin}
      />

      {/* Kollar: omuz → dirsek → bilek → el */}
      <path d={limb([[352, 392], [318, 560], [300, 720], [292, 880], [288, 968]], [44, 40, 33, 29, 26])} {...skin} />
      <path d={limb([[728, 392], [762, 560], [780, 720], [788, 880], [792, 968]], [44, 40, 33, 29, 26])} {...skin} />
      <ellipse cx={286} cy={1016} rx={30} ry={48} {...skin} />
      <ellipse cx={794} cy={1016} rx={30} ry={48} {...skin} />

      {/* Bacaklar: kalça → diz → bilek */}
      <path d={limb([[462, 1000], [452, 1220], [446, 1400], [442, 1620], [440, 1800]], [72, 58, 44, 38, 32])} {...skin} />
      <path d={limb([[618, 1000], [628, 1220], [634, 1400], [638, 1620], [640, 1800]], [72, 58, 44, 38, 32])} {...skin} />
      {/* Ayaklar */}
      <path d="M 410 1798 L 472 1798 L 478 1848 L 396 1852 Z" {...skin} />
      <path d="M 608 1798 L 670 1798 L 684 1852 L 602 1848 Z" {...skin} />
    </g>
  );
};

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
