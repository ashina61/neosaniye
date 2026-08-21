import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {CITIES, COUNTRIES, GERMAN_THRUSTS, SOVIET_THRUSTS, pathOf, project, type Thrust} from './map';
import {
  COAST_BALTIC,
  COAST_NORTH,
  FORESTS,
  FRONT_END,
  FRONT_MID,
  FRONT_START,
  POCKETS,
  RIDGES,
  RIVERS,
  UNITS,
  type Line,
} from './atlas';

/**
 * THE THEATRE — a printed map, not a diagram.
 *
 * Dark ink on light paper, which is the single biggest change from the first
 * version and the reason that one could not be read: a map floating on black
 * has to light every line from nothing, so everything competes and nothing
 * reads. On paper the ink is the darkest thing in the frame and the eye finds
 * it without being helped.
 *
 * The layer order below is a printer's order, and it matters. Terrain is
 * printed first and the operational overlay goes on top of it in one colour,
 * because that is what an overlay IS: the geography was already there, and
 * somebody drew the war on it in red.
 */

const PAPER = '#e6dcc3';
const INK = '#2b2417';
const RED = '#a8291d';
const BLUE = '#3f6d8e';

const hash = (n: number): number => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const poly = (line: Line): string =>
  line.map((p, i) => {
    const [x, y] = project(p);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');

/** Two lines of the same length, blended. The front DEFORMS instead of being
 *  redrawn — a front that jumps between shapes is two diagrams. */
const blend = (a: Line, b: Line, t: number): Line =>
  a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t] as [number, number]);

/** A point and heading along a quadratic arc, so an arrowhead can ride it. */
const along = (thrust: Thrust, t: number) => {
  const [x1, y1] = project(thrust.from);
  const [x2, y2] = project(thrust.to);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx - (dy / len) * thrust.bend;
  const cy = my + (dx / len) * thrust.bend;
  const u = 1 - t;
  return {
    x: u * u * x1 + 2 * u * t * cx + t * t * x2,
    y: u * u * y1 + 2 * u * t * cy + t * t * y2,
    angle: (Math.atan2(2 * u * (cy - y1) + 2 * t * (y2 - cy), 2 * u * (cx - x1) + 2 * t * (x2 - cx)) * 180) / Math.PI,
    d: `M${x1.toFixed(2)},${y1.toFixed(2)} Q${cx.toFixed(2)},${cy.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)}`,
  };
};

/* ---------------------------------------------------------------- PARTS -- */

/** Mountains the way maps draw them: a ridge with hachure teeth along it. A
 *  grey blob does not read as high ground; a row of little peaks does. */
const Relief: React.FC = () => (
  <g opacity={0.62}>
    {RIDGES.map((ridge, r) => {
      const pts = ridge.line.map(project);
      const teeth: React.ReactNode[] = [];
      for (let i = 0; i < pts.length - 1; i += 1) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[i + 1];
        const seg = Math.hypot(x2 - x1, y2 - y1);
        const n = Math.max(2, Math.round(seg / 1.5));
        for (let k = 0; k < n; k += 1) {
          const t = k / n;
          const x = x1 + (x2 - x1) * t;
          const y = y1 + (y2 - y1) * t;
          const h = ridge.weight * (0.9 + hash(r * 97 + i * 31 + k) * 0.7);
          teeth.push(
            <path
              key={`${r}-${i}-${k}`}
              d={`M${(x - h * 0.62).toFixed(2)},${(y + h * 0.42).toFixed(2)} L${x.toFixed(2)},${(y - h).toFixed(
                2,
              )} L${(x + h * 0.62).toFixed(2)},${(y + h * 0.42).toFixed(2)} Z`}
              fill="#7d6c4d"
              stroke="#4a3f2a"
              strokeWidth={0.09}
            />,
          );
        }
      }
      return <g key={r}>{teeth}</g>;
    })}
  </g>
);

/** Woodland: the stipple every topographic sheet uses. Two of the pockets
 *  closed in forest, so it is terrain rather than texture. */
const Woods: React.FC = () => (
  <g opacity={0.5}>
    {FORESTS.map((wood, w) => {
      const [cx, cy] = project(wood.at);
      const r = wood.r * 2.4;
      return Array.from({length: Math.round(22 * wood.r + 8)}, (_, i) => {
        const a = hash(w * 71 + i) * Math.PI * 2;
        const rad = Math.sqrt(hash(w * 53 + i + 9)) * r;
        return (
          <circle
            key={`${w}-${i}`}
            cx={cx + Math.cos(a) * rad}
            cy={cy + Math.sin(a) * rad * 0.7}
            r={0.24}
            fill="#4d6136"
          />
        );
      });
    })}
  </g>
);

/** A NATO-style marker: a box with a cross is infantry, with an oval it is
 *  armour. Anyone who has seen a war documentary reads them without a legend. */
const Marker: React.FC<{x: number; y: number; kind: 'armour' | 'infantry'; side: string; scale: number}> = ({
  x,
  y,
  kind,
  side,
  scale,
}) => {
  const w = 2.6 * scale;
  const h = 1.6 * scale;
  const colour = side === 'de' ? RED : side === 'su' ? '#8a6a1e' : '#2f4f7a';
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={PAPER} stroke={colour} strokeWidth={0.22 * scale} />
      {kind === 'infantry' ? (
        <>
          <line x1={-w / 2} y1={-h / 2} x2={w / 2} y2={h / 2} stroke={colour} strokeWidth={0.18 * scale} />
          <line x1={-w / 2} y1={h / 2} x2={w / 2} y2={-h / 2} stroke={colour} strokeWidth={0.18 * scale} />
        </>
      ) : (
        <ellipse cx={0} cy={0} rx={w * 0.3} ry={h * 0.32} fill="none" stroke={colour} strokeWidth={0.2 * scale} />
      )}
    </g>
  );
};

/* --------------------------------------------------------------- THEATRE -- */

export type Ops = {
  /** 0..1 — how much of the printed map has been laid down. */
  print: number;
  /** 0..1 — the German advance. */
  west: number;
  /** 0..1 — the Soviet advance. */
  east: number;
  /** 0..1 — how far the front has deformed from the border. */
  front: number;
  /** Secret protocol line. */
  split: number;
  /** Which countries are shaded as belligerents. */
  lit: string[];
  /** Show unit markers and pockets. */
  ops: boolean;
};

export const Theatre: React.FC<{ops: Ops; zoom?: number; focus?: [number, number]; label?: string; date?: string}> = ({
  ops,
  zoom = 1,
  focus = [12, 52],
  label,
  date,
}) => {
  const {width, height} = useVideoConfig();
  const frame = useCurrentFrame();
  const size = width * 1.34 * zoom;
  const [fx, fy] = project(focus);
  const left = width / 2 - (fx / 100) * size;
  const top = height / 2 - (fy / 100) * size;
  const s = 1 / zoom; // keep line weights constant on screen as the camera pushes

  const front = ops.front < 0.5 ? blend(FRONT_START, FRONT_MID, ops.front * 2) : blend(FRONT_MID, FRONT_END, (ops.front - 0.5) * 2);

  const thrusts = (list: Thrust[], progress: number, colour: string) =>
    list.map((thrust, i) => {
      const t = Math.max(0, Math.min(1, (progress - thrust.at) / (1 - thrust.at)));
      if (t <= 0.001) return null;
      const head = along(thrust, t);
      return (
        <g key={i}>
          <path
            d={head.d}
            fill="none"
            stroke={colour}
            strokeWidth={1.5 * s}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - t}
            opacity={0.92}
          />
          <g transform={`translate(${head.x},${head.y}) rotate(${head.angle}) scale(${s})`}>
            <path d="M0,0 L-4.4,2.4 L-3.1,0 L-4.4,-2.4 Z" fill={colour} />
          </g>
        </g>
      );
    });

  return (
    <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#171308'}}>
      <svg viewBox="0 0 100 100" width={size} height={size} style={{position: 'absolute', left, top}}>
        <defs>
          <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#efe6cf" />
            <stop offset="46%" stopColor={PAPER} />
            <stop offset="100%" stopColor="#d5c9aa" />
          </linearGradient>
          <pattern id="sea" width="1.6" height="1.6" patternUnits="userSpaceOnUse">
            <rect width="1.6" height="1.6" fill="#cfd8d4" />
            <path d="M0,1.2 L1.6,1.2" stroke="#adbcbb" strokeWidth="0.16" />
          </pattern>
          <pattern id="pocket" width="1.2" height="1.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="1.2" height="1.2" fill="rgba(168,41,29,0.1)" />
            <path d="M0,0 L0,1.2" stroke="rgba(168,41,29,0.45)" strokeWidth="0.26" />
          </pattern>
          <clipPath id="west">
            <rect x={0} y={0} width={interpolate(ops.west, [0, 1], [42, 60])} height={100} />
          </clipPath>
          <clipPath id="east">
            <rect x={interpolate(ops.east, [0, 1], [62, 48])} y={0} width={52} height={100} />
          </clipPath>
        </defs>

        {/* PAPER, then the sea printed on it. */}
        <rect x={-20} y={-20} width={140} height={140} fill="url(#paper)" />
        <rect x={-20} y={-20} width={140} height={140} fill="url(#sea)" opacity={0.85} />

        {/* THE GRATICULE — faint, and under everything. A map without one is a
            drawing of a country; with one it is a document. */}
        <g opacity={0.22 * ops.print}>
          {Array.from({length: 12}, (_, i) => {
            const [x] = project([-12 + i * 5, 50]);
            return <line key={`m${i}`} x1={x} y1={-20} x2={x} y2={120} stroke="#8d7f5f" strokeWidth={0.12 * s} />;
          })}
          {Array.from({length: 10}, (_, i) => {
            const [, y] = project([0, 70 - i * 4]);
            return <line key={`p${i}`} x1={-20} y1={y} x2={120} y2={y} stroke="#8d7f5f" strokeWidth={0.12 * s} />;
          })}
        </g>

        {/* LAND. Printed in order, west to east, so the sheet assembles. */}
        {COUNTRIES.map((country, index) => {
          const own = Math.max(0, Math.min(1, ops.print * COUNTRIES.length - index));
          if (own <= 0) return null;
          const lit = ops.lit.includes(country.id);
          return (
            <path
              key={country.id}
              d={pathOf(country.points)}
              fill={lit ? 'rgba(168,41,29,0.2)' : 'rgba(214,201,166,0.95)'}
              stroke="#6f6144"
              strokeWidth={0.3 * s}
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - own}
              opacity={own}
            />
          );
        })}

        {ops.print > 0.55 ? (
          <g opacity={interpolate(ops.print, [0.55, 0.9], [0, 1], {extrapolateRight: 'clamp'})}>
            <Woods />
            <Relief />
            {RIVERS.map((river) => (
              <path
                key={river.name}
                d={poly(river.line)}
                fill="none"
                stroke={BLUE}
                strokeWidth={(river.big ? 0.46 : 0.28) * s}
                strokeLinecap="round"
                opacity={0.8}
              />
            ))}
            <path d={poly(COAST_BALTIC)} fill="none" stroke="#7b8f94" strokeWidth={0.34 * s} />
            <path d={poly(COAST_NORTH)} fill="none" stroke="#7b8f94" strokeWidth={0.34 * s} />
          </g>
        ) : null}

        {/* THE OVERLAY. Everything from here is drawn ON the map, in red,
            because that is what an operational overlay is. */}
        {ops.west > 0 ? (
          <path d={pathOf(COUNTRIES.find((c) => c.id === 'pl')!.points)} fill="rgba(168,41,29,0.4)" clipPath="url(#west)" />
        ) : null}
        {ops.east > 0 ? (
          <path d={pathOf(COUNTRIES.find((c) => c.id === 'pl')!.points)} fill="rgba(138,106,30,0.4)" clipPath="url(#east)" />
        ) : null}

        {ops.split > 0 ? (
          <path
            d={`M${project([19.2, 55.2]).join(',')} L${project([22.4, 48.9]).join(',')}`}
            stroke="#8a6a1e"
            strokeWidth={0.55 * s}
            strokeDasharray={`${1.8 * s} ${1.2 * s}`}
            opacity={ops.split}
          />
        ) : null}

        {/* THE FRONT — a bar-and-tick line, the way a situation map draws one,
            and it BENDS rather than being redrawn. */}
        {ops.front > 0.001 ? (
          <g>
            <path d={poly(front)} fill="none" stroke={RED} strokeWidth={0.9 * s} strokeLinejoin="round" />
            {front.map((p, i) => {
              if (i === front.length - 1) return null;
              const [x1, y1] = project(p);
              const [x2, y2] = project(front[i + 1]);
              const dx = x2 - x1;
              const dy = y2 - y1;
              const len = Math.hypot(dx, dy) || 1;
              return (
                <line
                  key={i}
                  x1={(x1 + x2) / 2}
                  y1={(y1 + y2) / 2}
                  x2={(x1 + x2) / 2 + (dy / len) * 1.1 * s}
                  y2={(y1 + y2) / 2 - (dx / len) * 1.1 * s}
                  stroke={RED}
                  strokeWidth={0.5 * s}
                />
              );
            })}
          </g>
        ) : null}

        {thrusts(GERMAN_THRUSTS, ops.west, RED)}
        {thrusts(SOVIET_THRUSTS, ops.east, '#8a6a1e')}

        {/* POCKETS. The thing arrows cannot say on their own: SURROUNDED. */}
        {ops.ops
          ? POCKETS.map((pocket) => {
              const t = interpolate(ops.west, [pocket.at01, pocket.at01 + 0.18], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              if (t <= 0.01) return null;
              const [cx, cy] = project(pocket.at);
              const rx = pocket.rx * 1.85;
              const ry = pocket.ry * 2.86;
              return (
                <g key={pocket.name} opacity={t}>
                  <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#pocket)" />
                  <ellipse
                    cx={cx}
                    cy={cy}
                    rx={rx}
                    ry={ry}
                    fill="none"
                    stroke={RED}
                    strokeWidth={0.5 * s}
                    strokeDasharray={`${1.4 * s} ${0.9 * s}`}
                    pathLength={1}
                    strokeDashoffset={1 - t}
                  />
                  <text
                    x={cx}
                    y={cy - ry - 0.9 * s}
                    fill={RED}
                    fontSize={2.1 * s}
                    fontFamily='"Courier New", monospace'
                    fontWeight={700}
                    textAnchor="middle"
                  >
                    {pocket.name}
                  </text>
                </g>
              );
            })
          : null}

        {ops.ops
          ? UNITS.map((unit, i) => {
              const t = interpolate(ops.west, [unit.at01, unit.at01 + 0.5], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              const [x1, y1] = project(unit.at);
              const [x2, y2] = project(unit.to);
              const jitter = Math.sin(frame * 0.12 + i) * 0.08;
              return (
                <Marker
                  key={i}
                  x={x1 + (x2 - x1) * t + jitter}
                  y={y1 + (y2 - y1) * t}
                  kind={unit.kind}
                  side={unit.side}
                  scale={s}
                />
              );
            })
          : null}

        {ops.print > 0.9
          ? CITIES.map((city) => {
              const [x, y] = project(city.at);
              return (
                <g key={city.name}>
                  <circle cx={x} cy={y} r={0.42 * s} fill={INK} />
                  <circle cx={x} cy={y} r={0.85 * s} fill="none" stroke={INK} strokeWidth={0.16 * s} />
                  <text
                    x={x + 1.2 * s}
                    y={y + 0.7 * s}
                    fill={INK}
                    fontSize={2.1 * s}
                    fontFamily='"Courier New", monospace'
                    fontWeight={700}
                  >
                    {city.name}
                  </text>
                </g>
              );
            })
          : null}
      </svg>

      {/* MAP FURNITURE. A title block and a scale bar, over the sheet rather
          than floating on nothing — which is the difference between a caption
          and a document somebody was reading. */}
      {label ? (
        <div
          style={{
            position: 'absolute',
            top: height * 0.055,
            left: width * 0.07,
            right: width * 0.07,
            background: 'rgba(28,22,12,0.9)',
            borderLeft: `${width * 0.012}px solid ${RED}`,
            padding: `${height * 0.014}px ${width * 0.04}px`,
            boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
          }}
        >
          {date ? (
            <div style={{fontFamily: '"Courier New", monospace', fontSize: width * 0.036, letterSpacing: '0.3em', color: '#d8b26a'}}>
              {date}
            </div>
          ) : null}
          <div
            style={{
              fontFamily: '"Archivo", "Helvetica Neue", Arial, sans-serif',
              fontWeight: 900,
              fontSize: width * 0.062,
              letterSpacing: '-0.01em',
              color: '#f0e7d2',
              lineHeight: 1.05,
            }}
          >
            {label}
          </div>
        </div>
      ) : null}

      <div style={{position: 'absolute', bottom: height * 0.055, left: width * 0.08, opacity: ops.print}}>
        <div style={{display: 'flex', alignItems: 'flex-end'}}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: width * 0.05,
                height: height * 0.008,
                background: i % 2 ? PAPER : INK,
                border: `1px solid ${INK}`,
              }}
            />
          ))}
        </div>
        <div style={{fontFamily: '"Courier New", monospace', fontSize: width * 0.026, color: INK, marginTop: 4, letterSpacing: '0.18em'}}>
          0 — 400 KM
        </div>
      </div>
    </AbsoluteFill>
  );
};
