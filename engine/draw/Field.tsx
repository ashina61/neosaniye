import React from 'react';
import {AbsoluteFill} from 'remotion';
import {hash01} from '../motion';

/**
 * BACKDROPS THAT ARE NOT PHOTOGRAPHS.
 *
 * A scene does not always want a picture behind it, and when it does not, the
 * alternative is never a flat colour. The reference reel's loudest shot has no
 * photographed background at all — it is a deep red sunburst drawn with a
 * radial gradient and some faint rays, and it is the most designed frame in the
 * piece.
 *
 * Drawn fields also solve the thing that keeps going wrong upstream: an image
 * generator will refuse, wander or hand back something mediocre, but a gradient
 * is the same every run and costs nothing.
 */
export type FieldKind = 'sunburst' | 'wash' | 'paper' | 'grid' | 'spotlight';

const Rays: React.FC<{count: number; colour: string; opacity: number; seed: string}> = ({
  count,
  colour,
  opacity,
  seed,
}) => (
  <AbsoluteFill style={{overflow: 'hidden'}}>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{width: '100%', height: '100%'}}>
      {Array.from({length: count}, (_, i) => {
        const angle = (i / count) * 360 + hash01(seed, i) * 6;
        const wide = 2.2 + hash01(seed, i + 90) * 2.6;
        return (
          <polygon
            key={i}
            points={`50,50 ${50 + 90 * Math.cos(((angle - wide) * Math.PI) / 180)},${
              50 + 90 * Math.sin(((angle - wide) * Math.PI) / 180)
            } ${50 + 90 * Math.cos(((angle + wide) * Math.PI) / 180)},${
              50 + 90 * Math.sin(((angle + wide) * Math.PI) / 180)
            }`}
            fill={colour}
            opacity={opacity * (0.5 + hash01(seed, i + 200) * 0.5)}
          />
        );
      })}
    </svg>
  </AbsoluteFill>
);

export const Field: React.FC<{
  kind?: FieldKind;
  /** Three stops, dark to light or light to dark — the episode's palette. */
  colours?: string[];
  centreX?: number;
  centreY?: number;
  rays?: number;
  seed?: string;
  /**
   * HOW MUCH OF THE FRAME THIS FIELD HAS TO CARRY, 0..1.
   *
   * A field behind a photograph only has to not be white — it is under a plate
   * and a scrim, and the darker it is the better. A field standing IN PLACE of
   * a photograph is the whole picture, and the same palette then delivers a
   * frame measuring 0.03 luma: the type floats in black and there is nothing
   * else to look at. The audit caught four shots of one reel like that.
   *
   * So the stops are lifted toward light in proportion to how alone the field
   * is. Lifting rather than swapping keeps the episode's palette — a drawn
   * shot has to belong to the same reel as the photographed ones.
   */
  lift?: number;
}> = ({kind = 'wash', colours, centreX = 50, centreY = 46, rays = 26, seed = 'field', lift = 0}) => {
  const raise = (hex: string): string => {
    if (!lift) return hex;
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!match) return hex;
    const value = parseInt(match[1], 16);
    const mix = (channel: number) => Math.round(channel + (255 - channel) * lift * 0.17);
    const r = mix((value >> 16) & 255);
    const g = mix((value >> 8) & 255);
    const b2 = mix(value & 255);
    return `#${((r << 16) | (g << 8) | b2).toString(16).padStart(6, '0')}`;
  };
  const [a, b, c] = (colours ?? ['#a01218', '#7c0d12', '#58080c']).map(raise);

  if (kind === 'sunburst') {
    return (
      <AbsoluteFill style={{background: c}}>
        <AbsoluteFill
          style={{background: `radial-gradient(circle at ${centreX}% ${centreY}%, ${a} 0%, ${b} 42%, ${c} 78%)`}}
        />
        <Rays count={rays} colour={a} opacity={0.16} seed={seed} />
        <AbsoluteFill
          style={{background: `radial-gradient(ellipse at ${centreX}% ${centreY}%, transparent 30%, ${c}cc 88%)`}}
        />
      </AbsoluteFill>
    );
  }

  if (kind === 'paper') {
    // Aged stock: a warm base, blotchy staining, and fibre. Every layer is a
    // gradient, so it is identical on every run.
    return (
      <AbsoluteFill style={{background: a}}>
        <AbsoluteFill
          style={{
            background:
              `radial-gradient(ellipse at 22% 18%, ${b}88 0%, transparent 46%),` +
              `radial-gradient(ellipse at 82% 74%, ${b}77 0%, transparent 52%),` +
              `radial-gradient(ellipse at 62% 30%, ${c}55 0%, transparent 38%)`,
          }}
        />
        <AbsoluteFill
          style={{
            backgroundImage: `repeating-linear-gradient(94deg, ${c}0e 0 1px, transparent 1px 4px)`,
            opacity: 0.7,
          }}
        />
        <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 50%, transparent 52%, ${c}66 100%)`}} />
      </AbsoluteFill>
    );
  }

  if (kind === 'grid') {
    return (
      <AbsoluteFill style={{background: c}}>
        <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 42%, ${a} 0%, ${b} 45%, ${c} 82%)`}} />
        <AbsoluteFill
          style={{
            backgroundImage:
              `repeating-linear-gradient(0deg, ${a}22 0 1px, transparent 1px 64px),` +
              `repeating-linear-gradient(90deg, ${a}22 0 1px, transparent 1px 64px)`,
            opacity: 0.55,
          }}
        />
      </AbsoluteFill>
    );
  }

  if (kind === 'spotlight') {
    return (
      <AbsoluteFill style={{background: c}}>
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 62% 44% at ${centreX}% ${centreY}%, ${a} 0%, ${b} 40%, ${c} 82%)`,
          }}
        />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{background: `linear-gradient(168deg, ${a} 0%, ${b} 52%, ${c} 100%)`}} />
  );
};
