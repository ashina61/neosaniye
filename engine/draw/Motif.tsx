import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {CLAMP, drawOn, hash01, posterizeTime} from '../motion';
import type {MotifKind} from '../schema';

/**
 * MOTIFS — the drawn layer that ACTS OUT the sentence.
 *
 * This is the difference between a picture with words over it and a
 * documentary. The reference reel never leaves a photograph alone: the line
 * about money has gold falling through the frame, the line about a journey has
 * a route drawing itself across it, the line about a number has that number
 * climbing. The photograph says WHO and WHERE. The motif says WHAT HAPPENED —
 * and it is the part the eye follows, because it is the only thing in the frame
 * that is changing on purpose.
 *
 * Every one of these is drawn in code, which is law 2 of this repo and also the
 * only thing that works: a generator asked for "gold coins falling" returns one
 * still photograph of coins on a table, and a still photograph of coins is not
 * wealth arriving — it is a picture of coins. Here a coin has a spawn frame, a
 * fall, a tumble, an impact and a place in a pile that grows for as long as the
 * narration is still talking about money.
 *
 * A motif is FRAME-LOCKED, in front of the plate stack, and takes no part in
 * the camera push. It is the graphic layer, not a thing in the room. Anchor it
 * to the room and it stops being a graphic and becomes a prop that is sliding.
 *
 * Nothing here knows what episode it is in: a kind, an anchor, a colour, a
 * seed. Same seed, same frame, every run.
 */
export type {MotifKind} from '../schema';

type Common = {
  from: number;
  count: number;
  x: number;
  y: number;
  size: number;
  colour: string;
  seed: string;
  frame: number;
  duration: number;
  width: number;
  height: number;
  opacity: number;
};

/** Ids leak across scenes if they are not scoped — two gradients, one name. */
const idOf = (seed: string, what: string) => `${what}-${seed.replace(/[^a-z0-9]+/gi, '')}`;

/**
 * WHERE COIN i COMES TO REST.
 *
 * A heap is WIDE AT THE BOTTOM. The obvious triangular-number packing — row r
 * holds r+1 — builds the opposite of a heap: one coin on the floor with an
 * ever-wider shelf balanced on top of it, and on screen that does not read as a
 * pile at all, it reads as a scatter. So the rows are counted from the ground
 * up and each is one narrower than the one below.
 *
 * Filling in arrival order then does the rest for free: the floor covers first,
 * the mound grows upward, and later coins land on top of earlier ones because
 * that is also the order they are drawn in.
 */
function pileSlot(i: number, total: number): {row: number; col: number; width: number} {
  const base = Math.max(2, Math.ceil(Math.sqrt(2 * total)) + 1);
  let row = 0;
  let start = 0;
  for (;;) {
    const width = Math.max(1, base - row);
    if (i < start + width) return {row, col: i - start, width};
    start += width;
    row += 1;
    if (row >= base) return {row: base - 1, col: 0, width: 1};
  }
}

/**
 * COINS — wealth arriving, one piece at a time, and PILING UP.
 *
 * The pile is the whole point. Coins that fall past the frame are weather;
 * coins that land and stay are an amount, and an amount still growing when the
 * sentence ends IS the sentence.
 *
 * A coin tumbles by being squashed horizontally on a cosine — a disc seen
 * edge-on is a line — and the tumble stops on impact. Both halves of that
 * matter: a coin still spinning where it lies is a sprite, and a coin frozen
 * mid-tumble is a sliver of gold with no shape, so the squash has to be eased
 * back to a full round face over the few frames after it lands.
 */
const Coins: React.FC<Common> = ({from, count, x, y, size, colour, seed, frame, opacity}) => {
  const gold = idOf(seed, 'gold');
  const coins = [];
  const unit = size * 0.9;

  for (let i = 0; i < count; i += 1) {
    const r1 = hash01(seed, i * 7 + 1);
    const r2 = hash01(seed, i * 7 + 2);
    const r3 = hash01(seed, i * 7 + 3);

    const spawn = from + Math.round(i * 3.4 + r1 * 5);
    const fall = 15 + Math.round(r2 * 9);
    const land = spawn + fall;
    if (frame < spawn) continue;

    const slot = pileSlot(i, count);
    const radius = size * (0.86 + r3 * 0.24);
    const restX = x + (slot.col - (slot.width - 1) / 2) * unit * 1.6 + (r1 - 0.5) * unit * 0.24;
    const restY = y - slot.row * unit * 0.92;

    const t = interpolate(frame, [spawn, land], [0, 1], {...CLAMP, easing: Easing.in(Easing.quad)});
    const cx = interpolate(t, [0, 1], [restX + (r2 - 0.5) * 120, restX]);
    const cy = interpolate(t, [0, 1], [-radius * 2, restY]);

    // One squash on impact, four frames wide — landing without it reads as the
    // coin being switched off mid-air — and it settles FLATTER than it fell.
    // A coin at rest is a disc seen from above at an angle; leave it perfectly
    // round and the pile is a bag of gold beads.
    const impact = interpolate(frame, [land, land + 2, land + 5], [1, 0.62, 0.8], CLAMP);
    // The tumble unwinds into a flat face — a coin lies down, it does not stop
    // dead on whatever edge it happened to be showing.
    const settled = interpolate(frame, [land, land + 5], [0, 1], CLAMP);
    const spin = Math.min(frame, land) * (0.42 + r3 * 0.3) + r1 * 6;
    const squash = 1 - (1 - (0.16 + 0.84 * Math.abs(Math.cos(spin)))) * (1 - settled);
    const tilt = (r2 - 0.5) * 40 * (1 - settled);

    coins.push(
      <g
        key={i}
        transform={`translate(${cx} ${cy}) rotate(${tilt}) scale(${squash} ${impact})`}
        opacity={interpolate(frame, [spawn, spawn + 2], [0, 1], CLAMP)}
      >
        <circle r={radius} fill={`url(#${gold})`} stroke="rgba(48,28,2,0.55)" strokeWidth={radius * 0.06} />
        <circle r={radius * 0.7} fill="none" stroke="rgba(60,36,4,0.4)" strokeWidth={radius * 0.08} />
        <circle cx={-radius * 0.24} cy={-radius * 0.26} r={radius * 0.19} fill="rgba(255,246,214,0.72)" />
      </g>,
    );
  }

  // A pile casts ONE shadow, not thirty — it is a heap, not a crowd. Its width
  // is the width of the bottom row, so it grows with the pile instead of
  // sitting there as a smudge waiting to be covered.
  const base = Math.max(2, Math.ceil(Math.sqrt(2 * count)) + 1);
  const spread = interpolate(frame, [from, from + base * 4], [unit, base * unit * 0.9], CLAMP);

  return (
    <svg width="100%" height="100%" style={{position: 'absolute', inset: 0, opacity}}>
      <defs>
        <radialGradient id={gold} cx="34%" cy="30%">
          <stop offset="0%" stopColor="#fff3c4" />
          <stop offset="46%" stopColor={colour} />
          <stop offset="100%" stopColor="#7a4a08" />
        </radialGradient>
      </defs>
      <ellipse cx={x} cy={y + size * 0.42} rx={spread} ry={size * 0.42} fill="rgba(0,0,0,0.42)" />
      {coins}
    </svg>
  );
};

/**
 * RISE — the documentary bar, growing.
 *
 * For a sentence whose subject is an AMOUNT going up. Segmented rather than
 * solid, because a solid bar sliding upward reads as a wipe, while blocks
 * arriving one after another read as counting. The dashed line is where it ends
 * up, drawn before the bar gets there, so the growth has somewhere to go.
 */
const Rise: React.FC<Common> = ({from, count, x, y, size, colour, frame, duration, opacity}) => {
  const grow = interpolate(frame, [from, from + duration * 0.62], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  const segment = size * 0.42;
  const gap = segment * 0.26;
  const full = count * (segment + gap);

  const blocks = [];
  for (let i = 0; i < count; i += 1) {
    const reached = interpolate(grow * count, [i, i + 1], [0, 1], CLAMP);
    if (reached <= 0) continue;
    blocks.push(
      <rect
        key={i}
        x={x}
        y={y - (i + 1) * (segment + gap) + gap}
        width={size * 1.9}
        height={segment * reached}
        rx={segment * 0.14}
        fill={colour}
        opacity={0.42 + 0.58 * (i / Math.max(1, count - 1))}
      />,
    );
  }

  return (
    <svg width="100%" height="100%" style={{position: 'absolute', inset: 0, opacity}}>
      <line x1={x - size * 0.4} y1={y} x2={x + size * 2.6} y2={y} stroke={colour} strokeWidth={4} opacity={0.7} />
      <line
        x1={x - size * 0.4}
        y1={y - full}
        x2={x + size * 2.6}
        y2={y - full}
        stroke={colour}
        strokeWidth={3}
        strokeDasharray="14 12"
        opacity={0.45 * drawOn(frame, [from, from + 12])}
      />
      {blocks}
    </svg>
  );
};

/**
 * ROUTE — a journey drawing itself.
 *
 * The line that makes a map a story. It draws on rather than fading in, and a
 * marker rides the head of it: a finished dotted arc says a trip was taken, a
 * drawing one says it is being taken now, while the narrator is describing it.
 */
const Route: React.FC<Common> = ({from, x, y, colour, seed, frame, duration, width, height, opacity}) => {
  /**
   * The ends are derived from the FRAME, not from the motif's size. Scaling an
   * arc off an element size is how the first version threw its far end off the
   * bottom-right corner: the reader saw a swoosh leaving the picture rather
   * than a journey between two places. A route reads left to right and lifts as
   * it goes, and both of its ends have to be inside the frame with room around
   * them for the rings that mark them.
   */
  const margin = width * 0.14;
  const x1 = Math.min(Math.max(x, margin), width * 0.32);
  const y1 = Math.min(Math.max(y, height * 0.24), height * 0.78);
  const x2 = Math.min(width - margin, x1 + width * (0.46 + hash01(seed, 21) * 0.2));
  const y2 = Math.min(height * 0.8, Math.max(height * 0.2, y1 - height * (0.12 + hash01(seed, 22) * 0.14)));
  const cx = (x1 + x2) / 2;
  const cy = Math.min(y1, y2) - height * (0.08 + hash01(seed, 23) * 0.06);
  const path = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;

  const t = drawOn(frame, [from, from + duration * 0.55]);
  // Quadratic Bézier at t — the marker has to ride the drawn head, not a
  // straight line between the ends, or it leaves the road it is drawing.
  const u = 1 - t;
  const mx = u * u * x1 + 2 * u * t * cx + t * t * x2;
  const my = u * u * y1 + 2 * u * t * cy + t * t * y2;
  const len = width * 2;
  // The ghost road and the end rings are not keyed to `t`, so without this they
  // are on from frame zero — which put a map arc over the first half of a
  // portal flight, the one part of that shot that must be left alone.
  const arrive = interpolate(frame, [from, from + 8], [0, 1], CLAMP);

  return (
    <svg width="100%" height="100%" style={{position: 'absolute', inset: 0, opacity: opacity * arrive}}>
      {/* THE ROAD NOT YET WALKED, dashed and faint, drawn before the line gets
          there. Without it the arc has no destination and the marker is just
          travelling; with it the shot states where this is going in frame one. */}
      <path d={path} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth={11} strokeLinecap="round" opacity={0.5} />
      <path
        d={path}
        fill="none"
        stroke={colour}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray="8 16"
        opacity={0.42}
      />
      {/* The casing under the line. A thin coloured stroke over a photograph
          disappears into it wherever the picture happens to be bright. */}
      <path
        d={path}
        fill="none"
        stroke="rgba(12,8,3,0.85)"
        strokeWidth={13}
        strokeLinecap="round"
        strokeDasharray={`${len}`}
        strokeDashoffset={len * (1 - t)}
      />
      <path
        d={path}
        fill="none"
        stroke={colour}
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={`${len}`}
        strokeDashoffset={len * (1 - t)}
      />
      <circle cx={x1} cy={y1} r={13} fill="rgba(12,8,3,0.8)" stroke={colour} strokeWidth={6} />
      {t > 0.02 && t < 0.995 ? (
        <circle cx={mx} cy={my} r={15} fill={colour} stroke="rgba(12,8,3,0.8)" strokeWidth={4} />
      ) : null}
      {t > 0.99 ? <circle cx={x2} cy={y2} r={22} fill="none" stroke={colour} strokeWidth={7} /> : null}
      <circle cx={x2} cy={y2} r={10} fill={colour} opacity={0.35 + 0.65 * (t > 0.99 ? 1 : 0)} />
    </svg>
  );
};

/**
 * EMBERS — specks rising and going out.
 *
 * Heat, ruin, a fire just out of frame. Screen-blended so they add light rather
 * than sit on top as dots, and each one dies at its own height: embers that all
 * fade at the same line are a gradient with sparkles in it.
 */
const Embers: React.FC<Common> = ({from, count, size, colour, seed, frame, width, height, opacity}) => {
  const specks = [];
  for (let i = 0; i < count; i += 1) {
    const r1 = hash01(seed, i * 5 + 31);
    const r2 = hash01(seed, i * 5 + 32);
    const r3 = hash01(seed, i * 5 + 33);
    const period = 90 + r1 * 110;
    const t = (((frame - from) * (0.6 + r2 * 0.9)) / period) % 1;
    if (frame < from || t < 0) continue;
    const top = height * (0.18 + r3 * 0.34);
    const cy = height * 1.02 - t * (height * 1.02 - top);
    const cx = width * (0.1 + r1 * 0.8) + Math.sin(t * Math.PI * (2 + r2 * 3)) * size * 3;
    specks.push(
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r={size * (0.16 + r3 * 0.3)}
        fill={colour}
        opacity={Math.sin(t * Math.PI) * (0.5 + r2 * 0.5)}
      />,
    );
  }
  return (
    <svg width="100%" height="100%" style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity}}>
      {specks}
    </svg>
  );
};

/**
 * RAYS — spokes turning behind the subject.
 *
 * The oldest graphic in the book and still the one that says GLORY. Screen
 * blend and a slow, uneven turn; equal spokes at an even rate read as a loading
 * spinner, which is the exact opposite of what it is for.
 */
const Rays: React.FC<Common> = ({from, count, x, y, size, colour, seed, frame, opacity}) => {
  const fade = interpolate(frame, [from, from + 16], [0, 1], CLAMP);
  const turn = (frame - from) * 0.16;
  const spokes = [];
  for (let i = 0; i < count; i += 1) {
    const r1 = hash01(seed, i * 3 + 41);
    const a = (i / count) * 360 + turn;
    const wedge = 2.4 + r1 * 5.2;
    const len = size * (1.5 + r1 * 1.4);
    spokes.push(
      <path
        key={i}
        d={`M 0 0 L ${len} ${-len * Math.tan((wedge * Math.PI) / 360)} L ${len} ${len * Math.tan((wedge * Math.PI) / 360)} Z`}
        fill={colour}
        opacity={0.1 + r1 * 0.2}
        transform={`rotate(${a})`}
      />,
    );
  }
  return (
    <svg width="100%" height="100%" style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: opacity * fade}}>
      <g transform={`translate(${x} ${y})`}>{spokes}</g>
    </svg>
  );
};

/**
 * TALLY — strokes on a wall, counted in fives.
 *
 * For years, victims, ships, days. Each stroke is DRAWN, one at a time, with
 * the fifth struck across the other four; a tally that appears all at once is a
 * texture, and the counting is the entire content.
 */
const Tally: React.FC<Common> = ({from, count, x, y, size, colour, seed, frame, opacity}) => {
  const strokes = [];
  for (let i = 0; i < count; i += 1) {
    const at = from + i * 5;
    const on = drawOn(frame, [at, at + 4]);
    if (on <= 0) continue;
    const group = Math.floor(i / 5);
    const index = i % 5;
    const gx = x + group * size * 2.1;
    const lean = (hash01(seed, i + 51) - 0.5) * 8;

    if (index === 4) {
      strokes.push(
        <line
          key={i}
          x1={gx - size * 0.18}
          y1={y + size * 0.9}
          x2={gx - size * 0.18 + size * 1.5 * on}
          y2={y + size * 0.9 - size * 1.5 * on * 0.62}
          stroke={colour}
          strokeWidth={size * 0.11}
          strokeLinecap="round"
        />,
      );
    } else {
      const sx = gx + index * size * 0.36;
      strokes.push(
        <line
          key={i}
          x1={sx}
          y1={y}
          x2={sx + lean}
          y2={y + size * on}
          stroke={colour}
          strokeWidth={size * 0.11}
          strokeLinecap="round"
        />,
      );
    }
  }
  return (
    <svg width="100%" height="100%" style={{position: 'absolute', inset: 0, opacity}}>
      {strokes}
    </svg>
  );
};

const DRAWN: Record<MotifKind, React.FC<Common>> = {
  coins: Coins,
  rise: Rise,
  route: Route,
  embers: Embers,
  rays: Rays,
  tally: Tally,
};

/** Sensible element counts per kind, so a scene only has to name the kind. */
const COUNT: Record<MotifKind, number> = {coins: 21, rise: 7, route: 1, embers: 26, rays: 22, tally: 12};

/**
 * The same knobs, read off a scene's params — because three templates want a
 * motif and none of them should own its parameter names. A scene that names no
 * motif draws none, which is how every existing config keeps working.
 */
export const SceneMotif: React.FC<{
  params?: Record<string, unknown>;
  seed: string;
  durationInFrames: number;
  accent?: string;
  defaultX?: number;
  defaultY?: number;
}> = ({params, seed, durationInFrames, accent = '#f2b53a', defaultX, defaultY}) => {
  const kind = typeof params?.motif === 'string' ? (params.motif as MotifKind) : '';
  if (!kind || !DRAWN[kind as MotifKind]) return null;

  const num = (key: string, fallback: number | undefined): number | undefined => {
    const value = params?.[key];
    return typeof value === 'number' ? value : fallback;
  };

  return (
    <Motif
      kind={kind as MotifKind}
      from={num('motifFrame', 12) as number}
      count={num('motifCount', undefined)}
      x={num('motifX', defaultX)}
      y={num('motifY', defaultY)}
      size={num('motifSize', 46) as number}
      opacity={num('motifOpacity', 1) as number}
      colour={typeof params?.motifColour === 'string' ? params.motifColour : accent}
      seed={seed}
      durationInFrames={durationInFrames}
    />
  );
};

export const Motif: React.FC<{
  kind: MotifKind;
  from?: number;
  count?: number;
  x?: number;
  y?: number;
  size?: number;
  colour?: string;
  opacity?: number;
  seed?: string;
  durationInFrames: number;
}> = ({kind, from = 0, count, x, y, size = 46, colour = '#f2b53a', opacity = 1, seed = 'motif', durationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const Drawn = DRAWN[kind];
  if (!Drawn) return null;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <Drawn
        from={from}
        count={count ?? COUNT[kind]}
        x={x ?? width * 0.5}
        y={y ?? height * 0.72}
        size={size}
        colour={colour}
        opacity={opacity}
        seed={seed}
        frame={posterizeTime(frame, fps, 12)}
        duration={durationInFrames}
        width={width}
        height={height}
      />
    </AbsoluteFill>
  );
};
