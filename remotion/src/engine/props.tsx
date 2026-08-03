import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {CLAMP} from './motion';

/**
 * CODED PROPS.
 *
 * The article buys these from an edit pack — a gold frame, newspaper front
 * pages, a lamp glow, a red foam finger. This repo cannot buy or reliably
 * generate them (four rounds of free image generators produced framed prints
 * and broken type), so every prop here is drawn: SVG and gradients, sized in
 * scene pixels, deterministic, and always available at render time.
 *
 * That is the trade this whole conversion rests on: *find* photographs, *draw*
 * graphics, and put the effort into choreography.
 */

const INK = '#16110d';
const MARIGOLD = '#ffbe2e';
const CREAM = '#f6ead0';
const RED = '#c8302a';

/** An ornate museum frame — the window the portal-zoom flies through. */
export const GoldFrame: React.FC<{width: number; height: number}> = ({width, height}) => (
  <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{display: 'block'}}>
    <defs>
      <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f3d284" />
        <stop offset="38%" stopColor="#c39329" />
        <stop offset="62%" stopColor="#8a6410" />
        <stop offset="100%" stopColor="#e6c473" />
      </linearGradient>
    </defs>
    <rect x={0} y={0} width={width} height={height} fill="none" stroke="url(#gold)" strokeWidth={44} />
    <rect x={26} y={26} width={width - 52} height={height - 52} fill="none" stroke="#6b4d0c" strokeWidth={4} opacity={0.6} />
    <rect x={46} y={46} width={width - 92} height={height - 92} fill="none" stroke="#f7e2ab" strokeWidth={3} opacity={0.7} />
  </svg>
);

/** The museum plaque under the frame — where the date lands. */
export const Plaque: React.FC<{text: string; width?: number}> = ({text, width = 420}) => (
  <div
    style={{
      width,
      background: 'linear-gradient(180deg,#c9a343,#a98a3c)',
      border: '3px solid #6b4d0c',
      borderRadius: 6,
      padding: '14px 10px',
      textAlign: 'center',
      fontFamily: '"Playfair Display", Georgia, serif',
      fontSize: 40,
      letterSpacing: '0.06em',
      color: '#2a1d05',
      boxShadow: '0 10px 22px -12px rgba(0,0,0,0.8)',
    }}
  >
    {text}
  </div>
);

/** A blood-red sunburst — the villain's backdrop. */
export const Sunburst: React.FC<{rotate?: number}> = ({rotate = 0}) => (
  <AbsoluteFill
    style={{
      background: 'radial-gradient(ellipse 120% 92% at 50% 26%, #a01218 0%, #7c0d12 55%, #58080c 100%)',
    }}
  >
    <AbsoluteFill
      style={{
        opacity: 0.22,
        transform: `rotate(${rotate}deg)`,
        background:
          'repeating-conic-gradient(from 0deg at 50% 30%, rgba(255,190,46,0.5) 0deg 4deg, rgba(0,0,0,0) 4deg 12deg)',
      }}
    />
  </AbsoluteFill>
);

/** A hand-drawn wireframe diamond that draws on around a prop. */
export const Diamond: React.FC<{size: number; progress: number; wobble?: number}> = ({size, progress, wobble = 0}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{transform: `rotate(${wobble}deg)`}}>
    <path
      d="M50 4 L96 50 L50 96 L4 50 Z"
      fill="none"
      stroke={CREAM}
      strokeWidth={2.4}
      strokeDasharray="6 5"
      pathLength={1}
      strokeDashoffset={1 - progress}
      style={{strokeDasharray: `${progress} 1`}}
    />
  </svg>
);

/**
 * A vintage newspaper front page with the promise as its headline. The text is
 * a fragment of the spoken line, so the paper says exactly what is being said.
 */
export const NewspaperCard: React.FC<{headline: string; width: number; seed?: number}> = ({
  headline,
  width,
  seed = 0,
}) => {
  const height = Math.round(width * 1.34);
  const rules = Array.from({length: 9}, (_, i) => i);
  return (
    <div
      style={{
        width,
        height,
        background: CREAM,
        border: '2px solid #cbb98f',
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
          color: '#6d5c39',
          borderBottom: `3px double ${INK}`,
          paddingBottom: 10,
        }}
      >
        THE DAILY RECORD
      </div>
      <div
        style={{
          fontFamily: '"Archivo", Helvetica, sans-serif',
          fontWeight: 900,
          fontSize: Math.max(34, Math.round(width / (headline.length > 14 ? 8.5 : 6.4))),
          lineHeight: 1.02,
          color: INK,
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
                background: '#b9a887',
                opacity: 0.55,
                width: `${72 + ((seed + i * 13) % 26)}%`,
              }}
            />
          ))}
        </div>
        <div style={{flex: 1, background: '#cbbb95', border: '1px solid #a89268'}} />
      </div>
    </div>
  );
};

/** The red foam finger that wags "no". */
export const FoamFinger: React.FC<{height: number}> = ({height}) => (
  <svg width={height * 0.52} height={height} viewBox="0 0 52 100" style={{display: 'block'}}>
    <g fill={RED} stroke="#7d1712" strokeWidth={2} strokeLinejoin="round">
      <path d="M20 6 q6 -5 12 0 l0 40 8 -6 q7 -4 9 4 l0 34 q0 16 -18 16 l-10 0 q-14 0 -14 -16 l0 -30 q0 -8 7 -6 l6 3 z" />
    </g>
    <path d="M20 60 l16 0" stroke="#7d1712" strokeWidth={2} opacity={0.6} />
  </svg>
);

/**
 * LAMP LIGHT, DRAWN.
 *
 * None of this is in the photograph. Four soft radial gradients on screen blend
 * — a white-hot core, a warm bloom, a glow at the shade mouth, an ambient
 * spill — plus a blurred funnel beam. When the lens defocuses, the core blooms
 * into a bokeh disc, because real defocused highlights grow; a gradient that
 * stays the same size through a blur reads as pasted on.
 */
export const LampLight: React.FC<{x: number; y: number; defocus?: number; sway?: number}> = ({
  x,
  y,
  defocus = 0,
  sway = 0,
}) => {
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
          background: 'radial-gradient(circle, rgba(255,236,190,0.30) 0%, rgba(255,214,140,0.12) 42%, rgba(0,0,0,0) 70%)',
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
          background: 'radial-gradient(circle, rgba(255,240,205,0.85) 0%, rgba(255,206,120,0.45) 38%, rgba(0,0,0,0) 72%)',
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
          background: 'radial-gradient(circle, rgba(255,255,248,0.98) 0%, rgba(255,236,180,0.6) 55%, rgba(0,0,0,0) 78%)',
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
          background: 'linear-gradient(180deg, rgba(255,225,160,0.42) 0%, rgba(255,214,140,0.16) 46%, rgba(0,0,0,0) 92%)',
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
  const list = [...candidates, word];
  const index = spin >= 1 ? list.length - 1 : Math.floor(spin * list.length * 3) % list.length;
  const settled = spin >= 1;
  return (
    <div
      style={{
        display: 'inline-block',
        background: INK,
        border: `4px solid ${MARIGOLD}`,
        borderRadius: 12,
        padding: '12px 30px',
        overflow: 'hidden',
        transform: settled ? 'scale(1.06)' : 'scale(1)',
        boxShadow: settled ? `0 0 44px ${MARIGOLD}` : 'none',
      }}
    >
      <span
        style={{
          fontFamily: '"Archivo", Helvetica, sans-serif',
          fontWeight: 900,
          fontSize: 92,
          color: MARIGOLD,
          letterSpacing: '-0.03em',
          textTransform: 'uppercase',
        }}
      >
        {list[index]}
      </span>
    </div>
  );
};
