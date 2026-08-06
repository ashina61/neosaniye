import React from 'react';
import {AbsoluteFill} from 'remotion';

/**
 * LIGHT, DRAWN.
 *
 * The single biggest difference between a photograph moving on screen and a
 * shot that reads as lit. A plate of a room with a lamp in it contains a lamp;
 * it does not contain its light. That gets painted on afterwards, and once it
 * is there the flat photo behind it stops looking flat.
 *
 * Four stacked radial gradients on SCREEN blend, because screen only ever adds:
 *
 *   CORE     a small white-hot centre — the filament
 *   HALO     a wider warm bloom around it
 *   MOUTH    a flat glow where the light leaves the shade
 *   SPILL    a big faint ambient wash that lifts the whole room a little
 *
 * Nothing here knows what it is lighting. It is given a point in scene pixels
 * and a colour, which is why the same component lights a lamp, a streetlight, a
 * match or a muzzle flash.
 */
export const Glow: React.FC<{
  x: number;
  y: number;
  /** Radius of the hot core in pixels; everything else is scaled from it. */
  size?: number;
  colour?: string;
  warm?: string;
  intensity?: number;
  /**
   * How defocused the lens is right now, in pixels of blur.
   *
   * A soft gradient is blur-invariant — blur it and you get the same soft
   * gradient back — so through a focus hunt the light would sit untreated in a
   * frame that has gone soft. Real defocused highlights GROW into bokeh discs,
   * so the core is bloomed by this amount instead.
   */
  defocus?: number;
}> = ({x, y, size = 120, colour = '#fff6e2', warm = '#ffb457', intensity = 1, defocus = 0}) => {
  const bloom = 1 + Math.min(defocus, 20) * 0.07;
  const layer = (radius: number, stops: string, opacity: number): React.CSSProperties => ({
    position: 'absolute',
    left: x - radius,
    top: y - radius,
    width: radius * 2,
    height: radius * 2,
    borderRadius: '50%',
    background: `radial-gradient(circle, ${stops})`,
    opacity: opacity * intensity,
  });

  return (
    <AbsoluteFill style={{mixBlendMode: 'screen', pointerEvents: 'none'}}>
      <div style={layer(size * 5.2 * bloom, `${warm}22 0%, ${warm}10 45%, transparent 72%`, 0.9)} />
      <div style={layer(size * 2.4 * bloom, `${warm}66 0%, ${warm}2a 40%, transparent 70%`, 0.95)} />
      <div style={layer(size * 1.25 * bloom, `${colour}cc 0%, ${warm}77 46%, transparent 74%`, 1)} />
      <div style={layer(size * 0.5 * bloom, `#ffffff 0%, ${colour}dd 42%, transparent 78%`, 1)} />
    </AbsoluteFill>
  );
};

/**
 * FOG, DRAWN.
 *
 * Asked for smoke on black, the generator handed back a grey landscape — which
 * screen-blended does not add haze to a shot, it washes the whole frame out.
 * Atmosphere is soft gradients, and soft gradients are the one thing code does
 * better than a diffusion model every single time.
 *
 * Three bands at different depths and speeds, so it never reads as one moving
 * sheet. Sits between the camera and the subject, which is the point of it:
 * fog behind everything is wallpaper.
 */
export const Fog: React.FC<{
  frame: number;
  amount?: number;
  colour?: string;
  speed?: number;
  height?: number;
}> = ({frame, amount = 0.4, colour = '#cfd6dc', speed = 1, height = 0.62}) => {
  if (amount <= 0) return null;
  const band = (i: number, opacity: number, scale: number, rate: number) => {
    const x = ((frame * rate * speed) % 260) - 130;
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: `${-40 + x * 0.4}%`,
          top: `${(1 - height) * 100 + i * 9}%`,
          width: '190%',
          height: `${height * 100}%`,
          background:
            `radial-gradient(ellipse ${58 * scale}% ${34 * scale}% at 30% 50%, ${colour}44 0%, transparent 68%),` +
            `radial-gradient(ellipse ${44 * scale}% ${28 * scale}% at 68% 42%, ${colour}3a 0%, transparent 70%)`,
          opacity: opacity * amount,
          filter: 'blur(18px)',
        }}
      />
    );
  };
  return (
    <AbsoluteFill style={{mixBlendMode: 'screen', pointerEvents: 'none'}}>
      {band(0, 1, 1, 0.22)}
      {band(1, 0.75, 1.4, 0.13)}
      {band(2, 0.5, 0.8, 0.34)}
    </AbsoluteFill>
  );
};

/**
 * A BEAM — the cone of light leaving a shade and landing on something.
 *
 * Drawn as a blurred trapezoid rather than a gradient, because a cone has
 * edges; the side mask is what stops those edges arriving as two hard diagonal
 * lines. Sits behind the subject so the subject occludes it.
 */
export const Beam: React.FC<{
  x: number;
  y: number;
  width?: number;
  spread?: number;
  length?: number;
  colour?: string;
  intensity?: number;
  rotate?: number;
}> = ({x, y, width = 180, spread = 2.6, length = 900, colour = '#ffb457', intensity = 0.5, rotate = 0}) => (
  <AbsoluteFill style={{mixBlendMode: 'screen', pointerEvents: 'none'}}>
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 0,
        height: 0,
        transform: `rotate(${rotate}deg)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: -width / 2,
          top: 0,
          width,
          height: length,
          background: `linear-gradient(to bottom, ${colour}55 0%, ${colour}22 45%, transparent 92%)`,
          clipPath: `polygon(50% 0%, ${50 - 50 * spread}% 100%, ${50 + 50 * spread}% 100%)`,
          filter: 'blur(26px)',
          opacity: intensity,
          // Feather the sides so the cone does not arrive as two hard edges.
          WebkitMaskImage: 'linear-gradient(to right, transparent, #000 22%, #000 78%, transparent)',
          maskImage: 'linear-gradient(to right, transparent, #000 22%, #000 78%, transparent)',
        }}
      />
    </div>
  </AbsoluteFill>
);
