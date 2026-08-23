/**
 * THE DRAWING SHEET — what every procedural visual sits on.
 *
 * Five kinds of explanatory drawing were added to this engine at once, and the
 * fastest way to make five drawings look like five different programs is to let
 * each one invent its own line weights, its own labels and its own way of
 * saying "this is a reconstruction". So the furniture lives here and they all
 * import it: the same two typefaces, the same registration ticks in the
 * corners, the same disclosure plate in the same place, the same rule for how
 * thick a line is at this frame size.
 *
 * It is the difference between a set of diagrams and a drawing OFFICE.
 */
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {drawOn, posterizeTime} from '../motion';

export const MONO = '"Courier New", ui-monospace, monospace';
export const SANS = '"Archivo", "Helvetica Neue", Arial, sans-serif';
export const SERIF = '"Playfair Display", "Iowan Old Style", Georgia, serif';

/** Every drawn visual shares these. Fractions and scene-relative frames. */
export type Sheet = {
  /** Scene frame it begins drawing on. */
  from?: number;
  /** Frames the draw-on takes. */
  over?: number;
  accent?: string;
  muted?: string;
  /**
   * The honesty plate. Present on anything reconstructed rather than measured.
   * Absent only where the drawing is a pure abstraction nobody could mistake
   * for a record — a timeline of dates, a measurement bar.
   */
  disclosure?: string;
  /**
   * WHAT THIS DRAWING CLAIMS TO BE OF, and what it claims about it.
   *
   * Carried on the spec rather than inferred, because the check that a drawing
   * depicts its subject cannot be made by looking at the drawing. A gear train
   * was once emitted as a schematic reconstruction of a human heart: every
   * coordinate in it was correct, the wheels meshed, the disclosure plate was
   * present, and it was a lie. The only thing that could have caught it is the
   * spec saying "subject: humanHeart" beside "type: gearSystem" and something
   * refusing the pair.
   *
   * The engine does not read these. They exist for the validator.
   */
  subject?: string;
  claims?: string[];
};

/**
 * LINE WEIGHTS, DERIVED FROM THE FRAME.
 *
 * Four weights and no more, in the ratio a draughtsman uses: construction,
 * detail, object, emphasis. Hard-coding pixels here would be the same mistake
 * as hard-coding a file name — the frame is 1080 wide today.
 */
export function weights(w: number) {
  return {
    construction: w * 0.0015,
    detail: w * 0.0024,
    object: w * 0.0042,
    emphasis: w * 0.0062,
  };
}

/**
 * THE PLATE THAT SAYS WHAT THIS IS.
 *
 * A reconstruction must announce itself. It sits in the corner in mono at a
 * size that is legible and not loud, the way a museum diagram is captioned —
 * because the alternative is a drawing that a viewer reads as a photograph of
 * a thing, which is the failure this whole library exists to avoid.
 */
export const Disclosure: React.FC<{text: string; colour: string; at: number; width: number}> = ({
  text,
  colour,
  at,
  width,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const on = drawOn(stepped, [at, at + 10]);
  if (stepped < at) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: width * 0.075,
        bottom: width * 0.075,
        fontFamily: MONO,
        fontSize: width * 0.0185,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: colour,
        opacity: on * 0.72,
        borderLeft: `2px solid ${colour}`,
        paddingLeft: width * 0.018,
        lineHeight: 1.5,
        /**
         * ONE LINE. A DISCLOSURE THAT WRAPS READS AS A CAPTION.
         *
         * "SCHEMATIC RECONSTRUCTION · NOT TO / SCALE" broke after "TO", so the
         * plate that exists to say the drawing is not a record turned into two
         * lines of mono text with an orphan — which is exactly the shape of a
         * subtitle, and the last thing this label should be mistaken for.
         */
        whiteSpace: 'nowrap',
        maxWidth: width * 0.85,
      }}
    >
      {text}
    </div>
  );
};

/** Registration ticks — the corner marks of a drawing sheet. */
export const Ticks: React.FC<{colour: string; w: number; h: number; on: number}> = ({colour, w, h, on}) => {
  const m = w * 0.055;
  const len = w * 0.035;
  const corners = [
    [m, m, 1, 1],
    [w - m, m, -1, 1],
    [m, h - m, 1, -1],
    [w - m, h - m, -1, -1],
  ];
  return (
    <g opacity={on * 0.45}>
      {corners.map(([x, y, sx, sy], i) => (
        <g key={i}>
          <line x1={x} y1={y} x2={x + len * sx} y2={y} stroke={colour} strokeWidth={w * 0.0022} />
          <line x1={x} y1={y} x2={x} y2={y + len * sy} stroke={colour} strokeWidth={w * 0.0022} />
        </g>
      ))}
    </g>
  );
};

/**
 * A CALLOUT — mono label on a leader line, the way a part is named on a plate.
 *
 * Labels are the difference between a drawing that explains and a drawing that
 * decorates, and they are also the fastest way to make a mess. One rule: the
 * leader points AT the thing and the text sits clear of it, on whichever side
 * has room.
 */
export const Callout: React.FC<{
  x: number;
  y: number;
  text: string;
  colour: string;
  w: number;
  side?: 'left' | 'right';
  at: number;
  lead?: number;
  size?: number;
}> = ({x, y, text, colour, w, side = 'right', at, lead = 0.06, size}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const on = drawOn(stepped, [at, at + 9]);
  if (stepped < at) return null;
  const dir = side === 'right' ? 1 : -1;
  const end = x + dir * w * lead;
  const type = size ?? w * 0.021;
  return (
    <g opacity={on}>
      <circle cx={x} cy={y} r={w * 0.005} fill={colour} />
      <line x1={x} y1={y} x2={end} y2={y} stroke={colour} strokeWidth={w * 0.0018} />
      <text
        x={end + dir * w * 0.012}
        y={y + type * 0.34}
        textAnchor={side === 'right' ? 'start' : 'end'}
        fill={colour}
        fontFamily={MONO}
        fontSize={type}
        letterSpacing="0.14em"
      >
        {text.toUpperCase()}
      </text>
    </g>
  );
};

/**
 * AN ARROW THAT MEANS SOMETHING HAPPENED.
 *
 * Used for flow, for force and for "this becomes that". It draws itself along
 * its own length rather than fading in, because a fading arrow is a graphic and
 * a drawn one is an action.
 */
export const Arrow: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  colour: string;
  w: number;
  at: number;
  over?: number;
  weight?: number;
  head?: number;
  dashed?: boolean;
}> = ({x1, y1, x2, y2, colour, w, at, over = 12, weight, head = 1, dashed = false}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const on = drawOn(stepped, [at, at + over]);
  if (on <= 0) return null;
  const stroke = weight ?? weights(w).detail;
  const hx = x1 + (x2 - x1) * on;
  const hy = y1 + (y2 - y1) * on;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = w * 0.016 * head;
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={hx}
        y2={hy}
        stroke={colour}
        strokeWidth={stroke}
        strokeDasharray={dashed ? `${w * 0.012} ${w * 0.01}` : undefined}
      />
      {on > 0.35 ? (
        <path
          d={`M ${hx} ${hy} L ${hx - Math.cos(angle - 0.42) * size} ${hy - Math.sin(angle - 0.42) * size} ` +
             `L ${hx - Math.cos(angle + 0.42) * size} ${hy - Math.sin(angle + 0.42) * size} Z`}
          fill={colour}
        />
      ) : null}
    </g>
  );
};
