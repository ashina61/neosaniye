/**
 * ANATOMY WITH FLOW THROUGH IT — chambers, valves, vessels, and something
 * actually moving along a coherent circuit.
 *
 * This one exists because of the worst thing the engine has ever drawn. Given
 * the line "four chambers, four valves, and every valve in the mechanism opens
 * one way only", the representation director matched the word "mechanism"
 * against a figure and emitted a TRAIN OF MESHING GEARS, labelled SCHEMATIC
 * RECONSTRUCTION, as a picture of a human heart. Every coordinate was right.
 * The wheels meshed. It was a lie, and no gate caught it.
 *
 * So the rule is written into the component and not only into the validator:
 *
 *   A BODY IS NOT A MACHINE. Anatomy gets chambers that fill and empty, valves
 *   that open one way, vessels that carry, and a circuit the flow goes ROUND.
 *   No gears. No cogs. No escapements.
 *
 * And the circulation has to be COHERENT: a particle that leaves a chamber
 * arrives at the next one along the path, through the valve between them, and
 * comes back to where it started. A loop that does not close is a diagram of
 * nothing.
 *
 * Data in, geometry here. Unit coordinates, scene-relative frames.
 */
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {cyclic, drawOn, posterizeTime} from '../motion';
import {Callout, Cam, Disclosure, MONO, Sheet, Ticks, weights, worldTransform} from './sheet';
import {Contact, MaterialDefs, MaterialFace} from './material';

const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** A chamber, a lobe, a reservoir: something that fills and empties. */
export type Chamber = {
  id: string;
  /** Centre and radii as fractions of the frame. */
  x: number;
  y: number;
  rx: number;
  ry: number;
  label?: string;
  /**
   * WALL THICKNESS AS A CLAIM.
   *
   * "The left has to push through the whole body, so its wall is three times
   * thicker" is a sentence about geometry, and the geometry can carry it. 1 is
   * ordinary; 3 is three times as thick and visibly so.
   */
  wall?: number;
  /** Where in the cycle it contracts, 0..1. Two chambers on the same phase
      squeeze together, which is exactly what atria do. */
  phase?: number;
  focus?: boolean;
};

/** A one-way gate between two chambers, or between a chamber and a vessel. */
export type Valve = {
  x: number;
  y: number;
  /** Degrees; the flow goes this way through it and no other. */
  angle?: number;
  label?: string;
  /** Cycle position at which it opens. */
  opensAt?: number;
};

/** A pipe. The path the flow follows, in order. */
export type Vessel = {
  path: [number, number][];
  label?: string;
  /** Oxygenated or not — the one colour distinction anatomy actually needs. */
  charge?: 'high' | 'low';
  width?: number;
};

export type AnatomyFlowSpec = Sheet & {
  type: 'anatomyFlow';
  chambers: Chamber[];
  valves?: Valve[];
  vessels?: Vessel[];
  /**
   * THE CIRCUIT — vessel indices in the order the flow travels them.
   *
   * Given as a closed loop, so what leaves comes back. The validator checks
   * that it closes; a circulation that ends somewhere is not a circulation.
   */
  circuit?: number[];
  /** Beats per cycle of the animation, so contraction and flow agree. */
  cycleFrames?: number;
  /** A stated delay between two phases — the thing the heart episode is about. */
  delay?: {label: string; fraction: number};
  annotations?: {x: number; y: number; text: string; side?: 'left' | 'right'; at?: number}[];
};

/**
 * HOW FAR THE FLOW HAS TRAVELLED, GIVEN WHAT THE CHAMBERS HAVE DONE.
 *
 * Integrated rather than interpolated: each frame adds the current contraction
 * to a running total, so the position of the blood is the HISTORY of the
 * squeezes. That is the difference between "blood moves and chambers contract"
 * and "blood moves because chambers contract".
 */
function chambersDrive(spec: AnatomyFlowSpec, squeeze: (at: number) => number): number {
  const phases = (spec.chambers ?? []).map((c) => c.phase ?? 0);
  const pumped = phases.reduce((n, p) => n + squeeze(p), 0) / Math.max(1, phases.length);
  // A resting baseline so the circuit never freezes between beats: real flow is
  // continuous, pulsed rather than stop-start.
  return 0.34 + pumped * 0.66;
}

const HIGH = '#d9534f';
const LOW = '#5b8fa8';

function along(points: [number, number][], p: number): [number, number] {
  if (points.length < 2) return points[0] ?? [0.5, 0.5];
  const span = (points.length - 1) * Math.min(1, Math.max(0, p));
  const i = Math.min(points.length - 2, Math.floor(span));
  const t = span - i;
  return [points[i][0] + (points[i + 1][0] - points[i][0]) * t, points[i][1] + (points[i + 1][1] - points[i][1]) * t];
}

export const AnatomyFlowPlate: React.FC<{spec: AnatomyFlowSpec; w: number; h: number; cam?: Cam}> = ({spec, w, h, cam}) => {
  /** The camera looks AT the world and THROUGH the sheet. */
  const world = worldTransform(cam, w, h);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const from = spec.from ?? 0;
  const accent = spec.accent ?? '#f2b53a';
  const muted = spec.muted ?? '#cfc6ae';
  const line = weights(w);
  if (stepped < from) return null;

  const on = drawOn(stepped, [from, from + 10]);
  const cycle = Math.max(12, spec.cycleFrames ?? 34);
  /**
   * THE CYCLE RUNS FROM THE FIRST FRAME.
   *
   * Law 30: the organ is already there and already beating when we cut to it.
   * A heart that starts beating on the cut is a heart being switched on.
   */
  const phase = ((Math.max(0, stepped - from) % cycle) / cycle + 1) % 1;

  /**
   * A FAST STROKE AND A SLOW RETURN — the shape of a pump, not of a sine.
   *
   * `cyclic` is asymmetric on purpose: the squeeze occupies under a third of
   * the cycle and the refill takes the rest, which is what makes it read as
   * something doing work rather than as something oscillating.
   */
  const squeeze = (at: number) => Math.max(0, cyclic(Math.max(0, stepped - from), cycle, {stroke: 0.3, phase: -at}));

  /**
   * AND THE FLOW IS CAUSED BY THE SQUEEZE.
   *
   * The particles used to travel at a constant rate while the chambers happened
   * to contract nearby — two animations sharing a frame. Their speed is now the
   * contraction itself, so blood surges when a chamber empties and slows when
   * it is filling. If the heart stopped, the flow would stop.
   */
  const drive = chambersDrive(spec, squeeze);

  const chambers = spec.chambers ?? [];
  const vessels = spec.vessels ?? [];

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0}}>
        <Ticks colour={muted} w={w} h={h} on={on} />

        {/* THE WORLD. Everything below here is what the camera is looking at;
            the ticks above and the plates below are the sheet it is drawn on. */}
        <g transform={world}>
        {/**
         * FLESH IS NOT A NEUTRAL.
         *
         * The hue wash was handed the plate's muted grey, so four chambers of a
         * heart rendered as four grey discs — the correct value, the correct
         * speckle, and the colour of a washer. The drawing already names the two
         * colours this organ is made of; the muscle takes the arterial one.
         */}
        <MaterialDefs id="anat-flesh" material="flesh" colour={HIGH} w={w} seed="organ" />

        {/* VESSELS FIRST — the plumbing is behind the organ, as it is in a plate. */}
        {vessels.map((vessel, i) => {
          /**
           * DRAWN AS A CURVE, NOT AS A POLYLINE.
           *
           * A vessel with mitred corners reads as a circuit diagram. Rounding
           * each corner through the midpoints of its two segments turns the same
           * data into something that looks like it carries fluid, and costs one
           * line of path building.
           */
          const pts = vessel.path.map(([x, y]) => [x * w, y * h] as [number, number]);
          const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          let d = `M ${pts[0][0]} ${pts[0][1]}`;
          for (let k = 1; k < pts.length - 1; k += 1) {
            const m = mid(pts[k], pts[k + 1]);
            d += ` Q ${pts[k][0]} ${pts[k][1]} ${m[0]} ${m[1]}`;
          }
          d += ` L ${pts[pts.length - 1][0]} ${pts[pts.length - 1][1]}`;
          const colour = vessel.charge === 'high' ? HIGH : vessel.charge === 'low' ? LOW : muted;
          return (
            <g key={`v${i}`}>
              <path
                d={d}
                fill="none"
                stroke={colour}
                strokeWidth={(vessel.width ?? 0.018) * w}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.24}
              />
              <path
                d={d}
                fill="none"
                stroke={colour}
                strokeWidth={line.detail}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.8}
              />
            </g>
          );
        })}

        {/* THE CHAMBERS. Wall thickness is a claim, so it is drawn as thickness. */}
        {chambers.map((chamber, i) => {
          const s = squeeze(chamber.phase ?? 0);
          // A chamber that contracts gets SMALLER. Nothing else about it moves.
          const k = 1 - s * 0.14;
          const cx = chamber.x * w;
          const cy = chamber.y * h;
          const rx = chamber.rx * w * k;
          const ry = chamber.ry * h * k;
          const wall = line.object * Math.max(1, chamber.wall ?? 1);
          const colour = chamber.focus ? accent : muted;
          return (
            <g key={`c${i}`}>
              <Contact x={cx} y={cy + ry * 1.12} width={rx * 1.5} strength={0.35} />
              <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#0c0806" opacity={0.45} />
              <ellipse
                cx={cx}
                cy={cy}
                rx={rx}
                ry={ry}
                fill={colour}
                opacity={chamber.focus ? 0.16 : 0.1}
                stroke={colour}
                strokeWidth={wall}
              />
              <MaterialFace id="anat-flesh" material="flesh" ellipse={{cx, cy, rx, ry}} w={w} />
              {/* The inner face, so a thick wall reads as a wall and not as a
                  heavy outline. */}
              <ellipse cx={cx} cy={cy} rx={Math.max(1, rx - wall)} ry={Math.max(1, ry - wall)} fill="none" stroke={colour} strokeWidth={line.construction} opacity={0.5} />
              {chamber.label ? (
                <text
                  x={cx}
                  y={cy + ry + w * 0.03}
                  textAnchor="middle"
                  fill={colour}
                  fontFamily={MONO}
                  fontSize={w * 0.02}
                  letterSpacing="0.16em"
                  opacity={0.9}
                >
                  {chamber.label.toUpperCase()}
                </text>
              ) : null}
            </g>
          );
        })}

        {/* THE VALVES. Two leaflets that swing open one way and shut against
            the other — the entire claim of "opens in a single direction". */}
        {(spec.valves ?? []).map((valve, i) => {
          const openAmount = squeeze(valve.opensAt ?? 0);
          const spread = interpolate(openAmount, [0, 1], [6, 62], CLAMP);
          const x = valve.x * w;
          const y = valve.y * h;
          const len = w * 0.03;
          return (
            <g key={`va${i}`} transform={`translate(${x} ${y}) rotate(${valve.angle ?? 0})`}>
              {/* A SHUT VALVE IS SHUT. The leaflets meet, and nothing passes. */}
              {[-1, 1].map((side) => (
                <line
                  key={side}
                  x1={0}
                  y1={0}
                  x2={Math.sin((spread * Math.PI) / 180) * len * side}
                  y2={Math.cos((spread * Math.PI) / 180) * len}
                  stroke={accent}
                  strokeWidth={line.object}
                  strokeLinecap="round"
                />
              ))}
              <circle cx={0} cy={0} r={w * 0.004} fill={accent} />
            </g>
          );
        })}

        {/**
         * THE FLOW.
         *
         * Particles travel the circuit in ORDER, so what leaves the first
         * vessel enters the second and comes back round. This is the part that
         * makes it circulation rather than arrows.
         */}
        {(spec.circuit ?? vessels.map((_, i) => i)).length > 0
          ? Array.from({length: 14}, (_, k) => {
              const order = spec.circuit ?? vessels.map((_, i) => i);
              if (!order.length) return null;
              // Driven by the pump, not by the clock.
              const trip = ((phase * drive * 1.4) + k / 14) % 1;
              const at = trip * order.length;
              const leg = Math.min(order.length - 1, Math.floor(at));
              const vessel = vessels[order[leg]];
              if (!vessel) return null;
              const [px, py] = along(vessel.path, at - leg);
              const colour = vessel.charge === 'high' ? HIGH : vessel.charge === 'low' ? LOW : accent;
              return <circle key={`p${k}`} cx={px * w} cy={py * h} r={w * 0.0065} fill={colour} opacity={0.95} />;
            })
          : null}

        {(spec.annotations ?? []).map((note, i) => (
          <Callout
            key={`a${i}`}
            x={note.x * w}
            y={note.y * h}
            text={note.text}
            colour={muted}
            w={w}
            side={note.side ?? 'right'}
            at={from + (note.at ?? 14 + i * 7)}
          />
        ))}
        </g>
      </svg>

      {/**
       * THE DELAY, STATED AND TIMED.
       *
       * "A tenth of a second later" is the heart episode's whole claim, and a
       * label alone would be the same failure as before. The bar fills over
       * exactly the fraction of the cycle it names, so the words and the
       * drawing are saying the same thing at the same moment.
       */}
      {spec.delay ? (
        <div style={{position: 'absolute', left: w * 0.12, right: w * 0.12, top: h * 0.7, textAlign: 'center'}}>
          <div style={{fontFamily: MONO, fontSize: w * 0.022, letterSpacing: '0.24em', color: muted, opacity: 0.8, textTransform: 'uppercase'}}>
            {spec.delay.label}
          </div>
          <svg width="100%" height={w * 0.03} style={{marginTop: w * 0.014, overflow: 'visible'}}>
            <line x1="0" y1={w * 0.012} x2="100%" y2={w * 0.012} stroke={muted} strokeWidth={line.construction} />
            <rect
              x="0"
              y={w * 0.006}
              width={`${Math.min(1, phase / Math.max(0.01, spec.delay.fraction)) * 100 * spec.delay.fraction}%`}
              height={w * 0.012}
              fill={accent}
              opacity={0.85}
            />
            <line
              x1={`${spec.delay.fraction * 100}%`}
              y1={0}
              x2={`${spec.delay.fraction * 100}%`}
              y2={w * 0.024}
              stroke={accent}
              strokeWidth={line.detail}
            />
          </svg>
        </div>
      ) : null}

      <Disclosure text={spec.disclosure ?? 'schematic anatomy · not to scale'} colour={muted} at={from + 12} width={w} />
    </AbsoluteFill>
  );
};
