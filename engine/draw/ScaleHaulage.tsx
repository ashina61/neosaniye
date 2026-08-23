/**
 * SCALE AND HAULAGE — how big it is, and how it was moved.
 *
 * Two claims that always travel together and that a photograph handles badly.
 * A picture of a megalith is a picture of a grey wall until something human
 * stands next to it; and "they rolled it on hardwood, level, with a thousand
 * men on the ropes" is a claim about a MECHANISM that no surviving photograph
 * or object can show, because the timber and the rope rotted two thousand
 * years ago.
 *
 * TWO RULES SHAPE THIS FILE.
 *
 * 1. SCALE NEEDS A HUMAN. The figure is not decoration; it is the unit. Drawn
 *    at a stated height so the block's size is derived from it rather than
 *    asserted — which is also why the figure is a plain silhouette: a detailed
 *    person invites you to look at the person.
 *
 * 2. AN UNCERTAIN MECHANISM SAYS SO. Nobody knows exactly how the Baalbek
 *    trilithon was moved. Drawing rollers and capstans and captioning it
 *    SCHEMATIC RECONSTRUCTION would present one hypothesis as the record. The
 *    plate here defaults to ILLUSTRATIVE RECONSTRUCTION, which is a different
 *    and weaker claim, and the caller is expected to leave it that way unless
 *    the method is actually documented.
 */
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {countTo, drawOn, posterizeTime} from '../motion';
import {Arrow, Callout, Disclosure, MONO, SANS, Sheet, Ticks, weights} from './sheet';

const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export type ScaleHaulageSpec = Sheet & {
  type: 'scaleHaulage';
  /** The thing being moved. Width and height as fractions of the frame. */
  object: {w: number; h: number; label?: string; mass?: string};
  /** How tall a person is, as a fraction of the frame height. THE unit. */
  humanHeight?: number;
  /** How many figures to draw, spread along the load. */
  humans?: number;
  /** The gear under it. Each is a claim and each is drawn as one. */
  rollers?: number;
  sledge?: boolean;
  /** Degrees of incline. A ramp is a different claim from a level haul. */
  ramp?: number;
  /** Ropes going forward off the frame, with the pull they represent. */
  ropes?: number;
  /** Force arrows: where the effort is applied and which way. */
  forces?: {x: number; y: number; angle: number; label?: string}[];
  /** How far it travels across the frame while we watch, 0..1. */
  travel?: number;
  /** A figure to count up beside the load — tons, men, days. */
  figure?: {value: number; unit?: string; label?: string; at?: number; over?: number};
  /** A distance bar under the ground line. */
  distance?: {label: string};
  annotations?: {x: number; y: number; text: string; side?: 'left' | 'right'; at?: number}[];
};

/**
 * A PERSON, AS A UNIT OF MEASUREMENT.
 *
 * Deliberately the plainest silhouette that still reads as a human at
 * thumbnail size: head, shoulders, two legs. Anything more and the eye goes to
 * the figure instead of to the thing it is there to measure.
 */
const Figure: React.FC<{x: number; y: number; height: number; colour: string; lean?: number; w: number}> = ({
  x,
  y,
  height,
  colour,
  lean = 0,
  w,
}) => {
  const head = height * 0.15;
  const line = weights(w);
  return (
    <g transform={`translate(${x} ${y}) rotate(${lean})`}>
      <circle cx={0} cy={-height + head} r={head} fill={colour} />
      <line x1={0} y1={-height + head * 2} x2={0} y2={-height * 0.42} stroke={colour} strokeWidth={line.object} />
      <line x1={0} y1={-height * 0.42} x2={-height * 0.13} y2={0} stroke={colour} strokeWidth={line.object} />
      <line x1={0} y1={-height * 0.42} x2={height * 0.13} y2={0} stroke={colour} strokeWidth={line.object} />
      <line
        x1={0}
        y1={-height * 0.72}
        x2={height * 0.26}
        y2={-height * 0.6}
        stroke={colour}
        strokeWidth={line.detail}
      />
    </g>
  );
};

export const ScaleHaulagePlate: React.FC<{spec: ScaleHaulageSpec; w: number; h: number}> = ({spec, w, h}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const from = spec.from ?? 0;
  const over = spec.over ?? 34;
  const accent = spec.accent ?? '#f2b53a';
  const muted = spec.muted ?? '#cfc6ae';
  const line = weights(w);
  if (stepped < from) return null;

  const on = drawOn(stepped, [from, from + 10]);
  const t = Math.max(0, stepped - from);

  /**
   * THE GROUND LINE IS THE SHEET.
   *
   * Present at frame zero with the block already standing on it, so the cut
   * lands on a composed figure and what happens afterwards is the MOVEMENT —
   * which is the claim. A block that assembles itself out of nothing has spent
   * the shot's opening on the wrong idea.
   */
  const ground = h * 0.62;
  const ramp = spec.ramp ?? 0;
  const rad = (ramp * Math.PI) / 180;

  const objW = spec.object.w * w;
  const objH = spec.object.h * h;
  const rollerR = Math.max(w * 0.012, objH * 0.09);
  const sledgeH = spec.sledge ? objH * 0.1 : 0;

  const travel = (spec.travel ?? 0.16) * w;
  // It moves SLOWLY and never arrives: the point of the sentence is usually
  // that this took months. A block that crosses the frame has contradicted it.
  const moved = interpolate(t, [0, over * 1.8], [0, travel], CLAMP);
  const startX = w * 0.32;
  const x = startX + moved;
  /**
   * THE BLOCK STANDS ON THE GROUND, NOT IN IT.
   *
   * `baseY` is the TOP of the object, so the support height has to be added to
   * its own height to find it. Subtracting only the support put the rectangle's
   * top a few pixels above the ground line and its whole body below — a
   * thousand-ton block buried in the road, in a drawing whose entire subject is
   * that it was never lowered into anything.
   */
  const support = (spec.rollers ?? 0) > 0 ? rollerR * 2 : 0;
  const baseY = ground - support - sledgeH - objH;

  const humanH = (spec.humanHeight ?? 0.075) * h;
  const humans = Math.max(0, spec.humans ?? 2);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0}}>
        <Ticks colour={muted} w={w} h={h} on={on} />

        <g transform={ramp ? `rotate(${-ramp} ${w * 0.1} ${ground})` : undefined}>
          {/* THE GROUND, and the ramp if there is one. */}
          <line x1={0} y1={ground} x2={w} y2={ground} stroke={muted} strokeWidth={line.detail} />
          {Array.from({length: 40}, (_, i) => (
            <line
              key={i}
              x1={(i / 40) * w}
              y1={ground}
              x2={(i / 40) * w - w * 0.014}
              y2={ground + w * 0.014}
              stroke={muted}
              strokeWidth={line.construction}
              opacity={0.45}
            />
          ))}

          {/* THE ROLLERS, turning at the speed the load is travelling. Not
              decoration: if the block moves and the rollers do not, the drawing
              has contradicted itself. */}
          {Array.from({length: Math.max(0, spec.rollers ?? 0)}, (_, i) => {
            const spacing = objW / Math.max(1, (spec.rollers ?? 1) - 0.001);
            const rx = x - objW / 2 + spacing * (i + 0.5);
            const spin = (moved / Math.max(1, rollerR)) * 57.3;
            return (
              <g key={`r${i}`} transform={`translate(${rx} ${ground - rollerR})`}>
                <circle cx={0} cy={0} r={rollerR} fill="none" stroke={muted} strokeWidth={line.detail} />
                <line
                  x1={0}
                  y1={0}
                  x2={Math.cos((spin * Math.PI) / 180) * rollerR}
                  y2={Math.sin((spin * Math.PI) / 180) * rollerR}
                  stroke={muted}
                  strokeWidth={line.construction}
                />
              </g>
            );
          })}

          {spec.sledge ? (
            <rect
              x={x - objW / 2 - w * 0.012}
              y={baseY + objH}
              width={objW + w * 0.024}
              height={sledgeH}
              fill="none"
              stroke={muted}
              strokeWidth={line.detail}
            />
          ) : null}

          {/* THE OBJECT. Solid outline, accent, the only filled thing here. */}
          <rect x={x - objW / 2} y={baseY} width={objW} height={objH} fill={`${accent}18`} stroke={accent} strokeWidth={line.emphasis} />
          {/* Two courses of jointing, so it reads as cut stone rather than as a
              rectangle. */}
          {[0.34, 0.68].map((f) => (
            <line
              key={f}
              x1={x - objW / 2}
              y1={baseY + objH * f}
              x2={x + objW / 2}
              y2={baseY + objH * f}
              stroke={accent}
              strokeWidth={line.construction}
              opacity={0.45}
            />
          ))}

          {/* THE ROPES, leaving the frame forward. The load is being pulled from
              somewhere off-picture, which is also true. */}
          {Array.from({length: Math.max(0, spec.ropes ?? 0)}, (_, i) => {
            const ry = baseY + objH * (0.25 + i * 0.22);
            const sag = Math.sin(t / 6 + i) * w * 0.004;
            return (
              <path
                key={`rope${i}`}
                d={`M ${x - objW / 2} ${ry} Q ${x - objW / 2 - w * 0.14} ${ry + sag + w * 0.01} ${0} ${ry - w * 0.01}`}
                fill="none"
                stroke={muted}
                strokeWidth={line.detail}
                opacity={0.8}
              />
            );
          })}

          {/* THE PEOPLE. The unit, standing on the ground line. */}
          {Array.from({length: humans}, (_, i) => (
            <Figure
              key={`f${i}`}
              // Clear of the standing scale reference at 0.135w, which is a
              // different figure doing a different job.
              x={x - objW / 2 - w * (0.04 + i * 0.05)}
              y={ground}
              height={humanH}
              colour={muted}
              lean={-14}
              w={w}
            />
          ))}

          {/* FORCE. Where the effort goes in and which way it points. */}
          {(spec.forces ?? []).map((force, i) => {
            const fx = x + force.x * objW;
            const fy = baseY + force.y * objH;
            const len = w * 0.07;
            const a = (force.angle * Math.PI) / 180;
            return (
              <g key={`fo${i}`}>
                <Arrow
                  x1={fx}
                  y1={fy}
                  x2={fx + Math.cos(a) * len}
                  y2={fy + Math.sin(a) * len}
                  colour={accent}
                  w={w}
                  at={from + 8 + i * 5}
                  over={10}
                  weight={line.object}
                />
                {force.label ? (
                  <text
                    x={fx + Math.cos(a) * len * 1.1}
                    y={fy + Math.sin(a) * len * 1.1 - w * 0.012}
                    fill={accent}
                    fontFamily={MONO}
                    fontSize={w * 0.02}
                    letterSpacing="0.14em"
                    textAnchor="middle"
                  >
                    {force.label.toUpperCase()}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>

        {/* THE HUMAN SCALE BAR, beside the block: the height of a person,
            marked, so the size is derived rather than asserted. */}
        <g opacity={0.75 * on}>
          <line x1={w * 0.09} y1={ground} x2={w * 0.09} y2={ground - humanH} stroke={muted} strokeWidth={line.detail} />
          {[ground, ground - humanH].map((y, i) => (
            <line key={i} x1={w * 0.075} y1={y} x2={w * 0.105} y2={y} stroke={muted} strokeWidth={line.detail} />
          ))}
          <Figure x={w * 0.135} y={ground} height={humanH} colour={muted} w={w} />
        </g>

        {spec.distance ? (
          <g opacity={drawOn(stepped, [from + over * 0.5, from + over])}>
            <line x1={w * 0.12} y1={ground + h * 0.06} x2={w * 0.88} y2={ground + h * 0.06} stroke={muted} strokeWidth={line.construction} />
            {[w * 0.12, w * 0.88].map((cx, i) => (
              <line key={i} x1={cx} y1={ground + h * 0.05} x2={cx} y2={ground + h * 0.07} stroke={muted} strokeWidth={line.detail} />
            ))}
            <text
              x={w * 0.5}
              y={ground + h * 0.052}
              textAnchor="middle"
              fill={muted}
              fontFamily={MONO}
              fontSize={w * 0.022}
              letterSpacing="0.2em"
            >
              {spec.distance.label.toUpperCase()}
            </text>
          </g>
        ) : null}

        {(spec.annotations ?? []).map((note, i) => (
          <Callout
            key={`a${i}`}
            x={note.x * w}
            y={note.y * h}
            text={note.text}
            colour={muted}
            w={w}
            side={note.side ?? 'right'}
            at={from + (note.at ?? 16 + i * 7)}
          />
        ))}
      </svg>

      {spec.figure ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: h * 0.16,
            textAlign: 'center',
            fontFamily: SANS,
            fontWeight: 900,
            fontVariantNumeric: 'tabular-nums',
            color: accent,
            textShadow: '0 0 30px rgba(0,0,0,0.9)',
          }}
        >
          <div style={{fontSize: w * 0.13, lineHeight: 1}}>
            {countTo(
              stepped,
              [from + (spec.figure.at ?? 6), from + (spec.figure.at ?? 6) + (spec.figure.over ?? 26)],
              spec.figure.value,
            ).toLocaleString('en-US')}
            {spec.figure.unit ? (
              <span style={{fontFamily: MONO, fontSize: w * 0.028, letterSpacing: '0.2em', marginLeft: w * 0.016}}>
                {spec.figure.unit.toUpperCase()}
              </span>
            ) : null}
          </div>
          {spec.figure.label ? (
            <div style={{fontFamily: MONO, fontSize: w * 0.022, letterSpacing: '0.3em', opacity: 0.8, color: muted}}>
              {spec.figure.label.toUpperCase()}
            </div>
          ) : null}
        </div>
      ) : null}

      {/**
       * THE PLATE IS WEAKER THAN A SCHEMATIC ON PURPOSE.
       *
       * "Schematic reconstruction" claims the arrangement is known. For most
       * ancient haulage it is not: the rollers and the capstans are the best
       * available hypothesis, not the record. "Illustrative" says that.
       */}
      <Disclosure text={spec.disclosure ?? 'illustrative reconstruction · method uncertain'} colour={muted} at={from + 12} width={w} />
    </AbsoluteFill>
  );
};
