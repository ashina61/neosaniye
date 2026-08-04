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
 * A motif is drawn twice: a solid mass in ink, and a rim of accent down the
 * lit edge. One shape reads as a sticker; a shape with a light direction reads
 * as an object standing in the set's light.
 */
export const Motif: React.FC<{id: MotifId; size: number; seed?: string; rim?: number}> = ({
  id,
  size,
  seed = 'motif',
  rim = 1,
}) => {
  const {palette, motion} = useLook();
  const path = PATHS[id] ?? PATHS.tower;
  const tilt = (hash01(seed, 5) - 0.5) * 5 * motion.polarity;
  // THE ID MUST INCLUDE `rim`.
  //
  // A rig draws the same motif twice: once blackened as the cast shadow (rim 0)
  // and once lit (rim 1). With one id for both, the two <defs> collide and the
  // browser resolves `url(#id)` to whichever came FIRST in the document — the
  // shadow's fully transparent gradient. The lit object then rendered as a bare
  // outline, which is exactly how it looked on screen.
  const rimId = `rim-${id}-${rim > 0 ? 'lit' : 'dark'}-${Math.round(hash01(seed, 9) * 1e6)}`;

  return (
    <div style={{position: 'relative', width: size, height: size, display: 'grid', placeItems: 'center'}}>
      {/* BACKLIGHT.
          A dark silhouette on a dark set is an outline, not an object — the
          first render of these motifs came out as thin gold wireframes because
          the fill and the room were the same value. A pool of light behind the
          shape gives it something to be a silhouette AGAINST, which is how the
          eye reads a subject in a photograph too. */}
      <div
        style={{
          position: 'absolute',
          width: size * 1.45,
          height: size * 1.45,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${palette.accent}40 0%, ${palette.accentDark}22 42%, rgba(0,0,0,0) 72%)`,
          filter: 'blur(6px)',
        }}
      />
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{display: 'block', position: 'relative', transform: `rotate(${tilt}deg)`, filter: `drop-shadow(${-12 * motion.polarity}px 16px 22px rgba(0,0,0,0.6))`}}
    >
      <defs>
        {/* A LIT MASS, NOT A WIREFRAME.
            The first version faded the body to ink, which on an ink-dark set
            left only the 1.6px outline visible — the objects read as clip-art
            line drawings. The body now runs from the paper tone through the
            accent to ink, so the shape is a solid volume with a lit side and a
            shadow side. */}
        <linearGradient id={rimId} x1={motion.polarity > 0 ? '0' : '1'} y1="0" x2={motion.polarity > 0 ? '1' : '0'} y2="1">
          <stop offset="0%" stopColor={palette.paperLight} stopOpacity={0.92 * rim} />
          <stop offset="26%" stopColor={palette.accent} stopOpacity={0.82 * rim} />
          <stop offset="62%" stopColor={palette.accentDark} stopOpacity={0.68 * rim} />
          <stop offset="100%" stopColor={palette.ink} stopOpacity={0.95} />
        </linearGradient>
      </defs>
      <path d={path} fill={palette.ink} stroke={palette.ink} strokeWidth={3} strokeLinejoin="round" />
      <path d={path} fill={`url(#${rimId})`} stroke="none" opacity={0.95} />
      <path
        d={path}
        fill="none"
        stroke={palette.accent}
        strokeOpacity={0.5 * rim}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
    </div>
  );
};
