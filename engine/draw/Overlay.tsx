import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {CLAMP, posterizeTime} from '../motion';
import {interpolate} from 'remotion';

/**
 * A PLATE SHOT ON BLACK — smoke, haze, fire, sparks, a light leak, dust.
 *
 * The one asset type that needs no cutting out at all, and the reason it is
 * worth having: SCREEN blend keeps only what is brighter than the layer
 * beneath, so the black simply drops away. No mask, no key, no rotoscoping.
 *
 * Except that footage is never pure black, and screen only nukes pure black.
 * Three moves, in order, and each fixes what the one before it leaves:
 *
 *   SCREEN   drops the black
 *   CRUSH    contrast pushes the lifted near-black down to true black, which is
 *            what removes the faint grey rectangle screen leaves behind
 *   FEATHER  a mask fades the edges, so the plume trails off instead of ending
 *            at a straight line where the video frame stopped
 *
 * That trio is the whole recipe for dropping any on-black plate into a shot,
 * and it is why a haze pass costs one file and no artwork budget.
 */
export const Overlay: React.FC<{
  src: string;
  opacity?: number;
  /** Extra contrast, to true-black a lifted background. */
  crush?: number;
  /** How far in from each edge the plate is faded, as a percentage. */
  feather?: number;
  scale?: number;
  x?: number;
  y?: number;
  /** Frames over which it fades up; it never simply appears. */
  from?: number;
  over?: number;
  drift?: number;
  blend?: 'screen' | 'lighten' | 'color-dodge';
}> = ({
  src,
  opacity = 0.55,
  crush = 1.6,
  feather = 22,
  scale = 1.3,
  x = 0,
  y = 0,
  from = 0,
  over = 18,
  drift = 0,
  blend = 'screen',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const up = interpolate(stepped, [from, from + over], [0, opacity], CLAMP);
  if (up <= 0.002) return null;

  const mask = `radial-gradient(ellipse 78% 78% at 50% 50%, #000 ${100 - feather * 2}%, transparent 100%)`;

  return (
    <AbsoluteFill style={{mixBlendMode: blend, pointerEvents: 'none', opacity: up}}>
      <Img
        src={staticFile(src)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `translate(${x + stepped * drift}px, ${y}px) scale(${scale})`,
          filter: `contrast(${crush}) brightness(0.95)`,
          WebkitMaskImage: mask,
          maskImage: mask,
        }}
      />
    </AbsoluteFill>
  );
};
