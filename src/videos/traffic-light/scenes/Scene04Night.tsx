import React from 'react';
import {interpolate} from 'remotion';
import {clamp} from '../../../core/motion';
import {SceneBase, Label} from './shared';
import {palette} from '../story';

export const Scene04Night: React.FC<{frame: number; duration: number}> = ({frame, duration}) => {
  const sway = Math.sin(frame * .045) * 7;
  const glow = interpolate(frame, [0, duration * .5, duration], [.45, 1, .72], clamp);
  return <SceneBase>
    <div style={{position: 'absolute', inset: 0, background: '#15202b', opacity: .88}} />
    <div style={{position: 'absolute', left: 380, top: 300, width: 320, height: 760, transformOrigin: '50% 0%', transform: `rotate(${sway}deg)`}}>
      <div style={{position: 'absolute', left: 145, top: -250, width: 30, height: 310, background: palette.paper}} />
      <div style={{position: 'absolute', left: 25, top: 40, width: 270, height: 560, background: palette.ink, border: `10px solid ${palette.paper}`}} />
      <div style={{position: 'absolute', left: 70, top: 110, width: 180, height: 180, borderRadius: '50%', background: '#a8312a', boxShadow: `0 0 ${80 * glow}px rgba(168,49,42,.9)`}} />
      <div style={{position: 'absolute', left: 70, top: 335, width: 180, height: 180, borderRadius: '50%', background: '#3c9a6f', boxShadow: `0 0 ${80 * glow}px rgba(60,154,111,.9)`}} />
    </div>
    <div style={{position: 'absolute', left: 80, right: 80, top: 1190, color: palette.paper, fontFamily: 'Arial Black, Arial', fontSize: 78}}>AT NIGHT,<br/>GAS MADE IT<br/><span style={{color: palette.gas}}>VISIBLE</span></div>
    <Label style={{left: 84, bottom: 120, background: palette.gas, color: palette.ink}}>RED / GREEN</Label>
  </SceneBase>;
};
