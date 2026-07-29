import React from 'react';
import {AbsoluteFill, staticFile} from 'remotion';
import {PALETTE, CANVAS, FONTS} from '../design/tokens';
import {rand} from '../motion/stepped';

/**
 * Fontlar repoya gömülü (public/fonts). Sistem fontuna güvenmiyoruz: GitHub
 * runner'ında Roboto Condensed yok, ve font değişirse tüm kompozisyon kayar.
 * Lisanslar public/fonts içinde duruyor (Roboto: Apache-2.0, EB Garamond: OFL).
 */
export const FontFaces: React.FC = () => (
  <style>{`
    @font-face {
      font-family: 'Roboto Condensed';
      src: url('${staticFile('fonts/RobotoCondensed-Bold.ttf')}') format('truetype');
      font-weight: 700; font-style: normal; font-display: block;
    }
    @font-face {
      font-family: 'Roboto Condensed';
      src: url('${staticFile('fonts/RobotoCondensed-Regular.ttf')}') format('truetype');
      font-weight: 400; font-style: normal; font-display: block;
    }
    @font-face {
      font-family: 'EB Garamond';
      src: url('${staticFile('fonts/EBGaramond12-Italic.otf')}') format('opentype');
      font-weight: 400; font-style: italic; font-display: block;
    }
  `}</style>
);

/**
 * KAĞIT LİFİ DOKUSU
 *
 * Steril düz renk "dijital" durur; kağıt hissi lif gürültüsünden gelir.
 * feTurbulence deterministiktir (seed sabit), yani her render aynı dokuyu
 * üretir — Math.random ile üretilmiş bir gürültü determinizmi bozardı.
 */
const GRAIN_ID = 'np-grain';

export const PaperTexture: React.FC<{opacity?: number}> = ({opacity = 0.42}) => (
  <>
    <svg width={0} height={0} style={{position: 'absolute'}}>
      <filter id={GRAIN_ID} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves={4} seed={7} result="n" />
        <feColorMatrix
          in="n"
          type="matrix"
          values="0 0 0 0 0.5  0 0 0 0 0.47  0 0 0 0 0.42  0 0 0 0.9 0"
        />
      </filter>
    </svg>
    <AbsoluteFill
      style={{filter: `url(#${GRAIN_ID})`, opacity, mixBlendMode: 'multiply', pointerEvents: 'none'}}
    />
  </>
);

/** Kenarlarda hafif kararma — basılı sayfanın ışık düşüşü. */
export const PaperVignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        'radial-gradient(120% 80% at 50% 44%, rgba(0,0,0,0) 52%, rgba(40,30,16,0.10) 84%, rgba(30,22,10,0.20) 100%)',
      pointerEvents: 'none',
    }}
  />
);

/**
 * Zemine serpiştirilmiş leke/kir. Konum deterministik (rand(seed)), yani her
 * render aynı yere aynı lekeyi koyar.
 */
export const PaperStains: React.FC<{seed?: number; count?: number}> = ({seed = 3, count = 5}) => (
  <>
    {Array.from({length: count}, (_, i) => {
      const r1 = rand(seed * 10 + i);
      const r2 = rand(seed * 20 + i * 3);
      const r3 = rand(seed * 30 + i * 7);
      const size = 90 + r3 * 260;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: r1 * (CANVAS.width - size),
            top: r2 * (CANVAS.height - size),
            width: size,
            height: size * (0.6 + r3 * 0.6),
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(120,96,56,${(0.05 + r3 * 0.05).toFixed(3)}) 0%, rgba(120,96,56,0) 70%)`,
            pointerEvents: 'none',
          }}
        />
      );
    })}
  </>
);

export type Ground = 'cream' | 'warm' | 'ink' | 'night';

const GROUND_COLOR: Record<Ground, string> = {
  cream: PALETTE.ground,
  warm: PALETTE.groundWarm,
  ink: PALETTE.ink,
  night: PALETTE.night,
};

/**
 * Her sahnenin tabanı. "Build-on assembly" burada başlar: sahne açıldığında
 * ekranda YALNIZCA bu vardır — boş kağıt zemin, lekeleriyle. Öyküye ait her
 * öğe sonradan girer.
 */
export const PaperBase: React.FC<{
  ground?: Ground;
  stains?: boolean;
  grain?: boolean;
  vignette?: boolean;
  seed?: number;
  children?: React.ReactNode;
}> = ({ground = 'cream', stains = true, grain = true, vignette = true, seed = 3, children}) => {
  const dark = ground === 'ink' || ground === 'night';
  return (
    <AbsoluteFill style={{backgroundColor: GROUND_COLOR[ground], fontFamily: FONTS.display}}>
      <FontFaces />
      {stains && !dark && <PaperStains seed={seed} />}
      {children}
      {grain && <PaperTexture opacity={dark ? 0.22 : 0.42} />}
      {vignette && <PaperVignette />}
    </AbsoluteFill>
  );
};
