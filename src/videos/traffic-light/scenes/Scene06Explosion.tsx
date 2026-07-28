import React from 'react';
import {interpolate} from 'remotion';
import {clamp} from '../../../core/motion';
import {SceneBase, Label} from './shared';
import {palette} from '../story';

export const Scene06Explosion: React.FC<{frame: number; duration: number}> = ({frame, duration}) => {
  const blast = interpolate(frame, [0, Math.min(18, duration * .35)], [0, 1], clamp);
  const shake = Math.sin(frame * 2.7) * (1 - blast) * 18;
  return <SceneBase>
    <div style={{position: 'absolute', inset: 0, transform: `translateX(${shake}px)`}}>
      <div style={{position: 'absolute', left: 470, top: 260, width: 140, height: 1040, background: palette.ink}} />
      {Array.from({length: 14}).map((_, i) => {
        const angle = (Math.PI * 2 * i) / 14;
        const radius = blast * (260 + (i % 4) * 80);
        return <div key={i} style={{position: 'absolute', left: 520 + Math.cos(angle) * radius, top: 690 + Math.sin(angle) * radius, width: 80 + (i % 3) * 28, height: 30 + (i % 2) * 22, background: i % 2 ? palette.mustard : palette.red, transform: `rotate(${angle}rad) scale(${blast})`, border: `8px solid ${palette.paper}`}} />;
      })}
      <div style={{position: 'absolute', left: 335, top: 500, width: 410, height: 410, borderRadius: '50%', background: `radial-gradient(circle, ${palette.paper} 0 12%, ${palette.gas} 13% 34%, ${palette.red} 35% 62%, transparent 63%)`, transform: `scale(${blast})`}} />
    </div>
    <div style={{position: 'absolute', left: 80, right: 80, top: 1190, color: palette.ink, fontFamily: 'Arial Black, Arial', fontSize: 92, lineHeight: .9}}>THEN<br/>THE GAS<br/><span style={{color: palette.red}}>EXPLODED</span></div>
    <Label style={{right: 80, bottom: 120, background: palette.red}}>EXPERIMENT ENDS</Label>
  </SceneBase>;
};
