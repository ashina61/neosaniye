import React from 'react';
import {AbsoluteFill} from 'remotion';
import {PALETTE} from '../design/tokens';

/** Şüpheli teknikleri tek karede yan yana koyar. Tarayıcı farkını izole etmek için. */
const OUT: Array<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7],
];
const ring = (w: number, c: string) =>
  OUT.map(([x, y]) => `drop-shadow(${(x * w).toFixed(1)}px ${(y * w).toFixed(1)}px 0 ${c})`).join(' ');

const Box: React.FC<{label: string; y: number; children: React.ReactNode}> = ({label, y, children}) => (
  <>
    <div style={{position: 'absolute', left: 40, top: y - 34, fontSize: 30, fontFamily: 'sans-serif', color: '#000'}}>
      {label}
    </div>
    <div style={{position: 'absolute', left: 40, top: y, width: 300, height: 230}}>{children}</div>
  </>
);

const Blob: React.FC = () => (
  <svg viewBox="0 0 100 140" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    <circle cx="50" cy="30" r="22" fill="#111" />
    <path d="M50 58 C28 58 20 76 18 110 L18 138 L82 138 L82 110 C80 76 72 58 50 58 Z" fill="#111" />
  </svg>
);

export const Probe: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: PALETTE.ground}}>
    <Box label="A: filtresiz SVG" y={80}><Blob /></Box>
    <Box label="B: TEK drop-shadow" y={380}>
      <div style={{width: '100%', height: '100%', filter: 'drop-shadow(0 14px 18px rgba(24,18,8,0.3))'}}><Blob /></div>
    </Box>
    <Box label="C: 9 ZINCIRLI drop-shadow" y={680}>
      <div style={{width: '100%', height: '100%', filter: `${ring(9, PALETTE.paper)} drop-shadow(0 14px 18px rgba(24,18,8,0.3))`}}>
        <Blob />
      </div>
    </Box>
    <Box label="D: clipPath polygon" y={980}>
      <div style={{width: '100%', height: '100%', background: PALETTE.sea, clipPath: 'polygon(0% 2%, 50% 0%, 100% 2%, 100% 100%, 0% 100%)'}} />
    </Box>
    <Box label="E: SVG stroke-dashoffset" y={1280}>
      <svg width={300} height={230} style={{overflow: 'visible'}}>
        <path d="M 10 200 Q 150 10 290 200" fill="none" stroke={PALETTE.accent} strokeWidth={10}
          strokeDasharray={400} strokeDashoffset={0} />
      </svg>
    </Box>
    <Box label="F: feTurbulence filtresi" y={1580}>
      <svg width={0} height={0}><filter id="pg"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={4} seed={7} /></filter></svg>
      <div style={{width: '100%', height: '100%', filter: 'url(#pg)', background: '#888'}} />
    </Box>
  </AbsoluteFill>
);
