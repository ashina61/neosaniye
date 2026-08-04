import React from 'react';
import {useLook} from './look';
import {hash01} from './motion';

/**
 * MOTIFS — the drawn object a scene is actually about.
 *
 * The rigs give a scene its mechanic and the sets give it a place, but neither
 * knows what the story is. Without this file every reel showed the same empty
 * chair and the same skyline no matter what was being narrated: a whale, a
 * rocket and a bank vault all rendered identically. That is the "you keep
 * drawing the same thing" failure, and colour variation does not touch it.
 *
 * So each beat draws the object ITS OWN LINE is about. These are silhouettes
 * with a rim light, not illustrations — a machine cannot draw a convincing
 * whale, but it can draw a convincing SHAPE of one, lit from one side, and a
 * shape lit from one side reads at phone size in half a second.
 *
 * Every motif is palette-driven and sized in one number so a rig can punch it,
 * shadow it and boil it exactly like a photographic cut-out.
 */

export type MotifId =
  | 'ship' | 'rocket' | 'whale' | 'vault' | 'gavel' | 'gear' | 'flask' | 'tree'
  | 'mountain' | 'tower' | 'coins' | 'letter' | 'key' | 'crown' | 'clock'
  | 'skull' | 'plane' | 'train' | 'camera' | 'book' | 'bulb' | 'anchor';

const PATHS: Record<MotifId, string> = {
  // Each path is drawn inside a 100×100 box, feet at y≈96 so rigs can anchor
  // it to a ground point the same way they anchor a photograph.
  ship: 'M8 70 h84 l-10 18 h-64 z M28 70 v-40 h6 v40 z M34 32 l30 12 -30 10 z M34 30 h-2 l-14 24 h16 z',
  rocket: 'M50 6 q16 20 16 44 v20 h-32 v-20 q0 -24 16 -44 z M34 60 l-14 22 h14 z M66 60 l14 22 h-14 z M42 88 q8 10 16 0 q-8 6 -16 0 z',
  whale: 'M6 58 q22 -26 52 -22 q26 4 36 20 q-10 16 -36 20 q-30 4 -52 -18 z M92 44 l8 -14 -2 20 z M40 44 a3 3 0 1 0 0.1 0 z',
  vault: 'M12 14 h76 v72 h-76 z M50 50 m-22 0 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0 z M50 26 v-8 M50 74 v8 M26 50 h-8 M74 50 h8 M50 50 l14 -14',
  gavel: 'M22 62 l30 -30 14 14 -30 30 z M58 20 l22 22 -10 10 -22 -22 z M10 84 h44 v10 h-44 z',
  gear: 'M50 22 l7 2 4 -7 8 5 -2 8 6 6 8 -2 4 9 -7 4 v8 l7 4 -4 9 -8 -2 -6 6 2 8 -8 5 -4 -7 -7 2 -7 -2 -4 7 -8 -5 2 -8 -6 -6 -8 2 -4 -9 7 -4 v-8 l-7 -4 4 -9 8 2 6 -6 -2 -8 8 -5 4 7 z M50 44 a10 10 0 1 0 0.1 0 z',
  flask: 'M40 10 h20 v26 l22 46 q4 10 -8 10 h-48 q-12 0 -8 -10 l22 -46 z M34 62 h32 l10 20 h-52 z',
  tree: 'M46 96 h8 v-30 h-8 z M50 8 q22 14 18 32 q14 8 6 22 q-10 12 -24 8 q-14 4 -24 -8 q-8 -14 6 -22 q-4 -18 18 -32 z',
  mountain: 'M4 88 l30 -56 16 26 10 -16 36 46 z M34 32 l8 14 -16 0 z',
  tower: 'M36 96 l6 -60 h16 l6 60 z M42 36 l8 -30 8 30 z M40 60 h20 M38 74 h24',
  coins: 'M22 78 a26 8 0 1 0 52 0 a26 8 0 1 0 -52 0 z M22 66 a26 8 0 1 0 52 0 a26 8 0 1 0 -52 0 z M22 54 a26 8 0 1 0 52 0 a26 8 0 1 0 -52 0 z M56 22 a16 16 0 1 0 0.1 0 z',
  letter: 'M10 26 h80 v52 h-80 z M10 26 l40 30 40 -30 M10 78 l28 -24 M90 78 l-28 -24',
  key: 'M30 34 a18 18 0 1 0 0.1 0 z M44 46 h44 v10 h-8 v10 h-8 v-10 h-8 v14 h-8 v-14 h-12 z',
  crown: 'M14 76 h72 l6 -46 -22 18 -20 -30 -20 30 -22 -18 z M14 80 h72 v10 h-72 z',
  clock: 'M50 50 m-40 0 a40 40 0 1 0 80 0 a40 40 0 1 0 -80 0 z M50 22 v30 l20 12',
  skull: 'M50 8 q30 0 30 32 q0 16 -10 22 v14 q0 6 -8 6 h-24 q-8 0 -8 -6 v-14 q-10 -6 -10 -22 q0 -32 30 -32 z M38 40 a8 8 0 1 0 0.1 0 z M62 40 a8 8 0 1 0 0.1 0 z M46 60 h8 l-4 10 z',
  plane: 'M50 6 q6 0 6 14 v22 l38 22 v10 l-38 -12 v18 l12 10 v8 l-18 -6 -18 6 v-8 l12 -10 v-18 l-38 12 v-10 l38 -22 v-22 q0 -14 6 -14 z',
  train: 'M14 26 h48 v40 h-48 z M62 40 h20 l8 26 h-28 z M18 66 h72 v8 h-72 z M26 78 a7 7 0 1 0 0.1 0 z M62 78 a7 7 0 1 0 0.1 0 z M24 34 h14 v14 h-14 z',
  camera: 'M12 32 h18 l8 -10 h24 l8 10 h18 v46 h-76 z M50 54 m-16 0 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0 z',
  book: 'M12 22 q22 -8 38 0 v58 q-16 -8 -38 0 z M88 22 q-22 -8 -38 0 v58 q16 -8 38 0 z',
  bulb: 'M50 8 q22 0 22 24 q0 14 -10 22 v10 h-24 v-10 q-10 -8 -10 -22 q0 -24 22 -24 z M40 70 h20 v6 h-20 z M42 80 h16 v6 h-16 z',
  anchor: 'M46 18 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 z M48 26 h4 v56 h-4 z M30 42 h40 M14 62 q4 30 36 30 q32 0 36 -30 l-10 6 q-6 16 -26 16 q-20 0 -26 -16 z',
};

export const MOTIF_IDS = Object.keys(PATHS) as MotifId[];

/**
 * HOW A MOTIF IS DRAWN, AND WHY IT USED TO LOOK LIKE CLIP ART.
 *
 * The first version stroked every shape with a 1.6px accent outline and filled
 * it flat. That is the visual grammar of an icon set, and it is exactly why the
 * frames read as a nursery video: nothing in a photograph has a uniform outline
 * around it.
 *
 * What replaces it is how a real object separates from a real background:
 *
 *   FORM      a soft vertical gradient — lit from the light side, falling into
 *             shadow away from it. No stroke anywhere.
 *   RIM       a thin bright edge on the lit side only, drawn as a clipped,
 *             offset copy rather than as a border.
 *   BOUNCE    a faint fill from the shadow side, because rooms bounce light.
 *   CONTACT   a hard, tight shadow directly under the object plus a long soft
 *             one away from the light. Objects that do not touch the ground
 *             float, and floating is the other half of "cartoon".
 *   DEFOCUS   optional blur, so a motif can sit off the focal plane like
 *             everything else in a real frame.
 */
export const Motif: React.FC<{
  id: MotifId;
  size: number;
  seed?: string;
  /** 0 turns off all lighting — used when the rig draws this as a shadow. */
  rim?: number;
  /** Blur in pixels: this object is not on the focal plane. */
  defocus?: number;
}> = ({id, size, seed = 'motif', rim = 1, defocus = 0}) => {
  const {palette, motion} = useLook();
  const path = PATHS[id] ?? PATHS.tower;
  const tilt = (hash01(seed, 5) - 0.5) * 5 * motion.polarity;
  const lit = motion.polarity > 0;
  // Ids must differ between the lit and shadow copies of the same motif, or the
  // browser resolves url(#id) to whichever <defs> came first in the document
  // and both draw with the same paint. That bug shipped once; the suffix is it.
  const key = `${id}-${rim > 0 ? 'lit' : 'dark'}-${Math.round(hash01(seed, 9) * 1e6)}`;

  if (rim <= 0) {
    // The shadow copy: a solid mass, no shading, no rim. The rig blackens and
    // skews it, so any modelling here would only fight that.
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" style={{display: 'block'}}>
        <path d={path} fill={palette.ink} />
      </svg>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size * 1.16,
        display: 'grid',
        placeItems: 'end center',
        filter: defocus > 0 ? `blur(${defocus}px)` : undefined,
      }}
    >
      {/* the light the object stands in — a pool behind and under it */}
      <div
        style={{
          position: 'absolute',
          left: '-24%',
          right: '-24%',
          top: '-10%',
          bottom: '-6%',
          background: `radial-gradient(ellipse 52% 48% at ${lit ? 34 : 66}% 44%, ${palette.accent}33 0%, ${palette.accentDark}1a 44%, rgba(0,0,0,0) 74%)`,
          filter: 'blur(10px)',
        }}
      />

      {/* the long cast shadow, thrown away from the light and fading out */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: lit ? '18%' : '-30%',
          width: '112%',
          height: '13%',
          background: `linear-gradient(${lit ? 90 : 270}deg, ${palette.ink}e6 0%, ${palette.ink}66 46%, rgba(0,0,0,0) 100%)`,
          filter: 'blur(9px)',
          transform: 'scaleY(0.7)',
        }}
      />

      {/* the contact shadow: small, dark, tight under the object */}
      <div
        style={{
          position: 'absolute',
          bottom: '1%',
          left: '26%',
          width: '48%',
          height: '5%',
          borderRadius: '50%',
          background: `${palette.ink}f2`,
          filter: 'blur(5px)',
        }}
      />

      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        style={{display: 'block', position: 'relative', transform: `rotate(${tilt}deg)`}}
      >
        <defs>
          {/* FORM: lit side bright, shadow side sinking to ink. */}
          <linearGradient id={`form-${key}`} x1={lit ? '0' : '1'} y1="0.1" x2={lit ? '0.9' : '0.1'} y2="1">
            <stop offset="0%" stopColor={palette.paperLight} stopOpacity={0.96} />
            <stop offset="22%" stopColor={palette.paperDark} stopOpacity={0.9} />
            <stop offset="58%" stopColor={palette.accentDark} stopOpacity={0.72} />
            <stop offset="100%" stopColor={palette.ink} stopOpacity={0.98} />
          </linearGradient>
          {/* BOUNCE: the shadow side is never truly black in a room. */}
          <linearGradient id={`bounce-${key}`} x1={lit ? '1' : '0'} y1="1" x2={lit ? '0.2' : '0.8'} y2="0.2">
            <stop offset="0%" stopColor={palette.cool} stopOpacity={0.34} />
            <stop offset="46%" stopColor={palette.cool} stopOpacity={0.06} />
            <stop offset="100%" stopColor={palette.cool} stopOpacity={0} />
          </linearGradient>
          <clipPath id={`clip-${key}`}>
            <path d={path} />
          </clipPath>
        </defs>

        <path d={path} fill={`url(#form-${key})`} />
        <path d={path} fill={`url(#bounce-${key})`} />

        {/* RIM: the same shape, nudged toward the light and clipped to itself,
            leaves a bright sliver on exactly one edge. */}
        <g clipPath={`url(#clip-${key})`}>
          <path
            d={path}
            fill="none"
            stroke={palette.white}
            strokeOpacity={0.5}
            strokeWidth={3}
            transform={`translate(${lit ? -1.6 : 1.6}, -1.6)`}
          />
        </g>
      </svg>
    </div>
  );
};
