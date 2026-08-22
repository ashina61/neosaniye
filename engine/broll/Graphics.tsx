import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {DISPLAY, TEXT} from './fonts';

/**
 * THE LAYER THAT SAYS WHAT HAPPENED.
 *
 * A photograph says WHO and WHERE. It cannot say "one in five barrels", "a
 * hundred and thirty ships became ten", or "thirty-three kilometres" — and
 * those are the sentences this kind of story is made of. Ask a generator for
 * them and you get a picture of a chart, which is a picture of a lie: the
 * numbers on it are invented and the lines go nowhere.
 *
 * So they are DRAWN, from the same numbers the script says out loud, and they
 * are the only thing on screen that deliberately changes. That is what the eye
 * follows.
 *
 * Everything here is nailed to the FRAME, not to the room: a graphic is about
 * the sentence, not an object standing in the scene, and one that drifts with
 * the camera stops reading as a graphic and starts reading as a prop someone
 * left on the set.
 *
 * Coordinates are fractions of the frame, like every other position in this
 * engine, so one beat file works vertical and landscape.
 */

export type Graphic =
  /** A line that draws itself. The route, the detour, the front. */
  | {
      kind: 'route';
      points: [number, number][];
      at?: number;
      over?: number;
      dash?: boolean;
      head?: boolean;
      label?: string;
      /** Which point the label sits by. The route's start is rarely the place
       *  it is named after — a detour is named for its far end. */
      labelAt?: number;
      colour?: string;
      thickness?: number;
    }
  /** Two ticks and a dimension between them. For a width, a distance, a gap. */
  | {kind: 'measure'; from: [number, number]; to: [number, number]; label: string; at?: number; colour?: string}
  /** `count` marks, of which `keep` stay lit. For "a hundred and thirty became ten". */
  | {
      kind: 'dots';
      count: number;
      keep: number;
      x?: number;
      y?: number;
      width?: number;
      at?: number;
      over?: number;
      label?: string;
      colour?: string;
    }
  /** A number that climbs. The size of the thing, felt rather than read. */
  | {
      kind: 'count';
      to: number;
      from?: number;
      prefix?: string;
      suffix?: string;
      label?: string;
      x?: number;
      y?: number;
      at?: number;
      over?: number;
      size?: number;
      colour?: string;
    };

type Props = {graphics: Graphic[]; accent: string; paper: string};

/** 0→1 over `over` frames starting at `at`, eased so nothing starts or stops
 *  at full speed. */
const useProgress = (at = 0, over = 30) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [at, at + Math.max(1, over)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return t * t * (3 - 2 * t);
};

const Route: React.FC<{g: Extract<Graphic, {kind: 'route'}>; accent: string; paper: string}> = ({
  g,
  accent,
  paper,
}) => {
  const {width, height} = useVideoConfig();
  const p = useProgress(g.at ?? 0, g.over ?? 45);
  if (p <= 0) return null;

  const pts = g.points.map(([x, y]) => [x * width, y * height] as const);
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const colour = g.colour ?? accent;
  const stroke = (g.thickness ?? 0.007) * width;
  const [hx, hy] = pts[pts.length - 1];

  return (
    <>
      {/* A dark liner under the line, so it survives a pale sea and a dark one.
          Same reason the caption carries its own ground. */}
      <path
        d={d}
        fill="none"
        stroke="rgba(10,14,20,0.45)"
        strokeWidth={stroke * 2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - p}
      />
      <path
        d={d}
        fill="none"
        stroke={colour}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={g.dash ? `${stroke * 2.2} ${stroke * 1.8}` : 1}
        pathLength={g.dash ? undefined : 1}
        strokeDashoffset={g.dash ? undefined : 1 - p}
        opacity={g.dash ? p : 1}
      />
      {g.head && p > 0.985 ? <circle cx={hx} cy={hy} r={stroke * 1.5} fill={colour} /> : null}
      {g.label && p > 0.5 ? (
        <text
          x={(pts[g.labelAt ?? 0] ?? pts[0])[0]}
          y={(pts[g.labelAt ?? 0] ?? pts[0])[1] - stroke * 2}
          fill={paper}
          fontFamily={TEXT}
          fontWeight={800}
          fontSize={width * 0.028}
          letterSpacing={width * 0.003}
          opacity={interpolate(p, [0.5, 0.8], [0, 1], {extrapolateRight: 'clamp'})}
        >
          {g.label}
        </text>
      ) : null}
    </>
  );
};

const Measure: React.FC<{g: Extract<Graphic, {kind: 'measure'}>; accent: string; paper: string}> = ({
  g,
  accent,
  paper,
}) => {
  const {width, height} = useVideoConfig();
  const p = useProgress(g.at ?? 0, 26);
  if (p <= 0) return null;

  const x1 = g.from[0] * width;
  const y1 = g.from[1] * height;
  const x2 = g.to[0] * width;
  const y2 = g.to[1] * height;
  // The dimension grows from its own middle outwards, which is how a hand
  // measuring something moves: out to one edge, out to the other.
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const ax = mx + (x1 - mx) * p;
  const ay = my + (y1 - my) * p;
  const bx = mx + (x2 - mx) * p;
  const by = my + (y2 - my) * p;
  const colour = g.colour ?? accent;
  const stroke = width * 0.005;
  // Ticks stand perpendicular to the line, whatever angle it is at.
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = (-(y2 - y1) / len) * width * 0.018;
  const ny = ((x2 - x1) / len) * width * 0.018;

  return (
    <>
      <path
        d={`M${ax},${ay} L${bx},${by}`}
        stroke={colour}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
      />
      <path d={`M${ax - nx},${ay - ny} L${ax + nx},${ay + ny}`} stroke={colour} strokeWidth={stroke} />
      <path d={`M${bx - nx},${by - ny} L${bx + nx},${by + ny}`} stroke={colour} strokeWidth={stroke} />
      {p > 0.85 ? (
        <>
          <rect
            x={mx - width * 0.13}
            y={my - width * 0.036}
            width={width * 0.26}
            height={width * 0.072}
            fill={colour}
          />
          <text
            x={mx}
            y={my + width * 0.019}
            fill={paper}
            textAnchor="middle"
            fontFamily={DISPLAY}
            fontWeight={900}
            fontSize={width * 0.05}
          >
            {g.label}
          </text>
        </>
      ) : null}
    </>
  );
};

/**
 * ONE MARK PER SHIP.
 *
 * "A hundred and thirty ships a day became ten" is a sentence a viewer nods at
 * and does not feel. A hundred and thirty marks going out, ten staying lit, is
 * the same sentence and it cannot be nodded at — the eye counts what is left
 * whether it wants to or not.
 */
const Dots: React.FC<{g: Extract<Graphic, {kind: 'dots'}>; accent: string; paper: string}> = ({
  g,
  accent,
  paper,
}) => {
  const {width, height} = useVideoConfig();
  const p = useProgress(g.at ?? 0, g.over ?? 40);
  if (p <= 0) return null;

  const boxW = (g.width ?? 0.78) * width;
  const cols = Math.ceil(Math.sqrt(g.count * 1.7));
  const rows = Math.ceil(g.count / cols);
  const gap = boxW / cols;
  const left = (g.x ?? 0.5) * width - boxW / 2;
  const top = (g.y ?? 0.5) * height - (rows * gap) / 2;
  const r = gap * 0.17;
  const colour = g.colour ?? accent;

  const marks = [];
  for (let i = 0; i < g.count; i += 1) {
    const cx = left + (i % cols) * gap + gap / 2;
    const cy = top + Math.floor(i / cols) * gap + gap / 2;
    const lit = i < g.keep;
    /**
     * They go out in the order they were drawn, staggered, so the loss reads as
     * a draining rather than as a single cut — and THEY DO NOT GO TO ZERO.
     *
     * Faded all the way out, "a hundred and thirty became ten" ends as ten
     * marks alone on a black frame, which is a picture of ten, not of a loss.
     * The ratio is the whole sentence, so what is gone has to stay faintly
     * countable.
     */
    const stagger = interpolate(p, [0.35 + (i / g.count) * 0.5, 0.45 + (i / g.count) * 0.5], [1, 0.26], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    marks.push(
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r={r}
        fill={lit ? colour : paper}
        opacity={lit ? Math.min(1, p * 3) : Math.min(1, p * 3) * (0.55 * stagger)}
      />,
    );
  }
  return (
    <>
      {marks}
      {g.label ? (
        <text
          x={(g.x ?? 0.5) * width}
          y={top + rows * gap + width * 0.06}
          fill={paper}
          textAnchor="middle"
          fontFamily={TEXT}
          fontWeight={800}
          fontSize={width * 0.03}
          letterSpacing={width * 0.004}
          opacity={interpolate(p, [0.6, 0.85], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
        >
          {g.label}
        </text>
      ) : null}
    </>
  );
};

/**
 * A NUMBER THAT CLIMBS.
 *
 * It has to LAND on the figure and stop, not still be spinning when the next
 * shot cuts — a counter still moving at the cut says the number does not
 * matter. So it eases out hard and finishes early inside its own window.
 */
const Count: React.FC<{g: Extract<Graphic, {kind: 'count'}>; accent: string; paper: string}> = ({
  g,
  accent,
  paper,
}) => {
  const {width, height} = useVideoConfig();
  const p = useProgress(g.at ?? 0, g.over ?? 46);
  if (p <= 0) return null;
  const eased = 1 - (1 - p) ** 3;
  const value = Math.round((g.from ?? 0) + ((g.to ?? 0) - (g.from ?? 0)) * eased);
  const size = (g.size ?? 0.2) * width;
  const x = (g.x ?? 0.5) * width;
  const y = (g.y ?? 0.42) * height;

  return (
    <>
      <text
        x={x}
        y={y}
        fill={g.colour ?? accent}
        textAnchor="middle"
        fontFamily={DISPLAY}
        fontWeight={900}
        fontSize={size}
        style={{fontVariantNumeric: 'tabular-nums'}}
      >
        {`${g.prefix ?? ''}${value.toLocaleString('tr-TR')}${g.suffix ?? ''}`}
      </text>
      {g.label ? (
        <text
          x={x}
          y={y + size * 0.42}
          fill={paper}
          textAnchor="middle"
          fontFamily={TEXT}
          fontWeight={800}
          fontSize={width * 0.032}
          letterSpacing={width * 0.005}
        >
          {g.label}
        </text>
      ) : null}
    </>
  );
};

export const Graphics: React.FC<Props> = ({graphics, accent, paper}) => {
  const {width, height} = useVideoConfig();
  if (!graphics?.length) return null;
  return (
    <AbsoluteFill>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{position: 'absolute'}}>
        {graphics.map((g, i) => {
          if (g.kind === 'route') return <Route key={i} g={g} accent={accent} paper={paper} />;
          if (g.kind === 'measure') return <Measure key={i} g={g} accent={accent} paper={paper} />;
          if (g.kind === 'dots') return <Dots key={i} g={g} accent={accent} paper={paper} />;
          if (g.kind === 'count') return <Count key={i} g={g} accent={accent} paper={paper} />;
          // An unknown kind is a typo in a beat file, and a typo that draws
          // nothing is a typo nobody finds until the reel is finished.
          return (
            <text key={i} x={width * 0.06} y={height * 0.5} fill="#E5484D" fontSize={width * 0.04}>
              {`? ${(g as {kind: string}).kind}`}
            </text>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
