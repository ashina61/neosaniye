import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {CLAMP} from './motion';
import {useLook} from './look';

/**
 * CODED PROPS.
 *
 * The article buys these from an edit pack — a gold frame, newspaper front
 * pages, a lamp glow, a red foam finger. This repo cannot buy or reliably
 * generate them (four rounds of free image generators produced framed prints
 * and broken type), so every prop here is drawn: SVG and gradients, sized in
 * scene pixels, deterministic, and always available at render time.
 *
 * ============ AND EVERY ONE OF THEM VARIES PER VIDEO ============
 *
 * A drawn prop is the easiest thing in this system to get wrong, because code
 * repeats perfectly: without the look, every video ships the identical gold
 * frame, the identical masthead, the identical red hand — and six rigs of
 * byte-identical drawings is exactly the "same scenes again" failure the
 * template line died of. So each prop reads the video's palette and its
 * variant: a frame is ornate here and brass there, the newspaper carries a
 * different masthead, the rays are a different count, the gesture is a
 * different object entirely.
 */

/** An ornate museum frame — the window the portal-zoom flies through. */
export const GoldFrame: React.FC<{width: number; height: number}> = ({width, height}) => {
  const {palette, props} = useLook();
  const style = props.frame;

  const outer = style === 'museum' ? 30 : style === 'brass' ? 22 : 44;
  const stops =
    style === 'museum'
      ? [palette.paperDark, palette.ink, palette.ink, palette.paperDark]
      : style === 'brass'
        ? [palette.accent, palette.accentDark, palette.accentDark, palette.accent]
        : [palette.paperLight, palette.accent, palette.accentDark, palette.accent];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{display: 'block'}}>
      <defs>
        <linearGradient id="frame-metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={stops[0]} />
          <stop offset="38%" stopColor={stops[1]} />
          <stop offset="62%" stopColor={stops[2]} />
          <stop offset="100%" stopColor={stops[3]} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill="none" stroke="url(#frame-metal)" strokeWidth={outer} />
      {style !== 'brass' ? (
        <rect
          x={outer * 0.6}
          y={outer * 0.6}
          width={width - outer * 1.2}
          height={height - outer * 1.2}
          fill="none"
          stroke={palette.accentDark}
          strokeWidth={4}
          opacity={0.6}
        />
      ) : null}
      {style === 'ornate' ? (
        <rect x={46} y={46} width={width - 92} height={height - 92} fill="none" stroke={palette.paperLight} strokeWidth={3} opacity={0.7} />
      ) : null}
    </svg>
  );
};

/** The museum plaque under the frame — where the date lands. */
export const Plaque: React.FC<{text: string; width?: number}> = ({text, width = 420}) => {
  const {palette} = useLook();
  return (
    <div
      style={{
        width,
        background: `linear-gradient(180deg, ${palette.accent}, ${palette.accentDark})`,
        border: `3px solid ${palette.accentDark}`,
        borderRadius: 6,
        padding: '14px 10px',
        textAlign: 'center',
        fontFamily: '"Playfair Display", Georgia, serif',
        fontSize: 40,
        letterSpacing: '0.06em',
        color: palette.ink,
        boxShadow: '0 10px 22px -12px rgba(0,0,0,0.8)',
      }}
    >
      {text}
    </div>
  );
};

/** A sunburst in the video's danger colour — the villain's backdrop. */
export const Sunburst: React.FC<{rotate?: number}> = ({rotate = 0}) => {
  const {palette, props} = useLook();
  const rays = Math.max(10, props.rayCount);
  const step = 360 / rays;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 120% 92% at 50% 26%, ${palette.danger} 0%, ${palette.ink} 78%, ${palette.ink} 100%)`,
      }}
    >
      <AbsoluteFill
        style={{
          opacity: 0.22,
          transform: `rotate(${rotate}deg)`,
          background: `repeating-conic-gradient(from 0deg at 50% 30%, ${palette.accent} 0deg ${(step / 3).toFixed(2)}deg, rgba(0,0,0,0) ${(step / 3).toFixed(2)}deg ${step.toFixed(2)}deg)`,
        }}
      />
    </AbsoluteFill>
  );
};

/** A hand-drawn wireframe diamond that draws on around a prop. */
export const Diamond: React.FC<{size: number; progress: number; wobble?: number}> = ({size, progress, wobble = 0}) => {
  const {palette} = useLook();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{transform: `rotate(${wobble}deg)`}}>
      <path
        d="M50 4 L96 50 L50 96 L4 50 Z"
        fill="none"
        stroke={palette.paperLight}
        strokeWidth={2.4}
        pathLength={1}
        style={{strokeDasharray: `${progress} 1`}}
      />
    </svg>
  );
};

/**
 * A vintage newspaper front page with the promise as its headline. The text is
 * a fragment of the spoken line, so the paper says exactly what is being said;
 * the masthead and paper tone come from the video's look.
 */
export const NewspaperCard: React.FC<{headline: string; width: number; seed?: number}> = ({
  headline,
  width,
  seed = 0,
}) => {
  const {palette, props} = useLook();
  const height = Math.round(width * 1.34);
  const rules = Array.from({length: 9}, (_, i) => i);
  return (
    <div
      style={{
        width,
        height,
        background: palette.paperLight,
        border: `2px solid ${palette.paperDark}`,
        boxShadow: '0 26px 46px -22px rgba(0,0,0,0.85)',
        padding: '26px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div
        style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 22,
          letterSpacing: '0.28em',
          textAlign: 'center',
          color: palette.accentDark,
          borderBottom: `3px double ${palette.ink}`,
          paddingBottom: 10,
        }}
      >
        {props.masthead}
      </div>
      <div
        style={{
          fontFamily: '"Archivo", Helvetica, sans-serif',
          fontWeight: 900,
          fontSize: Math.max(34, Math.round(width / (headline.length > 14 ? 8.5 : 6.4))),
          lineHeight: 1.02,
          color: palette.ink,
          textTransform: 'uppercase',
          letterSpacing: '-0.02em',
        }}
      >
        {headline}
      </div>
      <div style={{display: 'flex', gap: 12, flex: 1}}>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 9, paddingTop: 6}}>
          {rules.map((i) => (
            <div
              key={i}
              style={{
                height: 7,
                background: palette.paperDark,
                opacity: 0.55,
                width: `${72 + ((seed + i * 13) % 26)}%`,
              }}
            />
          ))}
        </div>
        <div style={{flex: 1, background: palette.paperDark, border: `1px solid ${palette.accentDark}`}} />
      </div>
    </div>
  );
};

/**
 * THE GESTURE — the finale's answer, given as an object rather than a word.
 *
 * Three drawings, one per video: a foam finger that wags "no", a flat palm that
 * refuses, a stamp that comes down. All swing about the same wrist pivot, so
 * the rig's choreography does not care which one it got.
 */
export const Gesture: React.FC<{height: number}> = ({height}) => {
  const {palette, props} = useLook();
  const width = height * 0.52;

  if (props.gesture === 'flat-palm') {
    return (
      <svg width={width} height={height} viewBox="0 0 52 100" style={{display: 'block'}}>
        <g fill={palette.danger} stroke={palette.ink} strokeWidth={2} strokeLinejoin="round">
          <path d="M14 34 q0 -8 6 -8 t6 8 l0 -12 q0 -8 6 -8 t6 8 l0 12 q0 -6 5 -6 t5 6 l0 30 q0 22 -18 22 q-16 0 -20 -14 l-6 -20 q-2 -7 5 -9 q5 -1 7 5 z" />
        </g>
      </svg>
    );
  }

  if (props.gesture === 'stamp') {
    return (
      <svg width={width} height={height} viewBox="0 0 52 100" style={{display: 'block'}}>
        <g stroke={palette.ink} strokeWidth={2} strokeLinejoin="round">
          <rect x={20} y={6} width={12} height={38} rx={5} fill={palette.paperDark} />
          <rect x={6} y={44} width={40} height={22} rx={4} fill={palette.ink} />
          <rect x={9} y={66} width={34} height={12} rx={2} fill={palette.danger} />
        </g>
      </svg>
    );
  }

  return (
    <svg width={width} height={height} viewBox="0 0 52 100" style={{display: 'block'}}>
      <g fill={palette.danger} stroke={palette.ink} strokeWidth={2} strokeLinejoin="round">
        <path d="M20 6 q6 -5 12 0 l0 40 8 -6 q7 -4 9 4 l0 34 q0 16 -18 16 l-10 0 q-14 0 -14 -16 l0 -30 q0 -8 7 -6 l6 3 z" />
      </g>
      <path d="M20 60 l16 0" stroke={palette.ink} strokeWidth={2} opacity={0.6} />
    </svg>
  );
};

/**
 * LAMP LIGHT, DRAWN.
 *
 * None of this is in the photograph. Four soft radial gradients on screen blend
 * — a white-hot core, a warm bloom, a glow at the shade mouth, an ambient
 * spill — plus a blurred funnel beam. When the lens defocuses, the core blooms
 * into a bokeh disc, because real defocused highlights grow; a gradient that
 * stays the same size through a blur reads as pasted on.
 *
 * The bloom takes its warmth from the video's accent, so a cold investigation
 * and a gilded money room are not lit by the same bulb.
 */
export const LampLight: React.FC<{x: number; y: number; defocus?: number; sway?: number}> = ({
  x,
  y,
  defocus = 0,
  sway = 0,
}) => {
  const {palette} = useLook();
  const bloom = interpolate(defocus, [0, 1], [1, 2.4], CLAMP);
  const halo = interpolate(defocus, [0, 1], [1, 1.55], CLAMP);
  return (
    <AbsoluteFill
      style={{
        mixBlendMode: 'screen',
        transformOrigin: `${x}px 0px`,
        transform: `rotate(${sway}deg)`,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: x - 700,
          top: y - 700,
          width: 1400,
          height: 1400,
          background: `radial-gradient(circle, ${palette.accent}44 0%, ${palette.accentDark}22 42%, rgba(0,0,0,0) 70%)`,
          transform: `scale(${halo})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: x - 240,
          top: y - 240,
          width: 480,
          height: 480,
          background: `radial-gradient(circle, ${palette.paperLight}d0 0%, ${palette.accent}70 38%, rgba(0,0,0,0) 72%)`,
          transform: `scale(${halo})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: x - 90,
          top: y - 90,
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${palette.white}fa 0%, ${palette.accent}99 55%, rgba(0,0,0,0) 78%)`,
          transform: `scale(${bloom})`,
          filter: `blur(${interpolate(defocus, [0, 1], [0, 14], CLAMP)}px)`,
        }}
      />
      {/* the funnel beam, edges masked off so it never shows a hard border */}
      <div
        style={{
          position: 'absolute',
          left: x - 330,
          top: y,
          width: 660,
          height: 1250,
          background: `linear-gradient(180deg, ${palette.accent}6b 0%, ${palette.accentDark}29 46%, rgba(0,0,0,0) 92%)`,
          clipPath: 'polygon(38% 0%, 62% 0%, 100% 100%, 0% 100%)',
          filter: 'blur(26px)',
        }}
      />
    </AbsoluteFill>
  );
};

/** Slot-machine reel that spins values past and slams to a stop on one word. */
export const SlotReel: React.FC<{word: string; spin: number; candidates: string[]}> = ({
  word,
  spin,
  candidates,
}) => {
  const {palette} = useLook();
  const list = [...candidates, word];
  const index = spin >= 1 ? list.length - 1 : Math.floor(spin * list.length * 3) % list.length;
  const settled = spin >= 1;
  return (
    <div
      style={{
        display: 'inline-block',
        background: palette.ink,
        border: `4px solid ${palette.accent}`,
        borderRadius: 12,
        padding: '12px 30px',
        overflow: 'hidden',
        transform: settled ? 'scale(1.06)' : 'scale(1)',
        boxShadow: settled ? `0 0 44px ${palette.accent}` : 'none',
      }}
    >
      <span
        style={{
          fontFamily: '"Archivo", Helvetica, sans-serif',
          fontWeight: 900,
          fontSize: 92,
          color: palette.accent,
          letterSpacing: '-0.03em',
          textTransform: 'uppercase',
        }}
      >
        {list[index]}
      </span>
    </div>
  );
};
