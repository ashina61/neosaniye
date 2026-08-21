import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {CITIES, COUNTRIES, GERMAN_THRUSTS, SOVIET_THRUSTS, arcOf, pathOf, project, type Thrust} from './map';

/**
 * THE SCENES. Every one of them is drawn; there is not a photograph in the
 * film, and that is a choice rather than a shortage: the archive of September
 * 1939 is grainy, square, and mostly of men walking. What a phone in 2024 can
 * be shown that a viewer will actually follow is the SHAPE of what happened —
 * which is a map, a clock, and a wire report.
 */

export const FONT = '"Archivo", "Helvetica Neue", Arial, sans-serif';
export const MONO = '"Courier New", ui-monospace, monospace';
export const INK = '#0d0b07';
export const PAPER = '#e8dfc9';
export const BLOOD = '#b3271e';
export const STEEL = '#7d8fa3';

const ease = (frame: number, a: number, b: number) =>
  interpolate(frame, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});

const linear = (frame: number, a: number, b: number) =>
  interpolate(frame, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

/* ----------------------------------------------------------------- CLOCK -- */

/**
 * 04:45. The hands do not tick to it — they SWEEP, fast, and stop dead.
 *
 * A clock that ticks is a clock telling the time; a clock whose hands race and
 * then halt is a clock arriving at a moment, and the moment is the whole
 * content of the shot.
 */
export const Clock: React.FC<{length: number}> = ({length}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const r = width * 0.3;

  const sweep = interpolate(frame, [10, 62], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  // 04:45 — the hour hand three quarters of the way from 4 to 5.
  const hour = (4 + 45 / 60) * 30 * sweep + 360 * 3 * sweep;
  const minute = 45 * 6 * sweep + 360 * 22 * sweep;
  const land = spring({frame: frame - 62, fps, config: {damping: 9, mass: 0.5}, durationInFrames: 16});
  const flash = interpolate(frame, [62, 70], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{backgroundColor: '#05040a', justifyContent: 'center', alignItems: 'center'}}>
      <AbsoluteFill
        style={{background: `radial-gradient(circle at 50% 42%, rgba(255,214,150,${0.1 + flash * 0.35}) 0%, rgba(0,0,0,0) 62%)`}}
      />
      <svg width={width} height={height} style={{position: 'absolute'}}>
        <defs>
          <radialGradient id="face" cx="42%" cy="34%">
            <stop offset="0%" stopColor="#2a2620" />
            <stop offset="78%" stopColor="#141210" />
            <stop offset="100%" stopColor="#070605" />
          </radialGradient>
        </defs>
        <circle cx={width / 2} cy={height * 0.42} r={r} fill="url(#face)" stroke="#6a5c44" strokeWidth={r * 0.035} />
        <circle cx={width / 2} cy={height * 0.42} r={r * 0.93} fill="none" stroke="#3a3327" strokeWidth={2} />
        {Array.from({length: 60}, (_, i) => {
          const big = i % 5 === 0;
          const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
          const r1 = r * (big ? 0.78 : 0.85);
          const r2 = r * 0.9;
          return (
            <line
              key={i}
              x1={width / 2 + Math.cos(a) * r1}
              y1={height * 0.42 + Math.sin(a) * r1}
              x2={width / 2 + Math.cos(a) * r2}
              y2={height * 0.42 + Math.sin(a) * r2}
              stroke={big ? '#c9b78d' : '#5d5341'}
              strokeWidth={big ? 5 : 2}
            />
          );
        })}
        {[
          [hour, r * 0.5, 11],
          [minute, r * 0.74, 7],
        ].map(([angle, len, w], i) => (
          <line
            key={i}
            x1={width / 2}
            y1={height * 0.42}
            x2={width / 2 + Math.cos(((angle as number) - 90) * (Math.PI / 180)) * (len as number)}
            y2={height * 0.42 + Math.sin(((angle as number) - 90) * (Math.PI / 180)) * (len as number)}
            stroke="#f0e4c6"
            strokeWidth={w as number}
            strokeLinecap="round"
          />
        ))}
        <circle cx={width / 2} cy={height * 0.42} r={10} fill="#c9b78d" />
      </svg>

      <div style={{position: 'absolute', top: height * 0.74, textAlign: 'center', opacity: land}}>
        <div
          style={{
            fontFamily: FONT,
            fontSize: width * 0.185,
            fontWeight: 900,
            color: PAPER,
            letterSpacing: '-0.02em',
            transform: `scale(${0.86 + land * 0.14})`,
          }}
        >
          04:45
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: width * 0.055,
            color: '#c9b78d',
            letterSpacing: '0.4em',
            marginTop: height * 0.008,
            opacity: linear(frame, 74, 90),
          }}
        >
          1 EYLÜL 1939
        </div>
      </div>
      <AbsoluteFill style={{background: '#fff', opacity: flash * 0.5, mixBlendMode: 'screen'}} />
      {/* A fade UP from black at the head and down at the tail. The first pass
          had `1 - linear(...)` across the whole scene, which is opaque black
          for every frame but the last ten — the clock was rendering perfectly
          underneath a lid. */}
      <AbsoluteFill style={{background: '#000', opacity: 1 - linear(frame, 0, 10)}} />
      <AbsoluteFill style={{background: '#000', opacity: linear(frame, length - 8, length - 1)}} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------- MAP -- */

type MapPhase = {
  /** 0..1 — how much of the border network is drawn. */
  draw: number;
  /** 0..1 — how far the German advance has run. */
  west: number;
  /** 0..1 — how far the Soviet advance has run. */
  east: number;
  /** Countries to light up as belligerents. */
  lit: string[];
  /** The secret protocol line across Poland. */
  split: number;
  label?: string;
};

/** A point and a heading on a quadratic arc, so an arrowhead can ride it. */
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
  const px = u * u * x1 + 2 * u * t * cx + t * t * x2;
  const py = u * u * y1 + 2 * u * t * cy + t * t * y2;
  const tx = 2 * u * (cx - x1) + 2 * t * (x2 - cx);
  const ty = 2 * u * (cy - y1) + 2 * t * (y2 - cy);
  return {x: px, y: py, angle: (Math.atan2(ty, tx) * 180) / Math.PI};
};

/**
 * THE MAP — the one graphic this film cannot do without.
 *
 * Borders draw themselves rather than appearing, because a line that is being
 * drawn is a line somebody is asserting; territory fills through a clip that
 * travels, so the eye reads a DIRECTION of advance rather than a colour change;
 * and every arrow has a head that rides its own arc, because an arrow whose
 * point does not move is a shape.
 */
export const WarMap: React.FC<{phase: MapPhase; zoom?: number; focus?: [number, number]}> = ({
  phase,
  zoom = 1,
  focus = [12, 52],
}) => {
  const {width, height} = useVideoConfig();
  const frame = useCurrentFrame();
  /**
   * A MAP WITH A CAMERA ON IT.
   *
   * Scaling about the centre of the viewBox is a zoom on a picture; putting a
   * PLACE at the centre of the frame and scaling about that is a camera looking
   * at somewhere. The whole invasion passage is one slow push from a view of
   * Europe onto Warsaw, and the push is what makes the map a shot rather than
   * an illustration that happens to be animated.
   */
  const size = width * 1.34 * zoom;
  const [fx, fy] = project(focus);
  const left = width / 2 - (fx / 100) * size;
  const top = height / 2 - (fy / 100) * size;

  const thrusts = (list: Thrust[], progress: number, colour: string) =>
    list.map((thrust, i) => {
      const t = Math.max(0, Math.min(1, (progress - thrust.at) / (1 - thrust.at)));
      if (t <= 0.001) return null;
      const head = along(thrust, t);
      return (
        <g key={i}>
          <path
            d={arcOf(thrust)}
            fill="none"
            stroke={colour}
            strokeWidth={1.5}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - t}
            opacity={0.95}
            style={{filter: `drop-shadow(0 0 2px ${colour})`}}
          />
          <g transform={`translate(${head.x},${head.y}) rotate(${head.angle})`}>
            <path d="M0,0 L-3.4,1.8 L-2.4,0 L-3.4,-1.8 Z" fill={colour} />
          </g>
        </g>
      );
    });

  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', overflow: 'hidden'}}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{position: 'absolute', left, top}}
      >
        <defs>
          <clipPath id="clip-west">
            <rect x={0} y={0} width={interpolate(phase.west, [0, 1], [44, 62])} height={100} />
          </clipPath>
          <clipPath id="clip-east">
            <rect x={interpolate(phase.east, [0, 1], [62, 50])} y={0} width={50} height={100} />
          </clipPath>
          <filter id="soft">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>

        {/* THE SEA, so land reads as land. */}
        <rect x={0} y={0} width={100} height={100} fill="#16212e" />

        {COUNTRIES.map((country, index) => {
          const d = pathOf(country.points);
          // Countries come in one after another, west to east, so the continent
          // assembles instead of switching on.
          const own = Math.max(0, Math.min(1, phase.draw * COUNTRIES.length - index));
          if (own <= 0) return null;
          const isLit = phase.lit.includes(country.id);
          return (
            <g key={country.id}>
              <path d={d} fill={isLit ? 'rgba(179,39,30,0.38)' : 'rgba(168,178,160,0.22)'} opacity={own} />
              <path
                d={d}
                fill="none"
                stroke={isLit ? '#e0503f' : '#cfd8c4'}
                strokeWidth={isLit ? 0.62 : 0.42}
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - own}
                opacity={0.9}
              />
            </g>
          );
        })}

        {/* POLAND, TAKEN FROM BOTH SIDES. The fills are clipped by travelling
            rectangles: the colour arrives from the direction the armies did. */}
        {phase.west > 0 ? (
          <path d={pathOf(COUNTRIES.find((c) => c.id === 'pl')!.points)} fill="rgba(179,39,30,0.62)" clipPath="url(#clip-west)" />
        ) : null}
        {phase.east > 0 ? (
          <path d={pathOf(COUNTRIES.find((c) => c.id === 'pl')!.points)} fill="rgba(190,64,42,0.55)" clipPath="url(#clip-east)" />
        ) : null}

        {/* THE SECRET PROTOCOL — a line drawn through a country by two men who
            had never been there. Dashed, because it was not a border: it was an
            agreement about one that did not exist yet. */}
        {phase.split > 0 ? (
          <path
            d={`M${project([19.2, 55.2])[0]},${project([19.2, 55.2])[1]} L${project([22.4, 48.9])[0]},${
              project([22.4, 48.9])[1]
            }`}
            stroke="#e8b23c"
            strokeWidth={0.7}
            strokeDasharray="2 1.4"
            pathLength={1}
            strokeDashoffset={0}
            opacity={phase.split}
            style={{filter: 'drop-shadow(0 0 2px rgba(232,178,60,0.8))'}}
          />
        ) : null}

        {thrusts(GERMAN_THRUSTS, phase.west, BLOOD)}
        {thrusts(SOVIET_THRUSTS, phase.east, '#e8b23c')}

        {CITIES.map((city) => {
          const [x, y] = project(city.at);
          const on = phase.draw > 0.92;
          if (!on) return null;
          const pulse = 1 + Math.sin(frame * 0.14 + x) * 0.12;
          return (
            <g key={city.name}>
              <circle cx={x} cy={y} r={0.7 * pulse} fill={PAPER} />
              <text
                x={x + 1.4}
                y={y + 0.7}
                fill={PAPER}
                fontSize={2.05}
                fontFamily={MONO}
                letterSpacing="0.06"
                opacity={0.82}
              >
                {city.name}
              </text>
            </g>
          );
        })}
      </svg>

      {phase.label ? (
        <div
          style={{
            position: 'absolute',
            top: height * 0.115,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: MONO,
            fontSize: width * 0.048,
            letterSpacing: '0.3em',
            color: '#e8b23c',
            textShadow: '0 2px 14px rgba(0,0,0,0.9)',
          }}
        >
          {phase.label}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------- TELETYPE -- */

/**
 * THE WIRE REPORT.
 *
 * Characters land one at a time with the carriage stepping under them, and the
 * paper lifts a fraction on every strike. That last detail is the one that
 * makes it a machine rather than a text animation: a typewriter hits the page,
 * and the page moves.
 */
export const Teletype: React.FC<{lines: string[]; startAt: number; cps?: number}> = ({lines, startAt, cps = 26}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const {fps} = useVideoConfig();

  const chars = Math.max(0, Math.floor(((frame - startAt) / fps) * cps));
  let remaining = chars;
  const shown = lines.map((line) => {
    const take = Math.max(0, Math.min(line.length, remaining));
    remaining -= line.length + 3;
    return line.slice(0, take);
  });
  const strike = Math.max(0, 1 - ((frame - startAt) % (fps / cps)) / 2.2);

  return (
    <AbsoluteFill style={{backgroundColor: '#0b0a07', justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          width: width * 0.8,
          padding: `${height * 0.045}px ${width * 0.05}px`,
          background: `linear-gradient(#efe6cf, #d9cdb0)`,
          boxShadow: '0 30px 80px rgba(0,0,0,0.8)',
          transform: `translateY(${strike * -3}px) rotate(-0.5deg)`,
        }}
      >
        <div style={{fontFamily: MONO, fontSize: width * 0.032, color: '#6b5c42', letterSpacing: '0.2em', marginBottom: height * 0.02}}>
          ── ACİL ── LONDRA ── 3 EYLÜL 1939 ──
        </div>
        {shown.map((line, i) => (
          <div
            key={i}
            style={{
              fontFamily: MONO,
              fontWeight: 700,
              fontSize: width * 0.052,
              color: '#161208',
              lineHeight: 1.5,
              letterSpacing: '0.02em',
              whiteSpace: 'pre-wrap',
            }}
          >
            {line}
            {line.length && line.length < lines[i].length ? (
              <span style={{opacity: frame % 12 < 6 ? 1 : 0}}>▌</span>
            ) : null}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------ BLITZKRIEG -- */

/**
 * SPEED, WHICH IS WHAT THE WORD MEANS.
 *
 * Silhouettes in formation, receding in three ranks at three speeds, with the
 * motion drawn as streaks rather than as blur — a phone compresses blur into
 * mush and streaks survive it. The word itself is set in letters that arrive
 * from the right, one at a time, each overshooting and settling.
 */
export const Blitz: React.FC<{word: string; length: number}> = ({word, length}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();

  const plane = (x: number, y: number, s: number, o: number) => (
    <g transform={`translate(${x},${y}) scale(${s})`} opacity={o}>
      <path d="M0,0 L-26,7 L-8,9 L-4,20 L0,9 L4,20 L8,9 L26,7 Z" fill="#0b0d10" />
      <path d="M0,0 L-26,7 L-8,9 Z" fill="#161a20" />
    </g>
  );

  return (
    <AbsoluteFill style={{backgroundColor: '#6d6a58'}}>
      <AbsoluteFill style={{background: 'linear-gradient(#8e8a72 0%, #57543f 62%, #2b2a20 100%)'}} />

      {/* SPEED LINES. Horizontal, unevenly spaced, moving at three rates. */}
      <svg width={width} height={height} style={{position: 'absolute'}}>
        {Array.from({length: 44}, (_, i) => {
          const rate = 14 + (i % 3) * 16;
          const y = ((i * 61) % height) + Math.sin(i) * 6;
          const x = ((frame * rate + i * 137) % (width * 1.7)) - width * 0.5;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={width * (0.1 + ((i % 5) / 5) * 0.34)}
              height={1.6 + (i % 3)}
              fill="#1b1c16"
              opacity={0.16 + (i % 3) * 0.09}
            />
          );
        })}
      </svg>

      <svg width={width} height={height} style={{position: 'absolute'}}>
        {[
          [0.16, 0.9, 34],
          [0.34, 0.62, 22],
          [0.52, 0.4, 15],
        ].map(([yy, ss, rate], rank) =>
          Array.from({length: 5}, (_, i) => {
            const x = ((frame * (rate as number) + i * 280 + rank * 90) % (width * 1.6)) - width * 0.3;
            return (
              <React.Fragment key={`${rank}-${i}`}>
                {plane(x, height * (yy as number) + Math.sin(frame * 0.06 + i + rank) * 5, (ss as number) * 1.5, 0.35 + (ss as number) * 0.6)}
              </React.Fragment>
            );
          }),
        )}
      </svg>

      <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: height * 0.26}}>
        <div style={{display: 'flex'}}>
          {word.split('').map((letter, i) => {
            const s = spring({frame: frame - 8 - i * 2.2, fps, config: {damping: 10, mass: 0.5}, durationInFrames: 14});
            return (
              <span
                key={i}
                style={{
                  fontFamily: FONT,
                  fontWeight: 900,
                  fontSize: width * 0.128,
                  color: '#12130e',
                  letterSpacing: '-0.02em',
                  display: 'inline-block',
                  transform: `translateX(${(1 - s) * 90}px) scale(${0.8 + s * 0.2})`,
                  opacity: s,
                  textShadow: '0 6px 0 rgba(255,255,255,0.14)',
                }}
              >
                {letter}
              </span>
            );
          })}
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: width * 0.042,
            letterSpacing: '0.34em',
            color: '#1d1e16',
            marginTop: height * 0.014,
            opacity: linear(frame, 34, 50),
          }}
        >
          YILDIRIM SAVAŞI
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{background: '#000', opacity: 1 - linear(frame, 0, 6)}} />
      <AbsoluteFill style={{background: '#000', opacity: linear(frame, length - 8, length)}} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ CARD -- */

export const Card: React.FC<{kicker: string; big: string; under: string; colour?: string}> = ({
  kicker,
  big,
  under,
  colour = PAPER,
}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const land = spring({frame: frame - 4, fps, config: {damping: 13, mass: 0.7}, durationInFrames: 20});
  const rule = ease(frame, 14, 34);

  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {/* A scrim, not a background. The map underneath stays legible, which is
          the whole reason the number means anything by the time it arrives. */}
      <AbsoluteFill style={{background: 'rgba(10,8,4,0.72)'}} />
      <div style={{textAlign: 'center', fontFamily: FONT, position: 'relative'}}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: width * 0.045,
            letterSpacing: '0.38em',
            color: '#c9b78d',
            opacity: linear(frame, 2, 14),
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            height: 2,
            background: '#c9b78d',
            width: rule * width * 0.62,
            margin: `${height * 0.018}px auto`,
            opacity: 0.7,
          }}
        />
        <div
          style={{
            fontSize: width * 0.235,
            fontWeight: 900,
            color: colour,
            letterSpacing: '-0.04em',
            lineHeight: 0.9,
            transform: `scale(${0.82 + land * 0.18})`,
            opacity: land,
          }}
        >
          {big}
        </div>
        <div
          style={{
            fontSize: width * 0.052,
            fontWeight: 800,
            letterSpacing: '0.16em',
            color: '#d8cdb2',
            marginTop: height * 0.016,
            opacity: linear(frame, 26, 42),
          }}
        >
          {under}
        </div>
      </div>
    </AbsoluteFill>
  );
};
