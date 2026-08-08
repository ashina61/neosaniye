import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {drawOn, hash01, posterizeTime} from '../motion';

/**
 * MARKS ON THE FRAME — an underline, a circled word, a bracket, an arrow.
 *
 * The documentary device: it should look like somebody took a pencil to the
 * evidence, not like a graphic faded up. Two things do all the work:
 *
 *   IT DRAWS ITSELF   the stroke is revealed along its own length rather than
 *                     faded in. A fade reads as an overlay; a draw-on reads as
 *                     a hand.
 *   IT IS NOT STRAIGHT the path is perturbed by a deterministic hash, and the
 *                     whole mark wobbles on a coarse step. A geometrically
 *                     perfect underline is the tell that a computer drew it.
 */
export type MarkKind = 'underline' | 'oval' | 'bracket' | 'strike' | 'arrow' | 'box';

/** A wobbly line from a to b, as an SVG path with a little sag in the middle. */
function wobblyLine(seed: string, x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const sag = (hash01(seed, 3) - 0.35) * 16;
  const lean = (hash01(seed, 7) - 0.5) * 10;
  return `M ${x1} ${y1 + lean * 0.4} Q ${midX} ${midY + sag} ${x2} ${y2 - lean * 0.4}`;
}

/** A hand-drawn ellipse: not closed, and overshooting where the hand came back. */
function scribbledOval(seed: string, w: number, h: number): string {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2 - 6;
  const ry = h / 2 - 6;
  const j = (salt: number) => (hash01(seed, salt) - 0.5) * 14;
  return (
    `M ${cx + rx + j(1)} ${cy + j(2)} ` +
    `C ${cx + rx + j(3)} ${cy - ry * 0.9} ${cx + rx * 0.7} ${cy - ry + j(4)} ${cx + j(5)} ${cy - ry + j(6)} ` +
    `C ${cx - rx * 0.75} ${cy - ry + j(7)} ${cx - rx + j(8)} ${cy - ry * 0.85} ${cx - rx + j(9)} ${cy + j(10)} ` +
    `C ${cx - rx + j(11)} ${cy + ry * 0.88} ${cx - rx * 0.7} ${cy + ry + j(12)} ${cx + j(13)} ${cy + ry + j(14)} ` +
    `C ${cx + rx * 0.8} ${cy + ry + j(15)} ${cx + rx + j(16)} ${cy + ry * 0.8} ${cx + rx * 0.96 + j(17)} ${cy - ry * 0.24}`
  );
}

export const Annotation: React.FC<{
  kind?: MarkKind;
  /** Box the mark applies to, in scene pixels. */
  x: number;
  y: number;
  width: number;
  height?: number;
  colour?: string;
  thickness?: number;
  /** Scene frames over which the mark draws itself on. */
  from?: number;
  over?: number;
  seed?: string;
  opacity?: number;
}> = ({
  kind = 'underline',
  x,
  y,
  width,
  height = 90,
  colour = '#ffcf3d',
  thickness = 9,
  from = 0,
  over = 12,
  seed = 'mark',
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  if (stepped < from) return null;

  const progress = drawOn(stepped, [from, from + over]);
  // The mark keeps breathing after it lands, on a coarse step, so it never
  // settles into something obviously vector.
  const wobble = Math.sin(posterizeTime(frame, fps, 8) / 7) * 0.6;

  const pad = thickness * 2;
  const w = width + pad * 2;
  const h = height + pad * 2;

  let path: string;
  switch (kind) {
    case 'oval':
      path = scribbledOval(seed, w, h);
      break;
    case 'strike':
      path = wobblyLine(seed, pad, h / 2, w - pad, h / 2);
      break;
    case 'bracket':
      path = `M ${pad + 14} ${pad} L ${pad} ${pad} L ${pad} ${h - pad} L ${pad + 14} ${h - pad}`;
      break;
    case 'arrow':
      path =
        `${wobblyLine(seed, pad, h - pad, w - pad - 18, pad + 12)} ` +
        `M ${w - pad - 18} ${pad + 12} l 20 -4 M ${w - pad - 18} ${pad + 12} l -2 20`;
      break;
    case 'box':
      path = `M ${pad} ${pad} L ${w - pad} ${pad + 3} L ${w - pad - 2} ${h - pad} L ${pad + 2} ${h - pad - 3} Z`;
      break;
    default:
      path = wobblyLine(seed, pad, h - pad, w - pad, h - pad);
  }

  // One long dash the length of the whole path, walked back to zero: the
  // stroke uncovers itself instead of appearing.
  const LENGTH = 4000;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{
          position: 'absolute',
          left: x - pad,
          top: y - pad,
          overflow: 'visible',
          transform: `rotate(${wobble}deg)`,
          opacity,
        }}
      >
        <path
          d={path}
          fill="none"
          stroke={colour}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={LENGTH}
          strokeDashoffset={LENGTH * (1 - progress)}
          style={{filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.55))'}}
        />
      </svg>
    </AbsoluteFill>
  );
};

/**
 * A WIREFRAME — the dashed geometric frame a prop sits inside.
 *
 * Straight out of the reference reel: the props arrive inside hand-drawn
 * diamonds whose dashed stroke draws on and shivers. It costs nothing and it is
 * most of why the frame reads as designed rather than as a photo with a caption.
 */
export const WireFrame: React.FC<{
  x: number;
  y: number;
  size: number;
  shape?: 'diamond' | 'rect' | 'circle';
  colour?: string;
  thickness?: number;
  from?: number;
  over?: number;
  dash?: number;
}> = ({x, y, size, shape = 'diamond', colour = '#f6ead0', thickness = 5, from = 0, over = 14, dash = 18}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  if (stepped < from) return null;

  const progress = drawOn(stepped, [from, from + over]);
  const shiver = Math.sin(posterizeTime(frame, fps, 8) / 5) * 0.8;
  const half = size / 2;

  const path =
    shape === 'diamond'
      ? `M ${half} 4 L ${size - 4} ${half} L ${half} ${size - 4} L 4 ${half} Z`
      : shape === 'circle'
        ? `M ${half} 4 A ${half - 4} ${half - 4} 0 1 1 ${half - 0.01} 4`
        : `M 4 4 L ${size - 4} 4 L ${size - 4} ${size - 4} L 4 ${size - 4} Z`;

  const LENGTH = size * 5;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{position: 'absolute', left: x - half, top: y - half, transform: `rotate(${shiver}deg)`}}
      >
        <path
          d={path}
          fill="none"
          stroke={colour}
          strokeWidth={thickness}
          strokeDasharray={`${dash} ${dash * 0.8}`}
          strokeDashoffset={LENGTH * (1 - progress)}
          strokeLinecap="round"
          opacity={0.92}
        />
        {/* A SECOND PASS, OFFSET. Nobody draws a shape round something once and
            gets it right: the line doubles back, thicker in places, slightly
            out of register. One stroke is a vector; two is a hand. It draws a
            beat behind the first so you see it happen. */}
        <path
          d={path}
          fill="none"
          stroke={colour}
          strokeWidth={thickness * 0.6}
          strokeDasharray={`${dash * 1.7} ${dash * 0.6}`}
          strokeDashoffset={LENGTH * (1 - drawOn(stepped, [from + 3, from + over + 5]))}
          strokeLinecap="round"
          opacity={0.5}
          transform={`translate(${1.5 + shiver * 0.6} ${-1.5 - shiver * 0.4})`}
        />
      </svg>
    </AbsoluteFill>
  );
};
