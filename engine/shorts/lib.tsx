import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

/**
 * SHARED PARTS FOR A CODE-DRAWN SHORT.
 *
 * No photographs, no files, no supply problem: every pixel here is drawn at
 * render time. That is not a compromise, it is the right tool for a reel whose
 * subject is a NUMBER — there is no photograph of exponential growth, and a
 * stock picture of a piece of paper would say less than a bar that doubles.
 */

/** Deterministic 0..1 from a string and an index. Never Math.random(). */
export const hash01 = (seed: string, index: number): number => {
  let h = 2166136261 ^ index;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

export const PALETTE = {
  ink: '#05070d',
  paper: '#f4f1e8',
  hot: '#ffd23f',
  cool: '#5ac8fa',
  danger: '#ff4d3d',
};

/**
 * THE THICKNESS OF A SHEET OF PAPER FOLDED N TIMES, in millimetres.
 * 0.1mm is the ordinary figure for office paper, and it is the one that makes
 * the claim true: 0.1 × 2^42 = 439,805 km, and the Moon is 384,400 km away.
 */
export const thickness = (folds: number): number => 0.1 * 2 ** folds;

/** Millimetres → the largest unit that leaves a number a person can read. */
export function measure(mm: number): {value: string; unit: string} {
  const nf = (n: number, digits = 0) =>
    n.toLocaleString('tr-TR', {minimumFractionDigits: digits, maximumFractionDigits: digits});
  if (mm < 10) return {value: nf(mm, 1), unit: 'mm'};
  if (mm < 1_000) return {value: nf(mm / 10, 1), unit: 'cm'};
  if (mm < 1_000_000) return {value: nf(mm / 1_000), unit: 'm'};
  return {value: nf(mm / 1_000_000), unit: 'km'};
}

/**
 * A STAR FIELD THAT IS THE SAME EVERY BUILD.
 *
 * Parallax by size: the big ones sit closest and travel furthest, which is the
 * whole of the depth here. Drawn as one SVG rather than 90 divs — 90 composited
 * layers cost more per frame than one path list, and at 30fps that is the
 * difference between a two-minute render and a six-minute one.
 */
export const Stars: React.FC<{count?: number; drift?: number; seed?: string; opacity?: number}> = ({
  count = 90,
  drift = 0,
  seed = 'sky',
  opacity = 1,
}) => {
  const {width, height} = useVideoConfig();
  return (
    <AbsoluteFill style={{opacity}}>
      <svg width={width} height={height} style={{position: 'absolute'}}>
        {Array.from({length: count}, (_, i) => {
          const size = 0.6 + hash01(seed, i) * 2.4;
          const depth = size / 3;
          return (
            <circle
              key={i}
              cx={hash01(seed, i + 500) * width}
              cy={(hash01(seed, i + 900) * height + drift * depth * 260) % height}
              r={size}
              fill="#ffffff"
              opacity={0.25 + depth * 0.75}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

/**
 * CHROMATIC ABERRATION ON IMPACT.
 *
 * Two tinted copies of the children, offset a couple of pixels in opposite
 * directions under a screen blend. It costs nothing and it is the single
 * cheapest way a cut reads as a HIT rather than as a change of picture — the
 * eye registers the colour fringe as force.
 */
export const Aberrate: React.FC<React.PropsWithChildren<{amount: number}>> = ({amount, children}) => {
  if (amount < 0.2) return <>{children}</>;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{transform: `translateX(${-amount}px)`, filter: 'url(#none)', mixBlendMode: 'screen', opacity: 0.5}}>
        <AbsoluteFill style={{background: '#ff0040', mixBlendMode: 'multiply'}} />
        {children}
      </AbsoluteFill>
      <AbsoluteFill style={{transform: `translateX(${amount}px)`, mixBlendMode: 'screen', opacity: 0.5}}>
        <AbsoluteFill style={{background: '#00e5ff', mixBlendMode: 'multiply'}} />
        {children}
      </AbsoluteFill>
      <AbsoluteFill>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * CAMERA SHAKE — a decaying wobble, never a constant one.
 *
 * A shake that does not decay is a loop and the eye reads it as a broken
 * player. The decay is what makes it an IMPACT.
 */
export const shake = (frame: number, at: number, force = 14): {x: number; y: number} => {
  const t = frame - at;
  if (t < 0 || t > 22) return {x: 0, y: 0};
  const decay = Math.exp(-t * 0.22);
  return {x: Math.sin(t * 2.1) * force * decay, y: Math.cos(t * 2.7) * force * decay * 0.7};
};

/**
 * GRAIN AND VIGNETTE, DRAWN.
 *
 * The v2 brain's mix, not v1's: grade, grain and vignette YES; grunge,
 * scanlines and gate weave NO. Those three are an archive-film reference and
 * on a 2024 short they read as dirt on the lens rather than as texture.
 */
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export const Look: React.FC<{grain?: number; vignette?: number}> = ({grain = 0.3, vignette = 0.55}) => {
  const frame = useCurrentFrame();
  return (
    <>
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          inset: -60,
          opacity: grain,
          mixBlendMode: 'overlay',
          backgroundImage: NOISE,
          backgroundSize: '180px 180px',
          transform: `translate(${((frame * 17) % 61) - 30}px, ${((frame * 29) % 47) - 23}px)`,
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 88% 74% at 50% 46%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 52%, rgba(0,0,0,${vignette}) 100%)`,
        }}
      />
    </>
  );
};

/** Ease a 0..1 progress across a frame window, clamped at both ends. */
export const ramp = (frame: number, from: number, to: number): number =>
  interpolate(frame, [from, to], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
