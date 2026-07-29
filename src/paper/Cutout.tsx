import React from 'react';
import {PALETTE} from '../design/tokens';
import {rand} from '../motion/stepped';

/**
 * KESİLMİŞ KAĞIT PARÇASI (cutout)
 *
 * Referans videonun en tutarlı tek kuralı bu: HER fotoğraf parçasının etrafında
 * aynı krem sticker konturu ve altında aynı yumuşak gölge var. Otuz ayrı
 * görseli tek filmin kareleri gibi gösteren şey bu tek kural.
 *
 * Kontur, alfa kanallı bir PNG'nin çevresine sekiz yöne drop-shadow yığarak
 * çiziliyor. Bu, keyfi şekilli alfa maskesine kontur çizmenin tarayıcıda
 * çalışan tek deterministik yolu; SVG stroke bunu yapamaz çünkü şekil bir
 * yol değil, raster maske.
 */

const OUTLINE_DIRS: Array<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7],
];

function outlineFilter(width: number, color: string): string {
  return OUTLINE_DIRS.map(
    ([dx, dy]) => `drop-shadow(${(dx * width).toFixed(2)}px ${(dy * width).toFixed(2)}px 0 ${color})`,
  ).join(' ');
}

/** Sahnenin gölge dili: tek yön, tek yumuşaklık. Sahne başına değişmez. */
const LAYER_SHADOW = 'drop-shadow(0 14px 18px rgba(24,18,8,0.30))';

/**
 * HALFTONE
 *
 * Gerçek hata-yayılımlı halftone tarayıcıda pahalı. Burada yapılan: gri tona
 * indir, kontrastı aç, üstüne nokta ızgarası bindir. 1080 genişlikte ve video
 * sıkıştırmasından sonra baskı noktası gibi okunuyor, maliyeti sıfır.
 */
export const HALFTONE_CSS: React.CSSProperties = {
  filter: 'grayscale(1) contrast(1.32) brightness(1.04)',
};

const DotScreen: React.FC<{size?: number; opacity?: number}> = ({size = 5, opacity = 0.30}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      backgroundImage: `radial-gradient(circle at 50% 50%, rgba(0,0,0,${opacity}) 0 34%, rgba(0,0,0,0) 36%)`,
      backgroundSize: `${size}px ${size}px`,
      mixBlendMode: 'multiply',
      pointerEvents: 'none',
    }}
  />
);

export type PlaceholderShape = 'figure' | 'vessel' | 'building' | 'object' | 'terrain';

/**
 * PROSEDÜREL YER TUTUCU
 *
 * Test videoları ücretli görsel API'si çağırmadan render edilebilsin diye var.
 * Kasıtlı olarak "fotoğraf gibi" değil: siluet. Amacı tasarım sisteminin
 * (kontur, gölge, halftone, yerleşim, hareket) kanıtlanabilmesi; gerçek
 * halftone fotoğraf sonradan aynı bileşene `src` olarak girer.
 */
const Placeholder: React.FC<{shape: PlaceholderShape; seed: number}> = ({shape, seed}) => {
  const ink = PALETTE.inkBlack;
  const common = {fill: ink} as const;
  switch (shape) {
    case 'figure':
      return (
        <svg viewBox="0 0 100 140" width="100%" height="100%" preserveAspectRatio="xMidYMax meet">
          <circle cx="50" cy="24" r="19" {...common} />
          <path d="M50 46 C30 46 22 60 20 86 L18 140 L82 140 L80 86 C78 60 70 46 50 46 Z" {...common} />
        </svg>
      );
    case 'vessel':
      return (
        <svg viewBox="0 0 160 110" width="100%" height="100%" preserveAspectRatio="xMidYMax meet">
          <path d="M10 84 L150 84 L136 104 L24 104 Z" {...common} />
          <path d="M78 8 L78 80 L120 80 Z" {...common} />
          <path d="M72 22 L72 80 L36 80 Z" {...common} />
        </svg>
      );
    case 'building':
      return (
        <svg viewBox="0 0 120 140" width="100%" height="100%" preserveAspectRatio="xMidYMax meet">
          <rect x="16" y="40" width="88" height="100" {...common} />
          <path d="M60 6 L110 40 L10 40 Z" {...common} />
        </svg>
      );
    case 'terrain':
      return (
        <svg viewBox="0 0 200 90" width="100%" height="100%" preserveAspectRatio="xMidYMax meet">
          <path d="M0 90 L44 34 L78 62 L112 20 L156 66 L200 44 L200 90 Z" {...common} />
        </svg>
      );
    case 'object':
    default: {
      const r = rand(seed) * 8;
      return (
        <svg viewBox="0 0 120 120" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <rect x="18" y="18" width="84" height="84" rx={4 + r} {...common} />
        </svg>
      );
    }
  }
};

export interface CutoutProps {
  /** Gerçek alfa kanallı görsel. Yoksa prosedürel siluet çizilir. */
  src?: string;
  shape?: PlaceholderShape;
  width: number;
  height: number;
  x?: number;
  y?: number;
  /** Kesik kağıt izlenimi için hafif eğiklik, derece. */
  rotate?: number;
  /** Sticker konturu kalınlığı. 0 = kontur yok. */
  outline?: number;
  outlineColor?: string;
  halftone?: boolean;
  /** enter()/drift()'ten gelen transform. */
  transform?: string;
  opacity?: number;
  seed?: number;
  zIndex?: number;
}

export const Cutout: React.FC<CutoutProps> = ({
  src,
  shape = 'object',
  width,
  height,
  x = 0,
  y = 0,
  rotate = 0,
  outline = 9,
  outlineColor = PALETTE.paper,
  halftone = true,
  transform,
  opacity = 1,
  seed = 1,
  zIndex,
}) => {
  // Kontur + gölge tek filter zincirinde: sıra önemli, gölge konturun DIŞINA
  // düşmeli, yoksa kontur gölgenin üstünde yüzer gibi durur.
  const filter = `${outline > 0 ? outlineFilter(outline, outlineColor) : ''} ${LAYER_SHADOW}`.trim();

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        opacity,
        zIndex,
        transform: [transform, rotate ? `rotate(${rotate}deg)` : ''].filter(Boolean).join(' ') || undefined,
        transformOrigin: 'center center',
      }}
    >
      <div style={{position: 'relative', width: '100%', height: '100%', filter}}>
        {src ? (
          <img
            src={src}
            width={width}
            height={height}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              ...(halftone ? HALFTONE_CSS : {}),
            }}
          />
        ) : (
          <div style={{width: '100%', height: '100%'}}>
            <Placeholder shape={shape} seed={seed} />
          </div>
        )}
        {halftone && <DotScreen />}
      </div>
    </div>
  );
};

/**
 * YIRTIK KAĞIT KARTI — cutout'un altına konan renkli/dokulu zemin parçası.
 * Referansta portreler hep böyle bir kartın üstünde duruyor, doğrudan zeminde
 * değil; kartın yırtık kenarı derinlik veriyor.
 */
export const TornCard: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  rotate?: number;
  transform?: string;
  opacity?: number;
  seed?: number;
  zIndex?: number;
  children?: React.ReactNode;
}> = ({x, y, width, height, color = PALETTE.sea, rotate = 0, transform, opacity = 1, seed = 5, zIndex, children}) => {
  // Yırtık kenar: üst kenarda deterministik zikzak clip-path.
  const teeth = 14;
  const pts: string[] = [];
  for (let i = 0; i <= teeth; i += 1) {
    const px = (i / teeth) * 100;
    const py = 1.6 * rand(seed * 31 + i);
    pts.push(`${px.toFixed(2)}% ${py.toFixed(2)}%`);
  }
  pts.push('100% 100%', '0% 100%');

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        opacity,
        zIndex,
        transform: [transform, rotate ? `rotate(${rotate}deg)` : ''].filter(Boolean).join(' ') || undefined,
        transformOrigin: 'center center',
        filter: 'drop-shadow(0 10px 14px rgba(24,18,8,0.24))',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          background: color,
          clipPath: `polygon(${pts.join(', ')})`,
        }}
      />
      {children}
    </div>
  );
};
