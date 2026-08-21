import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

/**
 * 1939 NITRATE — the treatment, not a filter.
 *
 * The difference between a drawing and archive footage is not sepia. It is a
 * dozen small failures happening at once, none of which a "vintage filter" ever
 * models: the exposure breathes because the shutter is hand-cranked, the frame
 * wanders because the sprocket holes are worn, the emulsion is scratched
 * lengthwise by the projector gate, dust burns in for a single frame, and every
 * bright edge blooms into the grain because the stock could not hold a
 * highlight.
 *
 * All of it is drawn. Nothing here loads a texture, which matters for the same
 * reason it matters everywhere else in this repo: a render that depends on a
 * file fails for a reason that has nothing to do with the film.
 *
 * The one rule this whole file follows: EVERY DEFECT IS ON ITS OWN CLOCK. Tie
 * the flicker, the weave and the scratches to one number and the eye reads a
 * pulsing overlay; give each its own period and it reads as a mechanism that is
 * merely old.
 */

const hash = (n: number): number => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.86' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/**
 * THE GATE. Everything inside it weaves and breathes; everything outside it —
 * the sprocket edge, the scratches, the dust — belongs to the projector and
 * stays put. Keeping those two apart is the whole illusion: if the dust weaves
 * with the picture it is painted ON the picture, and the frame stops being film
 * and becomes a photograph of film.
 */
export const Gate: React.FC<React.PropsWithChildren<{intensity?: number}>> = ({children, intensity = 1}) => {
  const frame = useCurrentFrame();

  // Hand-cranked exposure: a slow wander plus an occasional dropped frame.
  const breathe = 1 + Math.sin(frame * 0.19) * 0.035 + Math.sin(frame * 0.71) * 0.018;
  const stutter = hash(Math.floor(frame / 2)) > 0.975 ? 0.82 : 1;

  // Worn sprockets: a jitter that is mostly vertical, because that is the axis
  // the film is pulled along.
  const wx = (hash(frame * 3 + 1) - 0.5) * 3.4 * intensity;
  const wy = (hash(frame * 3 + 2) - 0.5) * 6.2 * intensity;

  return (
    <AbsoluteFill
      style={{
        transform: `translate(${wx}px, ${wy}px) scale(1.022)`,
        filter: `brightness(${(breathe * stutter).toFixed(3)})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Vertical scratches: a few long-lived ones and a lot of one-frame ones. */
const Scratches: React.FC<{intensity: number}> = ({intensity}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const era = Math.floor(frame / 34);

  return (
    <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'screen', opacity: 0.5 * intensity}}>
      <svg width={width} height={height}>
        {Array.from({length: 4}, (_, i) => {
          const x = hash(era * 7 + i) * width;
          const drift = Math.sin(frame * 0.08 + i) * 4;
          return (
            <rect
              key={`long-${i}`}
              x={x + drift}
              y={0}
              width={0.8 + hash(era * 11 + i) * 1.6}
              height={height}
              fill="#fff"
              opacity={0.05 + hash(era * 13 + i) * 0.09}
            />
          );
        })}
        {Array.from({length: 3}, (_, i) => {
          if (hash(frame * 17 + i) > 0.42) return null;
          const x = hash(frame * 19 + i) * width;
          const y = hash(frame * 23 + i) * height * 0.7;
          return (
            <rect
              key={`flash-${i}`}
              x={x}
              y={y}
              width={0.9}
              height={height * (0.1 + hash(frame * 29 + i) * 0.4)}
              fill="#fff"
              opacity={0.14}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

/** Dust and hairs: black, because they sit ON the emulsion and block light. */
const Dust: React.FC<{intensity: number}> = ({intensity}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: 0.7 * intensity}}>
      <svg width={width} height={height}>
        {Array.from({length: 9}, (_, i) => {
          const seed = frame * 31 + i * 97;
          if (hash(seed) > 0.55) return null;
          const x = hash(seed + 1) * width;
          const y = hash(seed + 2) * height;
          const long = hash(seed + 3) > 0.72;
          return long ? (
            <path
              key={i}
              d={`M${x},${y} q${(hash(seed + 4) - 0.5) * 26},${hash(seed + 5) * 18} ${(hash(seed + 6) - 0.5) * 40},${
                hash(seed + 7) * 30
              }`}
              stroke="#0a0806"
              strokeWidth={1.4}
              fill="none"
              opacity={0.6}
            />
          ) : (
            <circle key={i} cx={x} cy={y} r={0.8 + hash(seed + 8) * 2.2} fill="#0a0806" opacity={0.55} />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

/**
 * THE SPROCKET EDGE.
 *
 * The single cheapest thing in this file and the one that does most: two
 * columns of perforations running down the sides say "this is a strip of film"
 * before the viewer has read anything else. They scroll, because the film is
 * moving through the gate — a still sprocket edge is a border.
 */
const Sprockets: React.FC<{intensity: number}> = ({intensity}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const pitch = height * 0.085;
  const offset = (frame * 1.4) % pitch;
  const inset = width * 0.016;
  const w = width * 0.026;

  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: 0.85 * intensity}}>
      <svg width={width} height={height}>
        {[inset, width - inset - w].map((x, side) => (
          <g key={side}>
            <rect x={side ? x - width * 0.012 : x - width * 0.012} y={0} width={w + width * 0.024} height={height} fill="#070603" opacity={0.82} />
            {Array.from({length: Math.ceil(height / pitch) + 2}, (_, i) => (
              <rect
                key={i}
                x={x}
                y={i * pitch - offset}
                width={w}
                height={pitch * 0.46}
                rx={w * 0.16}
                fill="#1b1610"
                stroke="#000"
                strokeWidth={1}
              />
            ))}
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};

/**
 * THE WHOLE STACK, in the order light actually meets it.
 *
 * halation → grain → scratches → dust → sprockets → vignette → grade
 *
 * Halation first because it happens in the emulsion, under everything else: a
 * bright edge scatters sideways inside the film base and comes back as a soft
 * glow that the grain then sits on top of. Put it last and it glows over the
 * dirt, which is the giveaway that the "film look" was applied to a finished
 * digital picture.
 */
export const Nitrate: React.FC<{intensity?: number; warmth?: number}> = ({intensity = 1, warmth = 1}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const gx = ((frame * 37) % 97) - 48;
  const gy = ((frame * 53) % 89) - 44;

  return (
    <>
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          inset: -80,
          opacity: 0.34 * intensity,
          mixBlendMode: 'overlay',
          backgroundImage: GRAIN,
          backgroundSize: '200px 200px',
          transform: `translate(${gx}px, ${gy}px)`,
        }}
      />
      <Scratches intensity={intensity} />
      <Dust intensity={intensity} />
      <Sprockets intensity={intensity} />
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 78% 66% at 50% 46%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 44%, rgba(0,0,0,${
            0.46 * intensity
          }) 100%)`,
        }}
      />
      {/* THE GRADE, LAST AND OVER EVERYTHING — including the dirt. Nitrate
          stock did not separate the picture from the scratches, and neither
          should this: one pass of silver and warmth across the lot. */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `linear-gradient(rgba(120,92,54,${0.13 * warmth}), rgba(60,52,40,${0.15 * warmth}))`,
          mixBlendMode: 'overlay',
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          backdropFilter: `sepia(${0.3 * warmth}) saturate(${1 - 0.22 * warmth}) contrast(1.1) brightness(1.06)`,
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: '#000',
          opacity: interpolate(frame % 210, [0, 2, 4], [0, 0.16, 0], {extrapolateRight: 'clamp'}) * intensity,
        }}
      />
      <div style={{position: 'absolute', inset: 0, boxShadow: `inset 0 0 ${width * 0.16}px rgba(0,0,0,0.4)`}} />
    </>
  );
};
