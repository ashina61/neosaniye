/**
 * A PROCESS — one object, changing, with each change caused by the last.
 *
 * The benchmark's biggest single finding: three of five episodes were process
 * stories (a crack sealing itself, a cardiac cycle, a forging sequence) and the
 * engine had no way to draw a process at all. All three fell to typography.
 *
 * THE RULE THAT MAKES THIS A PROCESS AND NOT A ROW OF CARDS:
 *
 *   THE SAME OBJECT PERSISTS.
 *
 * Four cards showing iron, then hot iron, then a billet, then a blade is four
 * illustrations. One shape that stretches, reddens, folds and sharpens is a
 * process, and the difference is the whole point — the viewer has to feel "this
 * is the thing I was just looking at" or nothing has been explained.
 *
 * So the object is a single outline, held at the centre of the frame, whose
 * GEOMETRY is interpolated between stages. It never cuts, never fades, never
 * gets replaced. What moves around it is the apparatus: the stage marks below,
 * the agent arriving above (heat, a hammer, water), and the causal arrow that
 * says this happened BECAUSE of that.
 *
 * Stages are data. The caller says what the thing becomes; the tweening,
 * timing and layout are this file's business.
 */
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {drawOn, posterizeTime, punch} from '../motion';
import {Arrow, Disclosure, MONO, SANS, Sheet, Ticks, weights} from './sheet';

const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/**
 * ONE STAGE OF THE OBJECT.
 *
 * The shape is a normalised outline in a unit box: x and y both 0..1, which the
 * component scales into the frame. Every stage must have the SAME NUMBER OF
 * POINTS, because that is what lets one stage tween into the next. A stage with
 * a different count would have to cut, and cutting is the thing this exists to
 * avoid — so a mismatched stage is resampled rather than swapped.
 */
export type ProcessStage = {
  /** What the object looks like now. Unit coordinates. */
  shape: [number, number][];
  label: string;
  /** What is being done to it — the CAUSE. Drawn as an agent above. */
  agent?: 'heat' | 'strike' | 'fold' | 'quench' | 'water' | 'pressure' | 'grind' | 'none';
  /** What that did — the EFFECT, in three or four words. */
  effect?: string;
  /** How hot the object is, 0 cold to 1 white. Drives its colour. */
  heat?: number;
  /** Frames this stage holds before the next begins. Derived when absent. */
  hold?: number;
};

export type ProcessSpec = Sheet & {
  type: 'process';
  stages: ProcessStage[];
  /** What the object is, named once under the drawing. */
  objectLabel?: string;
  /** Stage index the shot is about; it is the one that gets the emphasis. */
  highlight?: number;
};

/** Resample an outline to n points so any two stages can be tweened. */
function resample(shape: [number, number][], n: number): [number, number][] {
  if (!shape.length) return Array.from({length: n}, () => [0.5, 0.5] as [number, number]);
  if (shape.length === n) return shape;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i += 1) {
    const t = (i / n) * shape.length;
    const a = shape[Math.floor(t) % shape.length];
    const b = shape[(Math.floor(t) + 1) % shape.length];
    const f = t - Math.floor(t);
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}

/** Colour of iron at a given heat. Not decoration — it is the state readout. */
function glowColour(heat: number, accent: string, muted: string) {
  if (heat <= 0.02) return muted;
  if (heat < 0.4) return '#8a3a20';
  if (heat < 0.7) return '#c8551f';
  if (heat < 0.9) return accent;
  return '#fff0c4';
}

/**
 * THE AGENT — the thing doing it, drawn above the object.
 *
 * Deliberately schematic and deliberately the same size every time: the agent
 * is a verb, and a verb that changes weight between stages reads as a different
 * verb. It arrives, acts, and leaves; the object keeps what it did.
 */
const Agent: React.FC<{
  kind: NonNullable<ProcessStage['agent']>;
  x: number;
  y: number;
  w: number;
  colour: string;
  p: number;
}> = ({kind, x, y, w, colour, p}) => {
  const line = weights(w);
  // One approach curve for every agent, so they read as one hand.
  const drop = interpolate(p, [0, 0.45, 0.7, 1], [-w * 0.12, 0, 0, -w * 0.06], CLAMP);
  const bite = interpolate(p, [0.4, 0.55, 0.75], [0, 1, 0], CLAMP);

  if (kind === 'heat') {
    return (
      <g opacity={Math.min(1, p * 2.2)}>
        {[0, 1, 2, 3, 4].map((i) => {
          const fx = x + (i - 2) * w * 0.045;
          const wobble = Math.sin(p * 9 + i) * w * 0.008;
          return (
            <path
              key={i}
              d={`M ${fx} ${y + w * 0.09} q ${w * 0.02 + wobble} ${-w * 0.05} 0 ${-w * 0.1} q ${-w * 0.018} ${-w * 0.04} ${wobble * 0.4} ${-w * 0.06}`}
              fill="none"
              stroke={colour}
              strokeWidth={line.detail}
              opacity={0.55 + bite * 0.45}
            />
          );
        })}
      </g>
    );
  }
  if (kind === 'strike' || kind === 'fold') {
    return (
      <g transform={`translate(${x} ${y + drop})`} opacity={Math.min(1, p * 2.4)}>
        <rect x={-w * 0.05} y={-w * 0.03} width={w * 0.1} height={w * 0.06} fill="none" stroke={colour} strokeWidth={line.object} />
        <line x1={0} y1={-w * 0.03} x2={0} y2={-w * 0.13} stroke={colour} strokeWidth={line.object} />
        {bite > 0.3
          ? [0, 1, 2, 3, 4, 5].map((i) => {
              const a = -Math.PI * 0.15 - (i / 5) * Math.PI * 0.7;
              return (
                <line
                  key={i}
                  x1={Math.cos(a) * w * 0.05}
                  y1={w * 0.03 + Math.sin(a) * w * 0.01}
                  x2={Math.cos(a) * w * 0.05 * (1 + bite * 1.6)}
                  y2={w * 0.03 + Math.sin(a) * w * 0.05 * (1 + bite)}
                  stroke={colour}
                  strokeWidth={line.construction}
                  opacity={bite}
                />
              );
            })
          : null}
      </g>
    );
  }
  if (kind === 'quench' || kind === 'water') {
    return (
      <g opacity={Math.min(1, p * 2)}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const fx = x + (i - 3) * w * 0.03;
          const fall = interpolate(p, [0, 1], [0, w * 0.16], CLAMP) + (i % 3) * w * 0.02;
          return <line key={i} x1={fx} y1={y + fall} x2={fx} y2={y + fall + w * 0.03} stroke={colour} strokeWidth={line.construction} opacity={0.7} />;
        })}
        {bite > 0.2
          ? [0, 1, 2, 3, 4].map((i) => (
              <circle
                key={`s${i}`}
                cx={x + (i - 2) * w * 0.05}
                cy={y + w * 0.2 - bite * w * 0.09}
                r={w * 0.014 * (0.6 + bite)}
                fill="none"
                stroke={colour}
                strokeWidth={line.construction}
                opacity={0.5 * bite}
              />
            ))
          : null}
      </g>
    );
  }
  if (kind === 'pressure') {
    return (
      <g opacity={Math.min(1, p * 2)}>
        {[-1, 0, 1].map((i) => (
          <Arrow
            key={i}
            x1={x + i * w * 0.08}
            y1={y - w * 0.02}
            x2={x + i * w * 0.08}
            y2={y + w * 0.06}
            colour={colour}
            w={w}
            at={-999}
            over={1}
          />
        ))}
      </g>
    );
  }
  if (kind === 'grind') {
    return (
      <g opacity={Math.min(1, p * 2)} transform={`translate(${x + Math.sin(p * 14) * w * 0.05} ${y})`}>
        <circle cx={0} cy={0} r={w * 0.055} fill="none" stroke={colour} strokeWidth={line.object} />
        <circle cx={0} cy={0} r={w * 0.012} fill={colour} />
      </g>
    );
  }
  return null;
};

export const ProcessPlate: React.FC<{spec: ProcessSpec; w: number; h: number}> = ({spec, w, h}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const from = spec.from ?? 0;
  const over = spec.over ?? 40;
  const accent = spec.accent ?? '#f2b53a';
  const muted = spec.muted ?? '#cfc6ae';
  const line = weights(w);
  if (stepped < from) return null;

  const stages = spec.stages ?? [];
  if (stages.length < 2) return null;

  /**
   * TIME IS DIVIDED BY STAGE, and each stage is half transformation and half
   * hold. The hold is not padding: it is the only moment the viewer can read
   * what the object has become before it starts becoming the next thing.
   */
  const each = over / (stages.length - 1);
  const t = Math.max(0, stepped - from);
  const raw = Math.min(stages.length - 1, t / Math.max(1, each));
  const index = Math.min(stages.length - 2, Math.floor(raw));
  const within = Math.min(1, raw - index);
  // Transform over the first 62% of the slice, then hold. Eased so the change
  // itself has a shape rather than sliding linearly.
  const p = interpolate(within, [0, 0.62], [0, 1], CLAMP);
  const eased = p * p * (3 - 2 * p);

  const points = Math.max(...stages.map((s) => s.shape.length), 8);
  const a = resample(stages[index].shape, points);
  const b = resample(stages[index + 1].shape, points);
  const settled = raw >= stages.length - 1;
  const shown = settled ? stages[stages.length - 1] : stages[index];
  const nextStage = stages[Math.min(stages.length - 1, index + 1)];

  // THE OBJECT'S BOX. Fixed, so the thing does not wander while it changes —
  // a shape that drifts across the frame as it transforms reads as two shapes.
  const box = {x: w * 0.2, y: h * 0.3, w: w * 0.6, h: h * 0.24};
  const shape = a.map(([ax, ay], i) => {
    const [bx, by] = b[i];
    return [box.x + (ax + (bx - ax) * eased) * box.w, box.y + (ay + (by - ay) * eased) * box.h];
  });
  const d = shape.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ') + ' Z';

  const heat = (stages[index].heat ?? 0) + ((nextStage.heat ?? 0) - (stages[index].heat ?? 0)) * eased;
  const colour = glowColour(heat, accent, muted);

  const on = drawOn(stepped, [from, from + 10]);
  const agent = settled ? 'none' : nextStage.agent ?? 'none';

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0}}>
        <Ticks colour={muted} w={w} h={h} on={on} />

        {/**
         * THE STAGE RULE — set out at frame zero, so the cut lands on a figure.
         *
         * It also does the job a row of cards was doing badly: it shows how many
         * steps there are and which one we are on, in one line, without ever
         * taking the object off the screen.
         */}
        <g opacity={0.55}>
          <line
            x1={w * 0.12}
            y1={h * 0.66}
            x2={w * 0.88}
            y2={h * 0.66}
            stroke={muted}
            strokeWidth={line.construction}
          />
          {stages.map((stage, i) => {
            const x = w * 0.12 + (i / (stages.length - 1)) * w * 0.76;
            const done = raw >= i - 0.02;
            return (
              <g key={i}>
                <circle
                  cx={x}
                  cy={h * 0.66}
                  r={w * (done ? 0.009 : 0.006)}
                  fill={done ? accent : 'none'}
                  stroke={done ? accent : muted}
                  strokeWidth={line.construction}
                />
              </g>
            );
          })}
          {/* The travelled part of the rule, in the accent: progress you can
              read without counting dots. */}
          <line
            x1={w * 0.12}
            y1={h * 0.66}
            x2={w * 0.12 + Math.min(1, raw / Math.max(1, stages.length - 1)) * w * 0.76}
            y2={h * 0.66}
            stroke={accent}
            strokeWidth={line.detail}
          />
        </g>

        {/* THE OBJECT. One outline, from the first frame to the last. */}
        <g>
          <path d={d} fill={`${colour}22`} stroke={colour} strokeWidth={line.object} strokeLinejoin="round" />
          {/* An inner line at heat, so hot metal reads as hot rather than as
              orange metal: the core is brighter than the skin. */}
          {heat > 0.15 ? (
            <path
              d={d}
              fill="none"
              stroke={glowColour(Math.min(1, heat + 0.25), accent, muted)}
              strokeWidth={line.construction}
              opacity={heat * 0.8}
              transform={`translate(0 ${w * 0.004})`}
            />
          ) : null}
        </g>

        {/* THE AGENT, above the object, acting on it. */}
        {agent !== 'none' ? (
          <Agent kind={agent} x={w * 0.5} y={box.y - w * 0.05} w={w} colour={accent} p={within} />
        ) : null}
      </svg>

      {/**
       * WHAT IT IS NOW, AND WHY.
       *
       * Two lines, in the object's own band: the state, and underneath it the
       * cause that produced it. This is where the causality is stated in words
       * — the drawing shows it, the label names it, and neither is asked to do
       * the other's job.
       */}
      <div
        style={{
          position: 'absolute',
          left: w * 0.12,
          right: w * 0.12,
          top: h * 0.7,
          textAlign: 'center',
          transform: `scale(${punch(stepped, from + index * each, {amount: 0.06, rise: 2, decay: 0.2})})`,
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: w * 0.052,
            letterSpacing: '-0.01em',
            color: settled || spec.highlight === index ? accent : muted,
            textTransform: 'uppercase',
          }}
        >
          {String(shown.label ?? '').toUpperCase()}
        </div>
        {shown.effect ? (
          <div
            style={{
              fontFamily: MONO,
              fontSize: w * 0.024,
              letterSpacing: '0.18em',
              color: muted,
              opacity: 0.8,
              marginTop: w * 0.012,
              textTransform: 'uppercase',
            }}
          >
            {shown.effect}
          </div>
        ) : null}
      </div>

      {spec.objectLabel ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: h * 0.2,
            textAlign: 'center',
            fontFamily: MONO,
            fontSize: w * 0.022,
            letterSpacing: '0.3em',
            color: muted,
            opacity: 0.6 * on,
            textTransform: 'uppercase',
          }}
        >
          {spec.objectLabel}
        </div>
      ) : null}

      <Disclosure text={spec.disclosure ?? 'illustrative reconstruction'} colour={muted} at={from + 12} width={w} />
    </AbsoluteFill>
  );
};
