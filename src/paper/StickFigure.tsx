import React from 'react';
import {PALETTE} from '../design/tokens';

/**
 * ÇÖP ADAM — referans videonun ikinci görsel kaydı.
 *
 * Videoda iki kayıt var ve ayrım keskin:
 *   çöp adam      → "sen, izleyici", soyut fikir, duygusal beat
 *   halftone foto → tarihsel olgu, gerçek kişi, gerçek yer
 *
 * Bu ayrım kodlanabilir bir kural ve storyboard eşlemesi buna dayanır. Soyut
 * bir cümleye ("hangisini inşa ediyorsun?") halftone arşiv fotoğrafı koymak
 * yalan görsel üretir; çöp adam koymak dürüsttür.
 *
 * Çizgi kalınlığı ve uçların yuvarlaklığı kasıtlı: elle çizilmiş marker.
 */

export type Pose = 'stand' | 'point' | 'slump' | 'sleep' | 'sit-desk' | 'overwhelmed';

export interface StickFigureProps {
  pose?: Pose;
  x: number;
  y: number;
  height: number;
  color?: string;
  /** Krem kontur — çöp adam da bir kağıt parçası gibi davranır. */
  outline?: number;
  outlineColor?: string;
  transform?: string;
  opacity?: number;
  flip?: boolean;
  zIndex?: number;
}

/** Her poz 100x150 birim kutuda; ölçek height ile yapılır. */
const POSES: Record<Pose, React.ReactNode> = {
  stand: (
    <>
      <circle cx="50" cy="24" r="17" />
      <line x1="50" y1="41" x2="50" y2="96" />
      <line x1="50" y1="55" x2="24" y2="76" />
      <line x1="50" y1="55" x2="76" y2="76" />
      <line x1="50" y1="96" x2="32" y2="142" />
      <line x1="50" y1="96" x2="68" y2="142" />
    </>
  ),
  point: (
    <>
      <circle cx="50" cy="24" r="17" />
      <line x1="50" y1="41" x2="50" y2="96" />
      {/* İşaret eden kol yukarı — "burada" jesti */}
      <line x1="50" y1="54" x2="84" y2="26" />
      <line x1="50" y1="55" x2="26" y2="74" />
      <line x1="50" y1="96" x2="32" y2="142" />
      <line x1="50" y1="96" x2="68" y2="142" />
    </>
  ),
  slump: (
    <>
      <circle cx="50" cy="30" r="17" />
      <line x1="50" y1="47" x2="52" y2="98" />
      <line x1="51" y1="60" x2="28" y2="86" />
      <line x1="51" y1="60" x2="74" y2="86" />
      <line x1="52" y1="98" x2="34" y2="142" />
      <line x1="52" y1="98" x2="70" y2="142" />
    </>
  ),
  sleep: (
    <>
      {/* Yatay figür — yan yatmış */}
      <circle cx="22" cy="104" r="16" />
      <line x1="38" y1="106" x2="88" y2="106" />
      <line x1="52" y1="106" x2="62" y2="126" />
      <line x1="72" y1="106" x2="82" y2="126" />
    </>
  ),
  'sit-desk': (
    <>
      <circle cx="42" cy="34" r="16" />
      <line x1="42" y1="50" x2="42" y2="92" />
      <line x1="42" y1="66" x2="70" y2="82" />
      {/* Oturan bacak: yatay sonra dikey */}
      <line x1="42" y1="92" x2="70" y2="92" />
      <line x1="70" y1="92" x2="70" y2="128" />
      {/* Masa */}
      <line x1="60" y1="86" x2="100" y2="86" />
    </>
  ),
  overwhelmed: (
    <>
      <circle cx="50" cy="30" r="17" />
      <line x1="50" y1="47" x2="50" y2="98" />
      {/* İki kol da yukarı — bunalmış */}
      <line x1="50" y1="58" x2="20" y2="34" />
      <line x1="50" y1="58" x2="80" y2="34" />
      <line x1="50" y1="98" x2="32" y2="142" />
      <line x1="50" y1="98" x2="68" y2="142" />
    </>
  ),
};

const OUTLINE_DIRS: Array<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7],
];

export const StickFigure: React.FC<StickFigureProps> = ({
  pose = 'stand',
  x,
  y,
  height,
  color = PALETTE.ink,
  outline = 7,
  outlineColor = PALETTE.paper,
  transform,
  opacity = 1,
  flip = false,
  zIndex,
}) => {
  const width = (height / 150) * 100;
  const ring =
    outline > 0
      ? OUTLINE_DIRS.map(([dx, dy]) => `drop-shadow(${(dx * outline).toFixed(1)}px ${(dy * outline).toFixed(1)}px 0 ${outlineColor})`).join(' ')
      : '';
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
        transform: [transform, flip ? 'scaleX(-1)' : ''].filter(Boolean).join(' ') || undefined,
        transformOrigin: 'center center',
        filter: `${ring} drop-shadow(0 12px 15px rgba(24,18,8,0.26))`.trim(),
      }}
    >
      <svg
        viewBox="0 0 100 150"
        width="100%"
        height="100%"
        stroke={color}
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
      >
        {POSES[pose]}
      </svg>
    </div>
  );
};

/** Düşünce balonu — çöp adam sahnelerinde içine bir cutout konur. */
export const ThoughtBubble: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  transform?: string;
  opacity?: number;
  zIndex?: number;
  children?: React.ReactNode;
}> = ({x, y, width, height, transform, opacity = 1, zIndex, children}) => (
  <div style={{position: 'absolute', left: x, top: y, width, height, opacity, zIndex, transform}}>
    <svg viewBox="0 0 200 130" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
      <path
        d="M46 96 C18 96 6 78 18 62 C4 44 22 22 46 28 C56 8 96 4 112 20 C140 6 178 22 176 48 C196 60 190 92 162 96 Z"
        fill={PALETTE.paper}
        stroke={PALETTE.ink}
        strokeWidth={4}
      />
      <circle cx="34" cy="112" r="9" fill={PALETTE.paper} stroke={PALETTE.ink} strokeWidth={3} />
      <circle cx="18" cy="126" r="5" fill={PALETTE.paper} stroke={PALETTE.ink} strokeWidth={3} />
    </svg>
    <div style={{position: 'absolute', left: '14%', top: '14%', width: '72%', height: '56%'}}>{children}</div>
  </div>
);
