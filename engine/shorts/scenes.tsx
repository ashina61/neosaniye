import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Aberrate, Look, PALETTE, Stars, hash01, measure, ramp, shake} from './lib';

/**
 * THE SCENE KINDS A NUMBER STORY IS MADE OF.
 *
 * Six shapes, each parametric. The first version of this reel had its subject
 * typed into the components — "42", "440.000", "12" — which made it a video
 * rather than a pipeline: a second topic meant a second set of components, and
 * a third meant a third, and by then nobody remembers which one has the caption
 * bug in it.
 *
 * So the components know a SHAPE and the brief supplies the CONTENT. This is
 * the same division v1 pays for everywhere: the engine knows roles and numbers,
 * never a story.
 *
 *   hook     the claim, hard in, no fade                      — every reel
 *   curves   two lines drawing themselves, slow against fast  — "why it feels wrong"
 *   fold     an object doubling in 3D                         — a physical premise
 *   climb    a counter and a bar, landing on the spoken figure — the build
 *   scale    the pull-back that gives a number something to stand next to
 *   stamp    the correction that sends it to the comments
 */

const SAFE_BOTTOM = 0.22;

export type SceneSpec =
  | {kind: 'hook'; pre: string; big: string; post: string; punch: string}
  | {kind: 'curves'; slow: string; fast: string}
  | {kind: 'fold'; base: number; ratio: number; steps: number}
  | {kind: 'climb'; from: number; to: number; base: number; ratio: number; marks: {at: number; label: string}[]}
  | {kind: 'scale'; big: string; unit: string}
  | {kind: 'stamp'; pre: string; big: string; post: string};

/** value(n) = base × ratio^n. Doubling paper, compounding interest, bacteria. */
export const valueAt = (spec: {base: number; ratio: number}, n: number): number => spec.base * spec.ratio ** n;

export const Display: React.FC<{
  children: React.ReactNode;
  size: number;
  colour?: string;
  weight?: number;
  tracking?: string;
}> = ({children, size, colour = PALETTE.paper, weight = 900, tracking = '-0.03em'}) => (
  <div
    style={{
      fontFamily: '"Archivo", "Helvetica Neue", Arial, sans-serif',
      fontWeight: weight,
      fontSize: size,
      color: colour,
      letterSpacing: tracking,
      lineHeight: 0.94,
      textAlign: 'center',
      textTransform: 'uppercase',
    }}
  >
    {children}
  </div>
);

/* ------------------------------------------------------------------ HOOK -- */

/** Two seconds to earn the rest. No fade: a fade spends the half second the
 *  viewer uses to decide, on nothing. */
export const Hook: React.FC<{spec: Extract<SceneSpec, {kind: 'hook'}>; length: number}> = ({spec, length}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  const land = spring({frame, fps, config: {damping: 11, mass: 0.7}, durationInFrames: 22});
  const s = shake(frame, 8, 22);
  const bloom = interpolate(frame, [8, 20], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const push = interpolate(frame, [0, length], [1.0, 1.12], {extrapolateRight: 'clamp'});
  const second = spring({frame: frame - 26, fps, config: {damping: 13}, durationInFrames: 18});

  return (
    <AbsoluteFill style={{backgroundColor: PALETTE.ink}}>
      <Stars count={110} drift={frame * 0.004} seed="hook" />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 42%, rgba(255,210,63,${0.16 + bloom * 0.5}) 0%, rgba(255,210,63,0) 58%)`,
        }}
      />
      <AbsoluteFill
        style={{justifyContent: 'center', alignItems: 'center', transform: `translate(${s.x}px, ${s.y}px) scale(${push})`}}
      >
        <Aberrate amount={bloom * 9}>
          <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', gap: height * 0.012}}>
            <div style={{opacity: interpolate(land, [0, 0.4], [0, 1]), transform: `translateY(${(1 - land) * 40}px)`}}>
              <Display size={width * 0.088} colour="rgba(244,241,232,0.62)" weight={800} tracking="0.16em">
                {spec.pre}
              </Display>
            </div>
            <div style={{transform: `scale(${0.6 + land * 0.4})`, opacity: land}}>
              <Display size={width * 0.34} colour={PALETTE.hot}>
                {spec.big}
              </Display>
            </div>
            <div style={{opacity: interpolate(land, [0.3, 0.8], [0, 1], {extrapolateRight: 'clamp'})}}>
              <Display size={width * 0.105} weight={800} tracking="0.06em">
                {spec.post}
              </Display>
            </div>
            {/* The payoff arrives a beat LATER, on its own spring: landing both
                at once makes one statement, landing the second late makes the
                first a set-up and the second a punch. */}
            <div
              style={{
                marginTop: height * 0.03,
                opacity: second,
                transform: `translateY(${(1 - second) * 26}px) scale(${0.9 + second * 0.1})`,
              }}
            >
              <Display size={width * 0.125} colour={PALETTE.cool} tracking="0.02em">
                {spec.punch}
              </Display>
            </div>
          </AbsoluteFill>
        </Aberrate>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------------- CURVES -- */

/** Shown rather than said. The straight line is drawn FIRST and gets a second
 *  to look reasonable — the point only lands if the eye believed it. */
export const Curves: React.FC<{spec: Extract<SceneSpec, {kind: 'curves'}>; length: number}> = ({spec}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  const W = width;
  const H = height * 0.52;
  const points = 60;
  const line = (fn: (t: number) => number) =>
    Array.from({length: points + 1}, (_, i) => {
      const t = i / points;
      return `${t * W * 0.86 + W * 0.07},${H - Math.min(1, fn(t)) * H * 0.86 + height * 0.06}`;
    }).join(' ');

  const slow = line((t) => t * 0.42);
  // The exponent makes the curve LEAVE the frame: a curve easing into a ceiling
  // says the opposite of what this shot is for.
  const fast = line((t) => (2 ** (t * 11) - 1) / 900);
  const drawA = ramp(frame, 4, 34);
  const drawB = ramp(frame, 24, 62);
  const LEN = 3200;

  return (
    <AbsoluteFill style={{backgroundColor: PALETTE.ink}}>
      <Stars count={50} seed="curves" opacity={0.5} />
      <AbsoluteFill style={{justifyContent: 'center'}}>
        <svg width={W} height={H + height * 0.1} style={{overflow: 'visible'}}>
          {Array.from({length: 6}, (_, i) => (
            <line
              key={i}
              x1={W * 0.07}
              x2={W * 0.93}
              y1={height * 0.06 + (H * i) / 5}
              y2={height * 0.06 + (H * i) / 5}
              stroke="rgba(244,241,232,0.09)"
              strokeWidth={2}
            />
          ))}
          <polyline
            points={slow}
            fill="none"
            stroke="rgba(244,241,232,0.5)"
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={LEN}
            strokeDashoffset={LEN * (1 - drawA)}
          />
          <polyline
            points={fast}
            fill="none"
            stroke={PALETTE.hot}
            strokeWidth={13}
            strokeLinecap="round"
            strokeDasharray={LEN}
            strokeDashoffset={LEN * (1 - drawB)}
            style={{filter: `drop-shadow(0 0 ${18 * drawB}px rgba(255,210,63,0.75))`}}
          />
        </svg>
      </AbsoluteFill>

      <AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'center', paddingTop: height * 0.07, gap: 10}}>
        <div style={{opacity: ramp(frame, 6, 18)}}>
          <Display size={width * 0.062} colour="rgba(244,241,232,0.55)" weight={800} tracking="0.2em">
            {spec.slow}
          </Display>
        </div>
        <div style={{opacity: ramp(frame, 30, 44), transform: `scale(${0.9 + ramp(frame, 30, 44) * 0.1})`}}>
          <Display size={width * 0.1} colour={PALETTE.hot} tracking="0.04em">
            {spec.fast}
          </Display>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ FOLD -- */

/** `perspective` + a `rotateX` pivoting on its own edge: the cheapest real fold
 *  there is, and it beats a drawing of one because the shading changes with the
 *  angle the way a fold's does. */
export const Fold: React.FC<{spec: Extract<SceneSpec, {kind: 'fold'}>; length: number}> = ({spec}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  const sheetW = width * 0.56;
  const sheetH = sheetW * 1.38;
  const steps = Array.from({length: spec.steps}, (_, i) =>
    spring({frame: frame - (18 + i * 22), fps, config: {damping: 14, mass: 0.6}, durationInFrames: 16}),
  );
  const stack = steps.reduce((sum, f) => sum + f, 0);
  const s = steps
    .map((_, i) => shake(frame, 18 + i * 22 + 12, 6))
    .reduce((a, b) => ({x: a.x + b.x, y: a.y + b.y}), {x: 0, y: 0});
  const shown = Math.min(spec.steps, Math.round(stack));
  const {value, unit} = measure(valueAt(spec, shown));

  return (
    <AbsoluteFill style={{backgroundColor: PALETTE.ink}}>
      <Stars count={40} seed="fold" opacity={0.35} />
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          perspective: 1400,
          transform: `translate(${s.x}px, ${s.y + height * 0.04}px) scale(${1 + stack * 0.04})`,
        }}
      >
        <div style={{position: 'relative', width: sheetW, height: sheetH, transformStyle: 'preserve-3d'}}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(158deg, ${PALETTE.paper} 0%, #d9d4c4 100%)`,
              boxShadow: '0 40px 90px rgba(0,0,0,0.6)',
            }}
          />
          {steps.map((f, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                height: sheetH / 2 ** (i + 1),
                transformOrigin: 'bottom center',
                transform: `rotateX(${-180 * f}deg) translateZ(${i * 2}px)`,
                background: `linear-gradient(${158 + i * 24}deg, #efeadb 0%, #c8c2b0 100%)`,
                boxShadow: `0 ${18 * f}px ${30 * f}px rgba(0,0,0,${0.5 * f})`,
                backfaceVisibility: 'hidden',
              }}
            />
          ))}
        </div>
      </AbsoluteFill>

      {/* AT THE TOP: the bottom 22% belongs to the caption, and a hero number
          sharing that band with burnt-in words is two things asking to be read
          at the same time. */}
      <AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'center', paddingTop: height * 0.09}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: width * 0.026}}>
          <Display size={width * 0.075} colour="rgba(244,241,232,0.5)" weight={800} tracking="0.14em">
            {shown} kat
          </Display>
          <Display size={width * 0.15} colour={PALETTE.hot}>
            {value}
          </Display>
          <Display size={width * 0.07} colour={PALETTE.hot} weight={800}>
            {unit}
          </Display>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ----------------------------------------------------------------- CLIMB -- */

/**
 * A counter that ARRIVES says the answer. A counter that CLIMBS makes the size
 * felt, and the feeling is the content.
 *
 * It finishes at 70% of the scene and HOLDS: the last third of every line is
 * spoken over the figure it names. Climbing across the whole scene put 18 folds
 * on screen while the voice said "on katlamada", and on a video whose subject
 * is arithmetic that is the one mistake that costs something.
 */
export const Climb: React.FC<{spec: Extract<SceneSpec, {kind: 'climb'}>; length: number}> = ({spec, length}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  const t = interpolate(frame, [6, length * 0.7], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const steps = spec.from + (spec.to - spec.from) * t;
  const shown = Math.round(steps);
  // The label names a whole number, so the figure has to be that number's.
  const {value, unit} = measure(valueAt(spec, shown));
  const barH = (steps / 42) * height * 0.46 * 0.78;

  // Passed is passed: a chip drawn only while the counter reads exactly that
  // number lives two frames near the end of an eased climb.
  const passed = spec.marks.filter((m) => shown >= m.at);
  const hit = passed.length ? passed[passed.length - 1] : null;
  const hitAt = hit ? interpolate(hit.at, [spec.from, spec.to], [6, length * 0.7], {extrapolateLeft: 'clamp'}) : 0;
  const hitSpring = spring({frame: frame - hitAt, fps, config: {damping: 12}, durationInFrames: 14});

  return (
    <AbsoluteFill style={{backgroundColor: PALETTE.ink}}>
      <Stars count={60} drift={t * 2.4} seed="climb" opacity={0.4 + t * 0.6} />
      <AbsoluteFill
        style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: height * (SAFE_BOTTOM + 0.09)}}
      >
        <div
          style={{
            width: width * 0.2,
            height: barH,
            borderRadius: width * 0.02,
            background: `linear-gradient(to top, ${PALETTE.hot} 0%, #ff8a3d 100%)`,
            boxShadow: `0 0 ${40 + t * 90}px rgba(255,140,60,${0.35 + t * 0.5})`,
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'center', paddingTop: height * 0.14, gap: 6}}>
        <Display size={width * 0.058} colour="rgba(244,241,232,0.5)" weight={800} tracking="0.22em">
          {shown} kat
        </Display>
        {/* Tabular figures, so the digits do not jitter sideways as they
            change — the difference between a counter and a mess. */}
        <div style={{display: 'flex', alignItems: 'baseline', gap: width * 0.022, fontVariantNumeric: 'tabular-nums'}}>
          <Display size={width * 0.185} colour={PALETTE.paper}>
            {value}
          </Display>
          <Display size={width * 0.08} colour={PALETTE.hot} weight={800}>
            {unit}
          </Display>
        </div>
        {hit ? (
          <div style={{marginTop: height * 0.012, opacity: hitSpring, transform: `scale(${0.8 + hitSpring * 0.2})`}}>
            <div style={{padding: `${height * 0.008}px ${width * 0.04}px`, borderRadius: 999, background: PALETTE.cool}}>
              <Display size={width * 0.052} colour={PALETTE.ink} weight={900} tracking="0.06em">
                {hit.label}
              </Display>
            </div>
          </div>
        ) : null}
      </AbsoluteFill>
      <Look grain={0.22} vignette={0.5} />
    </AbsoluteFill>
  );
};

/* ----------------------------------------------------------------- SCALE -- */

/** The pull-back. A number is not a distance until there is something at BOTH
 *  ends of it, so the Earth stays in shot: it is the other end. */
export const Scale: React.FC<{spec: Extract<SceneSpec, {kind: 'scale'}>; length: number}> = ({spec, length}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  const out = interpolate(frame, [0, length * 0.7], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const arc = ramp(frame, 14, length * 0.8);
  const moonIn = spring({frame: frame - 10, fps: 30, config: {damping: 15}, durationInFrames: 26});
  const earthR = width * (2.2 - out * 1.1);
  const earthY = height * 0.72 + earthR;

  return (
    <AbsoluteFill style={{backgroundColor: '#03050b'}}>
      <Stars count={140} drift={out * 3} seed="scale" />
      <svg width={width} height={height} style={{position: 'absolute'}}>
        <defs>
          <radialGradient id="earth" cx="50%" cy="18%">
            <stop offset="0%" stopColor="#2f6fb5" />
            <stop offset="70%" stopColor="#123a68" />
            <stop offset="100%" stopColor="#05101f" />
          </radialGradient>
          <radialGradient id="moon" cx="38%" cy="32%">
            <stop offset="0%" stopColor="#fbf7ea" />
            <stop offset="72%" stopColor="#cfc7b4" />
            <stop offset="100%" stopColor="#6d6759" />
          </radialGradient>
        </defs>
        <circle cx={width / 2} cy={earthY} r={earthR} fill="url(#earth)" />
        <circle cx={width / 2} cy={earthY} r={earthR} fill="none" stroke="rgba(120,190,255,0.5)" strokeWidth={4} />
        {/* A dashed line that APPEARS is a graphic; one that draws is a
            measurement being taken. */}
        <line
          x1={width / 2}
          y1={earthY - earthR}
          x2={width / 2}
          y2={earthY - earthR - (earthY - earthR - height * 0.26) * arc}
          stroke={PALETTE.hot}
          strokeWidth={5}
          strokeDasharray="16 14"
          opacity={0.9}
        />
        <g transform={`translate(${width / 2}, ${height * 0.185}) scale(${0.4 + moonIn * 0.6})`} opacity={moonIn}>
          <circle r={width * 0.225} fill="url(#moon)" />
          {Array.from({length: 12}, (_, i) => (
            <circle
              key={i}
              cx={(hash01('crater', i) - 0.5) * width * 0.26}
              cy={(hash01('crater', i + 40) - 0.5) * width * 0.26}
              r={width * (0.012 + hash01('crater', i + 80) * 0.026)}
              fill="rgba(90,84,72,0.42)"
            />
          ))}
        </g>
      </svg>

      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', paddingTop: height * 0.14}}>
        <div style={{opacity: ramp(frame, 26, 44), transform: `scale(${0.88 + ramp(frame, 26, 44) * 0.12})`}}>
          <Display size={width * 0.155} colour={PALETTE.hot}>
            {spec.big}
          </Display>
          <div style={{height: 8}} />
          <Display size={width * 0.06} colour={PALETTE.paper} weight={800} tracking="0.28em">
            {spec.unit}
          </Display>
        </div>
      </AbsoluteFill>
      <Look grain={0.24} vignette={0.6} />
    </AbsoluteFill>
  );
};

/* ----------------------------------------------------------------- STAMP -- */

/** A short that ends on its own payoff is finished; one that ends on a
 *  correction is an argument, and an argument is a reply. */
export const Stamp: React.FC<{spec: Extract<SceneSpec, {kind: 'stamp'}>; length: number}> = ({spec, length}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  const pre = spring({frame, fps, config: {damping: 12, mass: 0.6}, durationInFrames: 14});
  const stampIn = spring({frame: frame - 22, fps, config: {damping: 9, mass: 0.8}, durationInFrames: 18});
  const s = shake(frame, 24, 18);
  const fade = interpolate(frame, [length - 14, length], [1, 0], {extrapolateLeft: 'clamp'});

  return (
    <AbsoluteFill style={{backgroundColor: '#000', opacity: fade}}>
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          gap: height * 0.02,
          transform: `translate(${s.x}px, ${s.y}px)`,
        }}
      >
        <div style={{opacity: pre, transform: `translateY(${(1 - pre) * 30}px)`}}>
          <Display size={width * 0.09} colour="rgba(244,241,232,0.6)" weight={800} tracking="0.2em">
            {spec.pre}
          </Display>
        </div>
        <div
          style={{
            marginTop: height * 0.02,
            opacity: stampIn,
            transform: `scale(${1.7 - stampIn * 0.7}) rotate(${-7 + stampIn * 4}deg)`,
          }}
        >
          <div
            style={{
              border: `${width * 0.014}px solid ${PALETTE.danger}`,
              borderRadius: width * 0.03,
              padding: `${height * 0.016}px ${width * 0.06}px`,
            }}
          >
            <Display size={width * 0.2} colour={PALETTE.danger}>
              {spec.big}
            </Display>
          </div>
        </div>
        <div style={{marginTop: height * 0.018, opacity: ramp(frame, 40, 54)}}>
          <Display size={width * 0.058} colour="rgba(244,241,232,0.55)" weight={800} tracking="0.18em">
            {spec.post}
          </Display>
        </div>
      </AbsoluteFill>
      <Look grain={0.3} vignette={0.7} />
    </AbsoluteFill>
  );
};

/**
 * THE REGISTRY. A spec whose kind is not here is drawn as a loud red card, not
 * skipped — v1's law thirteen, for v1's reason: a silently dropped scene turns
 * a thirty-second reel into a twenty-six-second one and nobody notices until
 * the audio no longer lines up.
 */
export const Missing: React.FC<{kind: string}> = ({kind}) => (
  <AbsoluteFill
    style={{
      backgroundColor: '#3a0d0d',
      color: '#ffd9d9',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'monospace',
      fontSize: 40,
      textAlign: 'center',
      padding: 80,
    }}
  >
    UNKNOWN SCENE KIND
    <br />
    <strong>{kind}</strong>
  </AbsoluteFill>
);

export const renderScene = (spec: SceneSpec, length: number): React.ReactNode => {
  switch (spec.kind) {
    case 'hook':
      return <Hook spec={spec} length={length} />;
    case 'curves':
      return <Curves spec={spec} length={length} />;
    case 'fold':
      return <Fold spec={spec} length={length} />;
    case 'climb':
      return <Climb spec={spec} length={length} />;
    case 'scale':
      return <Scale spec={spec} length={length} />;
    case 'stamp':
      return <Stamp spec={spec} length={length} />;
    default:
      return <Missing kind={(spec as {kind: string}).kind} />;
  }
};
