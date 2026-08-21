import React from 'react';

/**
 * THE THINGS THE STACK GROWS PAST.
 *
 * A scale zoom lives or dies on what is in it. A bar with a number over it is a
 * chart; the same bar drawn next to a hand, then a person, then a tower, then a
 * mountain, then the curve of the Earth is a JOURNEY — and the only reason the
 * number at the top means anything is that the eye has just watched it swallow
 * eight things it already knows the size of.
 *
 * Every object is drawn to a unit box: 1 unit wide, `aspect` units tall, with
 * its FEET at y = aspect. The camera scales the box; nothing here knows what
 * frame it will end up in. Real sizes are in millimetres because the subject —
 * a sheet of paper at a tenth of a millimetre — is the smallest thing in it.
 */

export type WorldObject = {
  /** Real height in millimetres. This alone decides when it is on screen. */
  mm: number;
  label: string;
  aspect: number;
  draw: (id: string) => React.ReactNode;
};

const grad = (id: string, stops: [string, string][], vertical = true) => (
  <linearGradient id={id} x1="0" y1="0" x2={vertical ? '0' : '1'} y2={vertical ? '1' : '0'}>
    {stops.map(([offset, colour]) => (
      <stop key={offset} offset={offset} stopColor={colour} />
    ))}
  </linearGradient>
);

/**
 * A HAND. The first thing that gives the stack a scale, and the only one the
 * viewer has personally held a piece of paper in.
 */
const Hand: React.FC<{id: string}> = ({id}) => (
  <svg viewBox="0 0 100 62" width="100%" height="100%" style={{overflow: 'visible'}}>
    <defs>{grad(`${id}-s`, [['0%', '#243040'], ['100%', '#080c13']])}</defs>
    <path
      d="M2 62 L2 40 Q2 30 10 30 L30 30 L30 12 Q30 4 37 4 Q44 4 44 12 L44 30 L52 30 L52 8 Q52 0 59 0 Q66 0 66 8 L66 30 L74 30 L74 12 Q74 5 80 5 Q87 5 87 12 L87 34 Q98 36 98 48 L98 62 Z"
      fill={`url(#${id}-s)`}
    />
    <path d="M2 62 L98 62 L98 56 L2 56 Z" fill="#0a0e15" opacity="0.6" />
  </svg>
);

/** A standing figure. Drawn, not a pictogram: the silhouette has a neck, a
 *  shoulder line and a stance, which is the difference between a person and a
 *  toilet-door sign. */
const Person: React.FC<{id: string}> = ({id}) => (
  <svg viewBox="0 0 40 100" width="100%" height="100%" style={{overflow: 'visible'}}>
    <defs>{grad(`${id}-s`, [['0%', '#26313f'], ['100%', '#070b11']])}</defs>
    <path
      d="M20 2 Q26 2 26 9 Q26 15 22 17 L22 20 Q34 23 36 36 L34 58 L30 58 L30 40 L28 62 L28 96 L23 96 L21 66 L19 66 L17 96 L12 96 L12 62 L10 40 L8 58 L4 58 L2 36 Q4 23 16 20 L16 17 Q12 15 12 9 Q12 2 20 2 Z"
      fill={`url(#${id}-s)`}
    />
    <ellipse cx="20" cy="98" rx="15" ry="2.6" fill="#000" opacity="0.55" />
  </svg>
);

/** A house with the lights on. Warm windows are what make a silhouette read as
 *  INHABITED rather than as a shape. */
const House: React.FC<{id: string}> = ({id}) => (
  <svg viewBox="0 0 120 100" width="100%" height="100%" style={{overflow: 'visible'}}>
    <defs>{grad(`${id}-s`, [['0%', '#222c39'], ['100%', '#080c12']])}</defs>
    <path d="M6 44 L60 8 L114 44 L114 98 L6 98 Z" fill={`url(#${id}-s)`} />
    <path d="M60 8 L114 44 L60 44 Z" fill="#000" opacity="0.28" />
    {[
      [26, 58],
      [52, 58],
      [78, 58],
      [26, 78],
      [78, 78],
    ].map(([x, y], i) => (
      <rect key={i} x={x} y={y} width={16} height={14} rx={1.5} fill="#ffcf6e" opacity={i % 2 ? 0.85 : 0.5} />
    ))}
    <ellipse cx="60" cy="99" rx="58" ry="2.5" fill="#000" opacity="0.5" />
  </svg>
);

/** A skyline: several towers at different depths, the far ones hazier. Depth
 *  from atmosphere, not from a drop shadow. */
const Skyline: React.FC<{id: string}> = ({id}) => (
  <svg viewBox="0 0 140 100" width="100%" height="100%" style={{overflow: 'visible'}}>
    <defs>
      {grad(`${id}-near`, [['0%', '#28313f'], ['100%', '#070a10']])}
      {grad(`${id}-far`, [['0%', '#1c2330'], ['100%', '#0a0e15']])}
    </defs>
    {[
      [4, 46, 20, 0.55],
      [28, 30, 18, 0.75],
      [50, 12, 22, 1],
      [76, 34, 18, 0.8],
      [98, 22, 16, 0.9],
      [118, 50, 18, 0.5],
    ].map(([x, y, w, near], i) => (
      <g key={i} opacity={0.45 + (near as number) * 0.55}>
        <rect x={x} y={y} width={w} height={100 - (y as number)} fill={`url(#${id}-${near === 1 ? 'near' : 'far'})`} />
        {Array.from({length: Math.floor((100 - (y as number)) / 9)}, (_, r) =>
          Array.from({length: 3}, (_, c) => (
            <rect
              key={`${r}-${c}`}
              x={(x as number) + 3 + c * ((w as number) - 6) / 3}
              y={(y as number) + 5 + r * 9}
              width={((w as number) - 8) / 3}
              height={4}
              fill="#ffd58a"
              opacity={(r * 3 + c + i) % 3 === 0 ? 0.75 : 0.16}
            />
          )),
        )}
      </g>
    ))}
  </svg>
);

/** A ridge line with snow. Two layers, the back one lighter — the same
 *  atmospheric trick, which is the only thing that makes a drawn mountain look
 *  like distance rather than like a triangle. */
const Mountain: React.FC<{id: string}> = ({id}) => (
  <svg viewBox="0 0 160 100" width="100%" height="100%" style={{overflow: 'visible'}}>
    <defs>
      {grad(`${id}-b`, [['0%', '#2b3547'], ['100%', '#0d121b']])}
      {grad(`${id}-f`, [['0%', '#1a2130'], ['100%', '#070a10']])}
    </defs>
    <path d="M0 100 L38 26 L58 52 L84 4 L120 62 L142 40 L160 100 Z" fill={`url(#${id}-b)`} opacity="0.75" />
    <path d="M84 4 L96 24 L88 26 L80 20 L74 26 Z" fill="#eaf1f8" opacity="0.9" />
    <path d="M38 26 L46 38 L40 39 L34 34 Z" fill="#eaf1f8" opacity="0.7" />
    <path d="M0 100 L26 58 L52 82 L78 48 L112 88 L136 66 L160 100 Z" fill={`url(#${id}-f)`} />
  </svg>
);

/** The atmosphere seen edge on: the thin blue shell that is the whole reason
 *  100 km means anything. */
const Atmosphere: React.FC<{id: string}> = ({id}) => (
  <svg viewBox="0 0 200 100" width="100%" height="100%" style={{overflow: 'visible'}}>
    <defs>
      <linearGradient id={`${id}-air`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0a1a35" stopOpacity="0" />
        <stop offset="45%" stopColor="#2f7fd0" stopOpacity="0.55" />
        <stop offset="72%" stopColor="#8fd0ff" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#dff1ff" stopOpacity="0.95" />
      </linearGradient>
    </defs>
    <path d="M0 100 Q100 42 200 100 Z" fill={`url(#${id}-air)`} />
    <path d="M0 100 Q100 58 200 100 Z" fill="#0b1b2e" />
  </svg>
);

/** The planet, lit from one side, with a limb glow. */
const Earth: React.FC<{id: string}> = ({id}) => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" style={{overflow: 'visible'}}>
    <defs>
      <radialGradient id={`${id}-e`} cx="34%" cy="28%">
        <stop offset="0%" stopColor="#63a9e8" />
        <stop offset="52%" stopColor="#1d5c9c" />
        <stop offset="88%" stopColor="#08243f" />
        <stop offset="100%" stopColor="#03101d" />
      </radialGradient>
      <radialGradient id={`${id}-limb`} cx="50%" cy="50%">
        <stop offset="76%" stopColor="#5bc8ff" stopOpacity="0" />
        <stop offset="94%" stopColor="#5bc8ff" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#5bc8ff" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="42" fill={`url(#${id}-e)`} />
    <path d="M28 40 q10 -8 20 -3 q9 5 4 12 q-6 8 -18 5 q-10 -4 -6 -14 Z" fill="#2f6a48" opacity="0.55" />
    <path d="M58 58 q9 -5 15 1 q5 6 -3 11 q-10 5 -15 -3 q-3 -6 3 -9 Z" fill="#2f6a48" opacity="0.45" />
    <circle cx="50" cy="50" r="49" fill={`url(#${id}-limb)`} />
  </svg>
);

/** The Moon: the arrival. Craters placed by hash, so it is the same Moon every
 *  build. */
const Moon: React.FC<{id: string}> = ({id}) => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" style={{overflow: 'visible'}}>
    <defs>
      <radialGradient id={`${id}-m`} cx="36%" cy="30%">
        <stop offset="0%" stopColor="#fdfaf0" />
        <stop offset="62%" stopColor="#d7cfbc" />
        <stop offset="100%" stopColor="#6a6457" />
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="42" fill={`url(#${id}-m)`} />
    {[
      [40, 36, 7],
      [58, 30, 4.5],
      [63, 55, 8],
      [36, 62, 5.5],
      [50, 47, 3],
      [70, 42, 3.4],
      [30, 47, 3.8],
      [52, 70, 4.4],
    ].map(([cx, cy, r], i) => (
      <g key={i}>
        <circle cx={cx} cy={cy} r={r} fill="#8e8878" opacity="0.42" />
        <circle cx={(cx as number) - (r as number) * 0.2} cy={(cy as number) - (r as number) * 0.2} r={(r as number) * 0.8} fill="#c7bfad" opacity="0.4" />
      </g>
    ))}
  </svg>
);

/**
 * THE LADDER, in the order the stack meets it.
 *
 * The gaps matter as much as the entries: each object is on screen for about
 * six doublings, so two things within a doubling of each other are one beat
 * with a stutter in the middle rather than two beats.
 */
export const WORLD: WorldObject[] = [
  {mm: 180, label: 'bir el', aspect: 0.62, draw: (id) => <Hand id={id} />},
  {mm: 1_750, label: 'bir insan', aspect: 2.5, draw: (id) => <Person id={id} />},
  {mm: 8_000, label: 'bir ev', aspect: 0.83, draw: (id) => <House id={id} />},
  {mm: 300_000, label: 'gökdelen', aspect: 0.71, draw: (id) => <Skyline id={id} />},
  {mm: 8_848_000, label: 'everest', aspect: 0.62, draw: (id) => <Mountain id={id} />},
  {mm: 100_000_000, label: 'uzay sınırı', aspect: 0.5, draw: (id) => <Atmosphere id={id} />},
  {mm: 12_742_000_000, label: 'dünya', aspect: 1, draw: (id) => <Earth id={id} />},
];

/**
 * THE MOON IS NOT ON THE LADDER, AND THAT IS THE POINT.
 *
 * Everything above stands on the ground and gets overtaken. The Moon does not:
 * it is 384,400 km AWAY, and the payoff of the whole piece is the column of
 * paper arriving at it. So it is drawn at that ALTITUDE rather than at that
 * size — a small disc at the top of the stack, which the stack reaches at fold
 * forty-two and not one fold earlier.
 */
export const MOON = {altitude: 384_400_000_000, diameter: 3_474_000_000, draw: (id: string) => <Moon id={id} />};
