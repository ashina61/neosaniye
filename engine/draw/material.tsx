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
/**
 * ALBEDO — the value the material HAS, before any light hits it.
 *
 * The first version of this table had none, and the consequence was visible in
 * every frame the pipeline delivered: a treatment made of a raking gradient and
 * a speckle, painted onto whatever the plate had drawn underneath, which was a
 * near-black rectangle. Six per cent of white at the top edge is a highlight,
 * and a highlight with no body under it is a silhouette. A thousand-ton block
 * of limestone came out darker than the sky behind it.
 *
 * A material is a value first and a finish second. Limestone is a mid grey you
 * could read a newspaper by; wrought iron is dark; paper is nearly white. Get
 * that wrong and no amount of specular does anything, because there is nothing
 * for the light to be falling ON.
 *
 * `body` is that value, `bodyAlpha` is how much of it survives — the one
 * material you can see through is water, and it is the only one that should be
 * a wash rather than a mass.
 */
export const MATERIALS: Record<
  Material,
  {sheen: number; tooth: number; depth: number; give: number; body: number; bodyAlpha: number}
> = {
  stone: {sheen: 0.1, tooth: 0.85, depth: 0.55, give: 0.02, body: 0.34, bodyAlpha: 1},
  concrete: {sheen: 0.08, tooth: 1, depth: 0.5, give: 0.03, body: 0.4, bodyAlpha: 1},
  metal: {sheen: 0.95, tooth: 0.12, depth: 0.4, give: 0.1, body: 0.44, bodyAlpha: 1},
  iron: {sheen: 0.7, tooth: 0.3, depth: 0.45, give: 0.12, body: 0.24, bodyAlpha: 1},
  bronze: {sheen: 0.8, tooth: 0.22, depth: 0.42, give: 0.08, body: 0.32, bodyAlpha: 1},
  wood: {sheen: 0.25, tooth: 0.6, depth: 0.38, give: 0.22, body: 0.28, bodyAlpha: 1},
  water: {sheen: 1, tooth: 0.05, depth: 0.2, give: 1, body: 0.2, bodyAlpha: 0.5},
  flesh: {sheen: 0.35, tooth: 0.18, depth: 0.3, give: 0.6, body: 0.32, bodyAlpha: 0.92},
  paper: {sheen: 0.15, tooth: 0.45, depth: 0.18, give: 0.35, body: 0.7, bodyAlpha: 1},
  none: {sheen: 0, tooth: 0, depth: 0, give: 0, body: 0, bodyAlpha: 0},
};

/**
 * A NEUTRAL AT A GIVEN VALUE, warmed the way daylight on a solid is warm.
 *
 * Not pure grey: a perfectly neutral mass in a warm-graded frame reads as a
 * hole cut in the picture. The bias is small enough to be a temperature and
 * not a colour.
 */
function value(v: number): string {
  const l = Math.round(255 * Math.max(0, Math.min(1, v)));
  return `rgb(${l}, ${Math.round(l * 0.955)}, ${Math.round(l * 0.9)})`;
}

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
      {/**
       * THE BODY — the material's own value, laid down before any light.
       *
       * Two stops rather than one, because a mass is never one value: the face
       * turned toward the key is lighter than the face turned away, and that
       * difference IS the reading of it as a solid rather than a shape. Warmed
       * a few per cent toward the object's own colour so a stone block and a
       * bronze plate are not the same grey with different highlights.
       */}
      <linearGradient id={`${id}-body`} x1="0.1" y1="0" x2="0.6" y2="1">
        <stop offset="0%" stopColor={value(m.body * 1.18)} stopOpacity={m.bodyAlpha} />
        <stop offset="62%" stopColor={value(m.body * 0.86)} stopOpacity={m.bodyAlpha} />
        <stop offset="100%" stopColor={value(m.body * 0.52)} stopOpacity={m.bodyAlpha} />
      </linearGradient>
      {/** The hue, as a wash over the body rather than as the body itself. */}
      <linearGradient id={`${id}-hue`} x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stopColor={colour} stopOpacity={0.2} />
        <stop offset="100%" stopColor={colour} stopOpacity={0.08} />
      </linearGradient>
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
  const bodyFill = 'url(#' + id + '-body)';
  const hueFill = 'url(#' + id + '-hue)';
  const shape = (fill: string, key: string, opacity = 1) => {
    if (d) return <path key={key} d={d} fill={fill} opacity={opacity} />;
    if (rect) return <rect key={key} x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={fill} opacity={opacity} />;
    if (ellipse) return <ellipse key={key} cx={ellipse.cx} cy={ellipse.cy} rx={ellipse.rx} ry={ellipse.ry} fill={fill} opacity={opacity} />;
    return null;
  };
  return (
    <g style={{pointerEvents: 'none'}}>
      {/* BODY FIRST. The light goes on top of the material, not instead of it. */}
      {m.body > 0 ? shape(bodyFill, 'body') : null}
      {m.body > 0 ? shape(hueFill, 'hue') : null}
      {shape(`url(#${id}-sheen)`, 'sheen')}
      {m.tooth > 0 ? shape(`url(#${id}-tooth)`, 'tooth', 0.9) : null}
      {m.sheen > 0.6 ? shape(`url(#${id}-spec)`, 'spec', 0.8) : null}
    </g>
  );
};

/**
 * THE GROUND, AS A SURFACE RATHER THAN AS A LINE.
 *
 * A haulage drawing put a hatched line at three fifths of the frame and left
 * the seven hundred pixels below it black. Nothing was wrong with any object in
 * the shot; the shot was a band of drawing floating in a void, and in a 9:16
 * frame that void is most of what the viewer is looking at.
 *
 * The fix is not to fill it. It is to admit that the ground CONTINUES toward
 * the viewer: a wash that falls off with distance and a few lines running away
 * to a point on the horizon. Two per cent of ink, and the lower third stops
 * being empty and starts being floor — which is also true, and is the thing
 * that makes the object standing on it read as standing on something.
 */
export const GroundPlane: React.FC<{
  y: number;
  w: number;
  h: number;
  colour: string;
  id?: string;
  strength?: number;
}> = ({y, w, h, colour, id = 'gp', strength = 1}) => {
  const vpx = w * 0.5;
  const vpy = y - h * 0.05;
  const rows = 9;
  return (
    <g style={{pointerEvents: 'none'}}>
      <defs>
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colour} stopOpacity={0.09 * strength} />
          <stop offset="52%" stopColor={colour} stopOpacity={0.032 * strength} />
          <stop offset="100%" stopColor={colour} stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={y} width={w} height={Math.max(0, h - y)} fill={`url(#${id}-fade)`} />
      {/* Convergence, not a grid: a floor grid is graph paper, and this is a
          plate. Lines run away from the viewer and stop at the horizon. */}
      {Array.from({length: rows}, (_, i) => {
        const f = (i - (rows - 1) / 2) / ((rows - 1) / 2);
        return (
          <line
            key={i}
            x1={vpx + f * w * 2.1}
            y1={h}
            x2={vpx + f * w * 0.03}
            y2={vpy}
            stroke={colour}
            strokeWidth={w * 0.0012}
            opacity={0.055 * strength}
          />
        );
      })}
    </g>
  );
};

/**
 * THE AIR ABOVE THE HORIZON.
 *
 * Same argument as the ground, upside down. A sky that is #000 is not a sky; it
 * is the absence of one, and it makes every drawn object look like a decal on a
 * black card. One gradient, warmest where the light is.
 */
export const Sky: React.FC<{y: number; w: number; colour: string; id?: string; strength?: number}> = ({
  y,
  w,
  colour,
  id = 'sky',
  strength = 1,
}) => (
  <g style={{pointerEvents: 'none'}}>
    <defs>
      <linearGradient id={`${id}-air`} x1="0" y1="1" x2="0.25" y2="0">
        <stop offset="0%" stopColor={colour} stopOpacity={0.075 * strength} />
        <stop offset="46%" stopColor={colour} stopOpacity={0.026 * strength} />
        <stop offset="100%" stopColor={colour} stopOpacity={0} />
      </linearGradient>
    </defs>
    <rect x={0} y={0} width={w} height={Math.max(0, y)} fill={`url(#${id}-air)`} />
  </g>
);

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
