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

/**
 * THE CAMERA MOVES THE WORLD. THE SHEET DOES NOT MOVE.
 *
 * A shot's camera used to reach the drawings as a scale and nothing else, so
 * fourteen consecutive haulage shots came out framed identically. Handing the
 * whole camera to the plate fixed that and broke something worse: the push
 * carried the registration ticks, the disclosure and the tonnage readout with
 * it, and a shot at 1.29 delivered "800 TONS" sliced off the top of the frame
 * and "…USTRATIVE RECONSTRUCTION" running off the left.
 *
 * Both are the same mistake, made in opposite directions. A drawing has two
 * layers that are not the same kind of thing: the WORLD it depicts, which the
 * camera is looking at, and the SHEET it is drawn on, which the camera is
 * looking THROUGH. Pan across a museum plate and the object shifts; the label
 * screwed to the wall beside it does not.
 *
 * So the camera is an SVG transform on the world group only. Everything the
 * draughtsman added — corner ticks, the honesty plate, a counted figure —
 * stays pinned where it was composed, for the same reason a motif is pinned.
 */
export type Cam = {push?: number; ox?: number; oy?: number; dx?: number; dy?: number; rotate?: number};

/** The world transform for a plate, or undefined when the camera is still. */
export function worldTransform(cam: Cam | undefined, w: number, h: number): string | undefined {
  if (!cam) return undefined;
  const push = cam.push ?? 1;
  const rotate = cam.rotate ?? 0;
  const dx = cam.dx ?? 0;
  const dy = cam.dy ?? 0;
  // A transform that resolves to the identity is still a compositing layer.
  if (Math.abs(push - 1) < 0.001 && Math.abs(rotate) < 0.01 && Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return undefined;
  const ox = w * (cam.ox ?? 0.5);
  const oy = h * (cam.oy ?? 0.55);
  return [
    `translate(${(ox + dx).toFixed(2)} ${(oy + dy).toFixed(2)})`,
    `scale(${push.toFixed(4)})`,
    `rotate(${rotate.toFixed(3)})`,
    `translate(${(-ox).toFixed(2)} ${(-oy).toFixed(2)})`,
  ].join(' ');
}

/**
 * WHEN THE SHEET ITSELF IS THERE.
 *
 * Law 30 says the frame a cut lands on cannot be empty, and it says how: a
 * draughtsman sets up the construction first and draws the mechanism onto it.
 * The registration ticks, the honesty plate and the place names are the SHEET.
 * They are not the argument, so they do not get to arrive — a bracket fading
 * up over a second and a half is a title sequence.
 *
 * Every plate was ramping them across its whole draw-on window, which cost the
 * reel twice. A first shot cut to a bare grey polygon and only became a map a
 * third of the way in. And a CONTINUATION — handed `from: -1, over: 1` for the
 * express purpose of opening already finished — rebuilt its brackets anyway,
 * because the ramp was a hard-coded ten frames that knew nothing about `over`.
 *
 * The first attempt at this made the ramp SHORT instead of removing it, which
 * is the same bug with a smaller number in it: a ramp that starts at `from` is
 * still zero on the frame `from`, so the cut still landed on nothing and the
 * contact sheet was unchanged. Construction is not animated. It is there, and
 * the drawing is made on top of it.
 */
export function setUp(stepped: number, from: number): number {
  return stepped >= from ? 1 : 0;
}

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
 *
 * A label is one of two things and it has to say which. NAMING a part of the
 * construction — SURFACE, PUMICE, VESUVIUS — is `set`: the part is already
 * drawn and the word belongs to it, so it is there when the cut lands. Calling
 * out a CHANGE — "crack opens", "water enters" — is an arrival, and it ramps.
 * With everything ramping, a section cut to three unlabelled grey bands and a
 * map to a bare polygon, which is what law 30 is about.
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
  set?: boolean;
}> = ({x, y, text, colour, w, side = 'right', at, lead = 0.06, size, set = false}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const on = set ? setUp(stepped, at) : drawOn(stepped, [at, at + 9]);
  if (stepped < at) return null;
  const type = size ?? w * 0.021;
  /**
   * THE LEADER POINTS AT THE THING; THE LABEL GOES WHERE THERE IS ROOM.
   *
   * A magnified section had its strata labelled from the left, and the section
   * spans most of the frame's width, so the words ran off the edge and the shot
   * delivered "…ACE" and "…ATE" where it meant SURFACE and AGGREGATE. The plate
   * that asked for `side: 'left'` was not wrong about which side of the
   * geometry the label belonged on; it had no way to know how wide the word
   * was, and neither does anything else upstream.
   *
   * So the side is a preference and the frame decides. A draughtsman does the
   * same thing: the leader is the statement, the label sits wherever it fits.
   */
  const margin = w * 0.06;
  const runOf = (d: 1 | -1) => x + d * (w * lead + w * 0.012 + text.length * type * 0.62);
  let dir: 1 | -1 = side === 'right' ? 1 : -1;
  const fits = (d: 1 | -1) => runOf(d) >= margin && runOf(d) <= w - margin;
  if (!fits(dir) && fits(dir === 1 ? -1 : 1)) dir = dir === 1 ? -1 : 1;
  const end = x + dir * w * lead;
  /**
   * And where NEITHER side has room — a long word beside a wide box — the label
   * is pulled back inside rather than left hanging over the edge. A leader that
   * has been shortened is still a leader; a word with three letters missing is
   * not a label.
   */
  const run = runOf(dir);
  const overshoot = run < margin ? margin - run : run > w - margin ? w - margin - run : 0;
  const textX = end + dir * w * 0.012 + overshoot;
  return (
    <g opacity={on}>
      <circle cx={x} cy={y} r={w * 0.005} fill={colour} />
      <line x1={x} y1={y} x2={end} y2={y} stroke={colour} strokeWidth={w * 0.0018} />
      <text
        x={textX}
        y={y + type * 0.34}
        textAnchor={dir === 1 ? 'start' : 'end'}
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
