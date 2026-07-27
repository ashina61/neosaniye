import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {FilmTreatment} from '../engine/FilmTreatment';
import {boil, posterizeFrame, springEntrance} from '../engine/motion';

export const palette = {
  ink: '#171511',
  paper: '#efe6d3',
  paperLight: '#f8f1e4',
  paperDark: '#d7c6a9',
  gold: '#d5a52d',
  goldDark: '#9b6d11',
  teal: '#9fc8c6',
  tealDark: '#4b7778',
  red: '#bc493f',
  navy: '#172433',
  white: '#fffdf7',
};

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

export const CollageFrame: React.FC<React.PropsWithChildren<{dark?: boolean}>> = ({
  children,
  dark = false,
}) => (
  <FilmTreatment
    grade={{
      saturation: dark ? 0.78 : 0.92,
      contrast: dark ? 1.13 : 1.06,
      sepia: dark ? 0.06 : 0.1,
      brightness: dark ? 0.82 : 1,
    }}
    scanLines={false}
    vignette
    grain
    grunge
    gateWeave
  >
    <AbsoluteFill
      style={{
        backgroundColor: dark ? palette.navy : palette.paper,
        color: dark ? palette.white : palette.ink,
        overflow: 'hidden',
        fontFamily: 'Georgia, Times New Roman, serif',
      }}
    >
      <PaperTexture dark={dark} />
      {children}
    </AbsoluteFill>
  </FilmTreatment>
);

const PaperTexture: React.FC<{dark: boolean}> = ({dark}) => (
  <AbsoluteFill style={{pointerEvents: 'none'}}>
    <AbsoluteFill
      style={{
        opacity: dark ? 0.07 : 0.16,
        backgroundImage:
          'repeating-linear-gradient(5deg, transparent 0 11px, rgba(76,52,25,0.18) 12px, transparent 13px 31px), repeating-linear-gradient(93deg, transparent 0 29px, rgba(255,255,255,0.3) 30px, transparent 31px 57px)',
      }}
    />
    <AbsoluteFill
      style={{
        opacity: dark ? 0.08 : 0.15,
        background:
          'radial-gradient(circle at 18% 16%, rgba(255,255,255,0.55) 0 1px, transparent 2px), radial-gradient(circle at 74% 61%, rgba(72,48,20,0.24) 0 1px, transparent 2px)',
        backgroundSize: '31px 37px, 43px 39px',
      }}
    />
  </AbsoluteFill>
);

export const TornPaper: React.FC<
  React.PropsWithChildren<{
    style?: React.CSSProperties;
    fill?: string;
    rotate?: number;
    shadow?: boolean;
  }>
> = ({children, style, fill = palette.paperLight, rotate = 0, shadow = true}) => (
  <div
    style={{
      position: 'absolute',
      background: fill,
      clipPath:
        'polygon(1% 4%, 8% 1%, 16% 4%, 25% 1%, 36% 3%, 47% 0%, 58% 4%, 69% 1%, 80% 4%, 90% 1%, 99% 5%, 97% 17%, 100% 30%, 97% 44%, 100% 57%, 97% 72%, 100% 87%, 96% 98%, 84% 96%, 73% 100%, 61% 97%, 49% 100%, 37% 97%, 25% 100%, 14% 96%, 2% 99%, 4% 83%, 1% 68%, 4% 52%, 1% 35%, 4% 19%)',
      transform: `rotate(${rotate}deg)`,
      boxShadow: shadow ? '0 18px 28px rgba(33,25,16,0.22)' : undefined,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Tape: React.FC<{style?: React.CSSProperties; rotate?: number}> = ({
  style,
  rotate = -4,
}) => (
  <div
    style={{
      position: 'absolute',
      width: 190,
      height: 52,
      background: 'rgba(218,182,89,0.55)',
      border: '1px solid rgba(111,84,27,0.18)',
      boxShadow: 'inset 0 0 16px rgba(255,255,255,0.22)',
      transform: `rotate(${rotate}deg)`,
      clipPath: 'polygon(2% 7%, 98% 0, 96% 94%, 3% 100%)',
      ...style,
    }}
  />
);

export const StickerText: React.FC<{
  text: string;
  top?: number;
  left?: number;
  width?: number;
  fontSize?: number;
  rotate?: number;
  fill?: string;
  color?: string;
  delay?: number;
  align?: 'left' | 'center' | 'right';
}> = ({
  text,
  top = 100,
  left = 80,
  width = 920,
  fontSize = 86,
  rotate = -1,
  fill = palette.gold,
  color = palette.ink,
  delay = 0,
  align = 'center',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entrance = springEntrance(frame, fps, delay, {damping: 14, stiffness: 130, mass: 0.75});
  const y = interpolate(entrance, [0, 1], [-70, 0], clamp);
  const opacity = interpolate(entrance, [0, 0.2, 1], [0, 1, 1], clamp);

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left,
        width,
        padding: '14px 28px 18px',
        textAlign: align,
        background: fill,
        color,
        fontFamily: 'Arial Black, Impact, sans-serif',
        fontSize,
        fontWeight: 900,
        lineHeight: 0.98,
        letterSpacing: -2,
        textTransform: 'uppercase',
        clipPath: 'polygon(2% 10%, 98% 2%, 100% 88%, 4% 100%)',
        boxShadow: '0 14px 0 rgba(35,29,20,0.13)',
        transform: `translateY(${y}px) rotate(${rotate}deg) scale(${0.84 + entrance * 0.16})`,
        opacity,
      }}
    >
      {text}
    </div>
  );
};

export const Sparkles: React.FC<{dark?: boolean; count?: number}> = ({
  dark = false,
  count = 16,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeFrame(frame, fps, 12);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {Array.from({length: count}).map((_, index) => {
        const x = (index * 191 + 73) % 1000;
        const y = (index * 307 + 127) % 1700;
        const pulse = 0.6 + 0.4 * Math.sin(stepped * 0.09 + index * 1.7);
        const size = 12 + ((index * 7) % 24);
        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              opacity: pulse,
              transform: `rotate(${45 + index * 17}deg) scale(${pulse})`,
              background: index % 3 === 0 ? palette.gold : dark ? palette.white : palette.goldDark,
              clipPath: 'polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%)',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const Moon: React.FC<{
  size?: number;
  style?: React.CSSProperties;
  progress?: number;
  dark?: boolean;
}> = ({size = 520, style, progress = 1, dark = false}) => {
  const frame = useCurrentFrame();
  const wobble = boil(frame, 1.8, 0.16);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 500 500"
      style={{
        position: 'absolute',
        overflow: 'visible',
        filter: 'drop-shadow(18px 22px 0 rgba(28,22,15,0.22))',
        transform: `translate(${wobble.x}px, ${wobble.y}px) rotate(${wobble.rotate}deg) scale(${0.82 + 0.18 * progress})`,
        ...style,
      }}
    >
      <circle cx="250" cy="250" r="214" fill={dark ? '#d6d4c8' : '#d9d4c2'} stroke={palette.ink} strokeWidth="14" />
      <circle cx="169" cy="151" r="43" fill="#aaa796" opacity="0.55" />
      <circle cx="328" cy="132" r="29" fill="#a29f90" opacity="0.52" />
      <circle cx="347" cy="284" r="54" fill="#b0ad9d" opacity="0.55" />
      <circle cx="190" cy="330" r="30" fill="#9f9c8c" opacity="0.45" />
      <circle cx="116" cy="255" r="23" fill="#aaa796" opacity="0.48" />
      <path d="M80 205 C135 192 190 216 235 196 C292 170 342 192 421 171" fill="none" stroke="#8e8a7b" strokeWidth="8" opacity="0.35" />
      <path d="M108 371 C190 337 287 395 389 348" fill="none" stroke="#8f8b7d" strokeWidth="6" opacity="0.3" />
    </svg>
  );
};

export const Earth: React.FC<{size?: number; style?: React.CSSProperties}> = ({
  size = 320,
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 400 400"
    style={{
      position: 'absolute',
      overflow: 'visible',
      filter: 'drop-shadow(14px 18px 0 rgba(22,28,24,0.2))',
      ...style,
    }}
  >
    <circle cx="200" cy="200" r="165" fill={palette.teal} stroke={palette.ink} strokeWidth="13" />
    <path d="M92 148 C119 112 162 103 187 126 C215 151 211 178 184 194 C145 217 117 189 92 148 Z" fill="#d6b45c" stroke={palette.ink} strokeWidth="8" />
    <path d="M230 83 C267 87 318 116 327 159 C304 178 283 178 264 163 C242 146 240 120 230 83 Z" fill="#d6b45c" stroke={palette.ink} strokeWidth="8" />
    <path d="M227 232 C270 211 310 227 328 259 C307 303 269 328 225 342 C207 306 198 264 227 232 Z" fill="#d6b45c" stroke={palette.ink} strokeWidth="8" />
  </svg>
);

export const Rocket: React.FC<{
  size?: number;
  style?: React.CSSProperties;
  flame?: number;
  rotate?: number;
}> = ({size = 280, style, flame = 1, rotate = -18}) => {
  const frame = useCurrentFrame();
  const wobble = boil(frame, 1.4, 0.27);
  return (
    <svg
      width={size}
      height={size * 1.7}
      viewBox="0 0 260 440"
      style={{
        position: 'absolute',
        overflow: 'visible',
        filter: 'drop-shadow(15px 17px 0 rgba(28,22,15,0.24))',
        transform: `translate(${wobble.x}px, ${wobble.y}px) rotate(${rotate + wobble.rotate}deg)`,
        ...style,
      }}
    >
      <path d="M130 18 C84 65 69 137 74 255 L186 255 C191 137 176 65 130 18 Z" fill={palette.paperLight} stroke={palette.ink} strokeWidth="12" />
      <path d="M130 18 C110 65 102 138 105 255 L155 255 C158 138 150 65 130 18 Z" fill="#d4d0c2" opacity="0.7" />
      <path d="M74 217 L31 285 L80 280 L97 251 Z" fill={palette.red} stroke={palette.ink} strokeWidth="11" />
      <path d="M186 217 L229 285 L180 280 L163 251 Z" fill={palette.red} stroke={palette.ink} strokeWidth="11" />
      <rect x="82" y="251" width="96" height="75" rx="12" fill={palette.gold} stroke={palette.ink} strokeWidth="11" />
      <circle cx="130" cy="129" r="35" fill={palette.teal} stroke={palette.ink} strokeWidth="10" />
      <path d={`M96 326 C106 ${356 + 28 * flame} 116 ${379 + 42 * flame} 130 ${414 + 10 * flame} C144 ${379 + 42 * flame} 154 ${356 + 28 * flame} 164 326 Z`} fill={palette.gold} stroke={palette.ink} strokeWidth="10" />
      <path d={`M113 326 C119 ${352 + 20 * flame} 124 ${365 + 28 * flame} 130 ${387 + 5 * flame} C136 ${365 + 28 * flame} 141 ${352 + 20 * flame} 147 326 Z`} fill={palette.red} />
    </svg>
  );
};

export const Crater: React.FC<{
  size?: number;
  style?: React.CSSProperties;
  label?: string;
  accent?: string;
}> = ({size = 250, style, label, accent = palette.gold}) => (
  <div style={{position: 'absolute', width: size, height: size, ...style}}>
    <svg width={size} height={size} viewBox="0 0 300 300" style={{filter: 'drop-shadow(10px 15px 0 rgba(28,22,15,0.18))'}}>
      <ellipse cx="150" cy="157" rx="128" ry="98" fill="#b9b4a4" stroke={palette.ink} strokeWidth="11" />
      <ellipse cx="150" cy="162" rx="82" ry="59" fill="#777467" stroke={palette.ink} strokeWidth="8" />
      <ellipse cx="150" cy="149" rx="55" ry="37" fill="#4a4841" opacity="0.7" />
      {Array.from({length: 10}).map((_, index) => {
        const angle = (index / 10) * Math.PI * 2;
        const x1 = 150 + Math.cos(angle) * 135;
        const y1 = 157 + Math.sin(angle) * 105;
        const x2 = 150 + Math.cos(angle) * 165;
        const y2 = 157 + Math.sin(angle) * 128;
        return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} stroke={accent} strokeWidth="7" strokeLinecap="round" />;
      })}
    </svg>
    {label ? (
      <div
        style={{
          position: 'absolute',
          bottom: -18,
          left: -10,
          right: -10,
          padding: '8px 12px',
          background: accent,
          border: `5px solid ${palette.ink}`,
          color: palette.ink,
          fontFamily: 'Arial Black, Impact, sans-serif',
          fontWeight: 900,
          fontSize: 42,
          textAlign: 'center',
          transform: 'rotate(-2deg)',
        }}
      >
        {label}
      </div>
    ) : null}
  </div>
);

export const RouteLine: React.FC<{
  progress: number;
  style?: React.CSSProperties;
  color?: string;
}> = ({progress, style, color = palette.red}) => (
  <svg
    viewBox="0 0 1000 700"
    style={{position: 'absolute', width: 1000, height: 700, overflow: 'visible', ...style}}
  >
    <path
      d="M110 540 C280 330 365 628 520 390 C676 147 782 387 910 150"
      fill="none"
      stroke={palette.ink}
      strokeWidth="20"
      strokeLinecap="round"
      strokeDasharray="30 34"
      opacity="0.28"
    />
    <path
      d="M110 540 C280 330 365 628 520 390 C676 147 782 387 910 150"
      fill="none"
      stroke={color}
      strokeWidth="13"
      strokeLinecap="round"
      strokeDasharray="1600"
      strokeDashoffset={1600 * (1 - progress)}
    />
  </svg>
);

export const EvidenceString: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  progress?: number;
}> = ({x1, y1, x2, y2, progress = 1}) => (
  <svg width="1080" height="1920" viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}}>
    <line
      x1={x1}
      y1={y1}
      x2={x1 + (x2 - x1) * progress}
      y2={y1 + (y2 - y1) * progress}
      stroke={palette.red}
      strokeWidth="9"
      strokeLinecap="round"
    />
    <circle cx={x1} cy={y1} r="15" fill={palette.red} stroke={palette.ink} strokeWidth="5" />
    <circle cx={x2} cy={y2} r="15" fill={palette.red} stroke={palette.ink} strokeWidth="5" opacity={progress} />
  </svg>
);

export const FrameNumber: React.FC<{text: string}> = ({text}) => (
  <div
    style={{
      position: 'absolute',
      top: 54,
      right: 52,
      fontFamily: 'Courier New, monospace',
      fontWeight: 700,
      fontSize: 26,
      letterSpacing: 2,
      opacity: 0.46,
    }}
  >
    {text}
  </div>
);
