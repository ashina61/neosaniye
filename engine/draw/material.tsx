/**
 * MATERIALS AND DEPTH — what makes a drawing stop looking like an SVG.
 *
 * The representation layer answered WHAT to show. Looking at the frames it
 * produced answered nothing about how they felt: semantically correct diagrams,
 * flat, sitting on a gradient. A section through concrete and a section through
 * flesh were the same hatched rectangle in a different colour.
 *
 * THE DISCIPLINE HERE IS SUBTRACTIVE.
 *
 * These are documentary graphics, not renders. Everything below is a THIN
 * treatment — a grain, a raking highlight, a contact shadow, a haze — at
 * strengths chosen so that removing them is noticeable and noticing them is
 * not. Anything that draws attention to itself as an effect has failed, and the
 * test is simple: if it does not communicate force, depth, material, scale,
 * causality, emphasis, space or time, it does not go in.
 *
 * And all of it is DETERMINISTIC. Every speckle, every fibre, every dust mote
 * comes from a hash of a seed, so the same shot draws the same way on every
 * machine and on every rerun. Random noise in a render is a render you cannot
 * review twice.
 */
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {hash01, posterizeTime} from '../motion';

/** The materials a documentary graphic actually needs to distinguish. */
export type Material =
  | 'stone'
  | 'metal'
  | 'bronze'
  | 'water'
  | 'wood'
  | 'iron'
  | 'flesh'
  | 'concrete'
  | 'paper'
  | 'none';

/**
 * HOW EACH MATERIAL BEHAVES UNDER LIGHT.
 *
 * Four numbers per material and nothing else, because four is enough to tell
 * stone from metal and a fifth would only be a knob nobody sets correctly.
 *
 *   `sheen`    how sharply it takes a highlight — metal is a line, stone a wash
 *   `tooth`    surface grain, as speckle density
 *   `depth`    how dark its own shadow is
 *   `give`     how much it responds to force, for the motion layer
 */
export const MATERIALS: Record<Material, {sheen: number; tooth: number; depth: number; give: number}> = {
  stone: {sheen: 0.1, tooth: 0.85, depth: 0.55, give: 0.02},
  concrete: {sheen: 0.08, tooth: 1, depth: 0.5, give: 0.03},
  metal: {sheen: 0.95, tooth: 0.12, depth: 0.4, give: 0.1},
  iron: {sheen: 0.7, tooth: 0.3, depth: 0.45, give: 0.12},
  bronze: {sheen: 0.8, tooth: 0.22, depth: 0.42, give: 0.08},
  wood: {sheen: 0.25, tooth: 0.6, depth: 0.38, give: 0.22},
  water: {sheen: 1, tooth: 0.05, depth: 0.2, give: 1},
  flesh: {sheen: 0.35, tooth: 0.18, depth: 0.3, give: 0.6},
  paper: {sheen: 0.15, tooth: 0.45, depth: 0.18, give: 0.35},
  none: {sheen: 0, tooth: 0, depth: 0, give: 0},
};

/**
 * THE SVG DEFS EVERY MATERIAL NEEDS, DECLARED ONCE PER PLATE.
 *
 * Ids are namespaced by the caller so two drawings in one frame cannot collide.
 * A gradient and a speckle pattern; the shadow is drawn as geometry rather than
 * as a filter, because an SVG blur filter over a full-frame drawing costs more
 * than the whole rest of the render.
 */
export const MaterialDefs: React.FC<{
  id: string;
  material: Material;
  colour: string;
  w: number;
  seed?: string;
  /**
   * WHAT COLOUR THE HIGHLIGHT IS.
   *
   * White by default, because that is what a light source is. But a highlight
   * on something INCANDESCENT is the colour of the thing: white-stopped sheen
   * over hot iron washed the heat out and delivered a blade that looked like
   * frosted glass. Where the object is its own light source, the caller says so.
   */
  tint?: string;
}> = ({id, material, colour, w, seed = 'm', tint = '#ffffff'}) => {
  const m = MATERIALS[material] ?? MATERIALS.none;
  if (material === 'none') return null;
  const speckles = Math.round(m.tooth * 26);
  return (
    <defs>
      {/**
       * THE RAKING LIGHT.
       *
       * One direction for the whole reel — the light in a room has a source —
       * and a falloff that says what the surface is: metal goes from bright to
       * dark across a few per cent, stone across the whole face.
       */}
      <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0.7" y2="1">
        <stop offset="0%" stopColor={tint} stopOpacity={0.05 + m.sheen * 0.1} />
        <stop offset={`${18 + (1 - m.sheen) * 40}%`} stopColor={tint} stopOpacity={0.015 + m.sheen * 0.03} />
        <stop offset="100%" stopColor="#000000" stopOpacity={m.depth * 0.3} />
      </linearGradient>
      {/** A HARD SPECULAR LINE, and only where the material earns one. */}
      {m.sheen > 0.6 ? (
        <linearGradient id={`${id}-spec`} x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0%" stopColor={tint} stopOpacity={0} />
          <stop offset="46%" stopColor={tint} stopOpacity={m.sheen * 0.22} />
          <stop offset="54%" stopColor={tint} stopOpacity={0} />
        </linearGradient>
      ) : null}
      {/**
       * TOOTH — the surface's own grain, as deterministic speckle.
       *
       * Not a noise filter: a fixed set of dots placed by hash. Concrete gets a
       * dense scatter, metal almost none, and the pattern is identical on every
       * run so a frame can be reviewed twice and be the same frame.
       */}
      {speckles > 0 ? (
        <pattern id={`${id}-tooth`} width={w * 0.05} height={w * 0.05} patternUnits="userSpaceOnUse">
          {Array.from({length: speckles}, (_, i) => (
            <circle
              key={i}
              cx={hash01(seed, i * 3 + 1) * w * 0.05}
              cy={hash01(seed, i * 3 + 2) * w * 0.05}
              r={w * (0.0004 + hash01(seed, i * 3 + 3) * 0.0011)}
              fill={colour}
              opacity={0.1 + m.tooth * 0.22}
            />
          ))}
        </pattern>
      ) : null}
    </defs>
  );
};

/**
 * THE TREATMENT, PAINTED OVER A SHAPE.
 *
 * Applied as siblings of the shape with the same path, so it works on anything
 * — a block, a chamber, a stratum — without the shape having to know about it.
 */
export const MaterialFace: React.FC<{
  id: string;
  material: Material;
  d?: string;
  rect?: {x: number; y: number; w: number; h: number};
  ellipse?: {cx: number; cy: number; rx: number; ry: number};
  w: number;
}> = ({id, material, d, rect, ellipse, w}) => {
  const m = MATERIALS[material] ?? MATERIALS.none;
  if (material === 'none') return null;
  const shape = (fill: string, key: string, opacity = 1) => {
    if (d) return <path key={key} d={d} fill={fill} opacity={opacity} />;
    if (rect) return <rect key={key} x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={fill} opacity={opacity} />;
    if (ellipse) return <ellipse key={key} cx={ellipse.cx} cy={ellipse.cy} rx={ellipse.rx} ry={ellipse.ry} fill={fill} opacity={opacity} />;
    return null;
  };
  return (
    <g style={{pointerEvents: 'none'}}>
      {shape(`url(#${id}-sheen)`, 'sheen')}
      {m.tooth > 0 ? shape(`url(#${id}-tooth)`, 'tooth', 0.9) : null}
      {m.sheen > 0.6 ? shape(`url(#${id}-spec)`, 'spec', 0.8) : null}
    </g>
  );
};

/**
 * A CONTACT SHADOW — the cheapest depth cue there is, and the most missed.
 *
 * An object with no shadow is a sticker. Drawn as a squashed ellipse rather
 * than as a blur filter: it costs nothing, it reads correctly at thumbnail
 * size, and its DARKNESS tells you how close the object is to the surface,
 * which is the actual information.
 */
export const Contact: React.FC<{x: number; y: number; width: number; strength?: number; colour?: string}> = ({
  x,
  y,
  width,
  strength = 0.5,
  colour = '#000000',
}) => (
  <ellipse
    cx={x}
    cy={y}
    rx={width * 0.55}
    ry={Math.max(2, width * 0.045)}
    fill={colour}
    opacity={0.34 * strength}
    style={{filter: `blur(${Math.max(2, width * 0.02)}px)`}}
  />
);

/* ── DEPTH ─────────────────────────────────────────────────────────────── */

/**
 * FOUR PLANES, AND THE RATE EACH ONE MOVES AT.
 *
 * Law 4 says a shot is a stack held together by one number. Depth held the
 * photographic templates together and never reached the drawings, so every
 * procedural composition was one plane: a diagram, flat, on a gradient. The
 * fix is the same number.
 *
 * The rates are what make a camera move REVEAL something rather than just
 * enlarge it. Background barely moves, foreground moves most, and the parallax
 * between them is the whole of the depth cue.
 */
export const PLANES = {
  background: 0.16,
  secondary: 0.52,
  primary: 1,
  foreground: 1.55,
} as const;

export type Plane = keyof typeof PLANES;

/**
 * PUT A GROUP ON A PLANE.
 *
 * `push` is the shot's camera, shared by every plane so they hold together as
 * one space; `drift` is a slow lateral travel the plane takes at its own rate.
 * Both scale about the same anchor, or the planes slide off each other — the
 * number one way this effect breaks.
 */
export const Depth: React.FC<{
  plane: Plane;
  push?: number;
  drift?: number;
  anchor?: [number, number];
  w: number;
  h: number;
  children: React.ReactNode;
}> = ({plane, push = 1, drift = 0, anchor = [0.5, 0.6], w, h, children}) => {
  const rate = PLANES[plane];
  const scale = 1 + (push - 1) * rate;
  const ax = anchor[0] * w;
  const ay = anchor[1] * h;
  return (
    <g transform={`translate(${ax} ${ay}) scale(${scale}) translate(${-ax} ${-ay}) translate(${drift * rate} 0)`}>
      {children}
    </g>
  );
};

/**
 * ATMOSPHERIC DEPTH — distance makes things paler, not just smaller.
 *
 * A wash laid over the far planes at the ground's own colour. It is the reason
 * a mountain reads as far away in a drawing with no perspective in it, and it
 * costs one rectangle.
 */
export const Haze: React.FC<{colour: string; strength?: number; w: number; h: number; from?: number}> = ({
  colour,
  strength = 0.22,
  w,
  h,
  from = 0.1,
}) => (
  <rect
    x={0}
    y={0}
    width={w}
    height={h}
    fill={colour}
    opacity={strength}
    style={{maskImage: `linear-gradient(180deg, rgba(0,0,0,1) ${from * 100}%, rgba(0,0,0,0) 82%)`, WebkitMaskImage: `linear-gradient(180deg, rgba(0,0,0,1) ${from * 100}%, rgba(0,0,0,0) 82%)`}}
  />
);

/* ── MICRO-MOTION ──────────────────────────────────────────────────────── */

/**
 * A SHOT CAN BE ALIVE WITHOUT CHANGING.
 *
 * The last benchmark's frames were correct and inert: nothing moved except the
 * thing being explained, so between one event and the next the picture was a
 * still. Dust does not explain anything, and that is exactly why it is allowed
 * — it says the air in this room exists, and then it gets out of the way.
 *
 * THE RULE IS SUBORDINATION. Everything here is under 40% opacity, slower than
 * the subject, and never crosses the middle of the frame. The moment
 * micro-motion competes for attention it has become an effect.
 */
export const Motes: React.FC<{
  w: number;
  h: number;
  colour: string;
  count?: number;
  seed?: string;
  /** 0 still air, 1 a room with a draught. */
  air?: number;
  band?: [number, number];
}> = ({w, h, colour, count = 18, seed = 'air', air = 0.5, band = [0.1, 0.9]}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  return (
    <g style={{pointerEvents: 'none'}}>
      {Array.from({length: count}, (_, i) => {
        const speed = 0.12 + hash01(seed, i) * 0.3;
        const x = ((hash01(seed, i + 100) + (stepped / fps) * speed * air * 0.06) % 1) * w;
        const sway = Math.sin(stepped / (26 + hash01(seed, i + 200) * 30) + i) * h * 0.012;
        const y = (band[0] + hash01(seed, i + 300) * (band[1] - band[0])) * h + sway;
        const r = w * (0.0009 + hash01(seed, i + 400) * 0.0016);
        return <circle key={i} cx={x} cy={y} r={r} fill={colour} opacity={0.1 + hash01(seed, i + 500) * 0.22} />;
      })}
    </g>
  );
};

/**
 * HEAT SHIMMER — a vertical wobble over a hot thing.
 *
 * Returns a transform string rather than an element, so the caller applies it
 * to whatever is actually hot. Tiny: half a per cent of the frame. Anything
 * more is a water effect.
 */
export function shimmer(frame: number, heat: number, w: number, i = 0): string {
  if (heat <= 0.05) return '';
  const a = Math.sin(frame / 4 + i * 1.7) * w * 0.0016 * heat;
  const b = Math.cos(frame / 5.5 + i) * w * 0.0011 * heat;
  return `translate(${a} ${b})`;
}
