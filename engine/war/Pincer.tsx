import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

/**
 * BLITZKRIEG, SHOWN AS THE THING IT ACTUALLY IS.
 *
 * Not speed lines and a word. The word means "lightning war" and every
 * documentary translates it and stops there, which explains nothing: what made
 * September 1939 different was not that the tanks were fast, it was WHERE they
 * went. Armour did not attack the line — it went around both ends of it and
 * met behind, and the army in the middle was beaten without most of it being
 * fought.
 *
 * So this is a tactical view from above: a defending line holding across the
 * frame, two armoured columns leaving the road, sweeping wide, and closing on
 * each other behind it. The moment the ring shuts is the whole point of the
 * shot, and everything else in it is timing so that moment lands.
 */

const OLIVE = '#5c5f3a';
const RED = '#a8291d';
const BLUE = '#2f4f7a';
const DUST = 'rgba(214,201,166,0.5)';

const hash = (n: number): number => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * A TANK FROM ABOVE.
 *
 * Tracks, hull, turret ring, gun. Four parts, and the gun is the one that
 * matters: a rectangle with a circle on it is a shape, and the same thing with
 * a barrel pointing somewhere is a tank that is going in a direction.
 */
const Tank: React.FC<{x: number; y: number; angle: number; scale: number; turret?: number}> = ({
  x,
  y,
  angle,
  scale,
  turret = 0,
}) => (
  <g transform={`translate(${x},${y}) rotate(${angle}) scale(${scale})`}>
    <ellipse cx={2} cy={5} rx={16} ry={9} fill="rgba(0,0,0,0.32)" />
    {/* Tracks — drawn as a run of links, which is what reads as "tracked" at
        this size rather than a grey bar. */}
    {[-7.4, 7.4].map((side) => (
      <g key={side}>
        <rect x={-14} y={side - 2.6} width={28} height={5.2} rx={1.2} fill="#2e2f22" />
        {Array.from({length: 9}, (_, i) => (
          <rect key={i} x={-13 + i * 3} y={side - 2.6} width={1.6} height={5.2} fill="#4a4b36" />
        ))}
      </g>
    ))}
    <rect x={-11.5} y={-6.4} width={23} height={12.8} rx={1.4} fill={OLIVE} stroke="#33351f" strokeWidth={0.9} />
    <rect x={-11.5} y={-6.4} width={23} height={4.6} fill="rgba(255,255,255,0.09)" />
    <g transform={`rotate(${turret})`}>
      <circle r={6} fill="#697043" stroke="#33351f" strokeWidth={0.9} />
      <circle r={6} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={1.4} />
      <rect x={5} y={-1.1} width={15} height={2.2} rx={0.8} fill="#3b3d26" />
    </g>
  </g>
);

/** An infantry marker of the defending army: a box with a cross, as on a map. */
const Foot: React.FC<{x: number; y: number; scale: number; hit: number}> = ({x, y, scale, hit}) => (
  <g transform={`translate(${x},${y}) scale(${scale})`} opacity={1 - hit * 0.55}>
    <rect x={-11} y={-7} width={22} height={14} fill="#e6dcc3" stroke={BLUE} strokeWidth={1.8} />
    <line x1={-11} y1={-7} x2={11} y2={7} stroke={BLUE} strokeWidth={1.5} />
    <line x1={-11} y1={7} x2={11} y2={-7} stroke={BLUE} strokeWidth={1.5} />
  </g>
);

export const Pincer: React.FC<{length: number}> = ({length}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();

  /** One clock for the manoeuvre; everything reads from it. */
  const run = interpolate(frame, [14, length - 46], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });
  const closed = interpolate(run, [0.86, 1], [0, 1], {extrapolateLeft: 'clamp'});
  const shut = spring({frame: frame - (length - 46), fps, config: {damping: 10, mass: 0.6}, durationInFrames: 16});

  /**
   * THE HOOK EACH COLUMN DRIVES.
   *
   * Out along the flank, then in behind — the path is the point, so it is
   * written as a curve rather than as a straight line with a turn bolted on.
   * `side` is -1 for the northern column and +1 for the southern.
   */
  const hook = (t: number, side: number) => {
    /**
     * AND THE GEOMETRY IS THE FRAME'S, not a landscape diagram squeezed into
     * it. In a 9:16 frame the defending line runs ACROSS and the columns come
     * down from the top, sweep out to both edges, and meet below it — which is
     * the same manoeuvre and the only version of it that fits the shape of the
     * screen it will be watched on. The first pass ran everything left to
     * right and the two columns overlapped into one vertical smear.
     */
    const at = (u: number) => ({
      x: width * (0.5 + side * interpolate(u, [0, 0.3, 0.66, 1], [0.03, 0.36, 0.33, 0.045])),
      y: height * interpolate(u, [0, 0.3, 0.66, 1], [0.08, 0.34, 0.62, 0.78]),
    });
    const p = at(t);
    const q = at(Math.min(1, t + 0.02));
    return {x: p.x, y: p.y, angle: (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI};
  };

  /**
   * A TANK HAS TO BE BIG ENOUGH TO BE A TANK.
   *
   * The first pass scaled by width/900, which put a hundred-pixel vehicle at
   * forty — at that size the tracks, the turret ring and the gun are all one
   * grey smudge and the shot is a diagram of dots moving. The whole reason to
   * draw the thing rather than label it is that the viewer can see what it is.
   */
  const scale = width / 260;

  return (
    <AbsoluteFill style={{backgroundColor: '#cdc3a6'}}>
      {/* THE GROUND. A printed field, not a colour: the same paper the map is
          on, so the cut from one to the other is a change of magnification
          rather than a change of world. */}
      <AbsoluteFill
        style={{background: 'radial-gradient(ellipse at 40% 40%, #ded3b4 0%, #c3b898 62%, #a99e80 100%)'}}
      />
      <svg width={width} height={height} style={{position: 'absolute'}}>
        <defs>
          <pattern id="field" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
            <rect width="26" height="26" fill="none" />
            <path d="M0,26 L26,26" stroke="rgba(90,80,54,0.16)" strokeWidth="1" />
          </pattern>
          <pattern id="ring" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="14" height="14" fill="rgba(168,41,29,0.12)" />
            <path d="M0,0 L0,14" stroke="rgba(168,41,29,0.4)" strokeWidth="3" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#field)" />

        {/* Roads and a river, so the ground has features the columns move past
            rather than an empty plane they slide over. */}
        <path
          d={`M0,${height * 0.7} Q${width * 0.4},${height * 0.64} ${width},${height * 0.74}`}
          stroke="#8fa0a6"
          strokeWidth={9}
          fill="none"
          opacity={0.6}
        />
        <path
          d={`M${width * 0.08},${height * 0.2} L${width * 0.95},${height * 0.26}`}
          stroke="rgba(120,105,72,0.35)"
          strokeWidth={5}
          strokeDasharray="16 10"
          fill="none"
        />

        {/* THE DEFENDING LINE, straight ACROSS the middle — exactly where an
            army expects to be attacked, and exactly where it is not. */}
        {Array.from({length: 6}, (_, i) => (
          <Foot
            key={i}
            x={width * (0.16 + i * 0.136)}
            y={height * 0.42 + Math.sin(i * 1.7) * height * 0.012}
            scale={scale * 0.72}
            hit={closed}
          />
        ))}
        <path
          d={`M${width * 0.1},${height * 0.435} L${width * 0.9},${height * 0.415}`}
          stroke={BLUE}
          strokeWidth={5}
          fill="none"
          opacity={0.6}
        />

        {/* THE RING, once the two hooks have met. Hatched, because a hatched
            area on a staff map means one thing and everybody knows what. */}
        {closed > 0.01 ? (
          <g opacity={closed}>
            <ellipse
              cx={width * 0.5}
              cy={height * 0.44}
              rx={width * 0.4}
              ry={height * 0.26}
              fill="url(#ring)"
              stroke={RED}
              strokeWidth={5}
              strokeDasharray="18 12"
            />
          </g>
        ) : null}

        {/* THE TWO COLUMNS. Each tank is a step behind the one in front, so the
            column has depth — a rank of tanks moving in lockstep is a graphic,
            a column with spacing is a formation. */}
        {[-1, 1].map((side) =>
          Array.from({length: 4}, (_, i) => {
            const t = Math.max(0, run - i * 0.13);
            if (t <= 0) return null;
            const p = hook(t, side);
            return (
              <React.Fragment key={`${side}-${i}`}>
                {/* Dust, thrown behind and fading — the only thing in the shot
                    that says these are heavy and on soil. */}
                {Array.from({length: 4}, (_, k) => {
                  const back = hook(Math.max(0, t - 0.02 - k * 0.012), side);
                  return (
                    <circle
                      key={k}
                      cx={back.x - 6}
                      cy={back.y + 4}
                      r={(4 + k * 3) * scale}
                      fill={DUST}
                      opacity={0.3 - k * 0.06}
                    />
                  );
                })}
                <Tank
                  x={p.x}
                  y={p.y}
                  angle={p.angle}
                  scale={scale}
                  turret={interpolate(t, [0.5, 0.9], [0, side * -34], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
                />
              </React.Fragment>
            );
          }),
        )}

        {/* The two arrows the manoeuvre draws, faint, under the armour: the
            shape of the plan behind the thing executing it. */}
        {[-1, 1].map((side) => {
          const pts = Array.from({length: 26}, (_, i) => hook((i / 25) * run, side));
          return (
            <path
              key={side}
              d={pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
              stroke={RED}
              strokeWidth={3}
              fill="none"
              opacity={0.3}
              strokeDasharray="10 8"
            />
          );
        })}
      </svg>

      {/* THE NAME, and then what it means — over a bar, because a word alone on
          a field is a caption and a word on a plate is a title. */}
      <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: height * 0.12}}>
        <div
          style={{
            background: 'rgba(24,19,10,0.92)',
            borderLeft: `${width * 0.014}px solid ${RED}`,
            padding: `${height * 0.016}px ${width * 0.05}px`,
            transform: `scale(${0.9 + shut * 0.1})`,
            boxShadow: '0 14px 40px rgba(0,0,0,0.6)',
          }}
        >
          <div
            style={{
              fontFamily: '"Archivo", "Helvetica Neue", Arial, sans-serif',
              fontWeight: 900,
              fontSize: width * 0.098,
              color: '#f0e7d2',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            BLITZKRIEG
          </div>
          <div
            style={{
              fontFamily: '"Courier New", monospace',
              fontSize: width * 0.036,
              color: '#d8b26a',
              letterSpacing: '0.24em',
              marginTop: height * 0.006,
            }}
          >
            HATTA SALDIRMA — ARKASINA GEÇ
          </div>
        </div>
        {closed > 0.4 ? (
          <div
            style={{
              marginTop: height * 0.016,
              fontFamily: '"Archivo", "Helvetica Neue", Arial, sans-serif',
              fontWeight: 900,
              fontSize: width * 0.075,
              color: RED,
              letterSpacing: '0.06em',
              opacity: shut,
              transform: `scale(${1.25 - shut * 0.25})`,
              textShadow: '0 4px 22px rgba(0,0,0,0.8)',
            }}
          >
            KUŞATILDI
          </div>
        ) : null}
      </AbsoluteFill>

      <AbsoluteFill style={{background: '#000', opacity: 1 - interpolate(frame, [0, 8], [0, 1], {extrapolateRight: 'clamp'})}} />
      <AbsoluteFill
        style={{background: '#000', opacity: interpolate(frame, [length - 8, length], [0, 1], {extrapolateLeft: 'clamp'})}}
      />
    </AbsoluteFill>
  );
};
