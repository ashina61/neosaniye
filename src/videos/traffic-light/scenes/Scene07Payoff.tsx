import React from 'react';
import {interpolate} from 'remotion';
import {clamp, enterSpring} from '../../../core/motion';
import {SceneBase, Label} from './shared';
import {palette} from '../story';

export const Scene07Payoff: React.FC<{frame: number; duration: number}> = ({frame, duration}) => {
  const enter = enterSpring(frame);
  const red = interpolate(frame, [0, duration * .35], [.25, 1], clamp);
  return <SceneBase>
    <div style={{position: 'absolute', left: 250, top: 240, width: 580, height: 900, background: palette.ink, borderRadius: 80, transform: `scale(${.8 + enter * .2})`, boxShadow: '0 30px 50px rgba(0,0,0,.25)'}}>
      {[palette.red, palette.mustard, '#4d9a70'].map((color, i) => <div key={color} style={{position: 'absolute', left: 165, top: 100 + i * 250, width: 250, height: 250, borderRadius: '50%', background: color, opacity: i === 0 ? red : .25, boxShadow: i === 0 ? `0 0 90px rgba(163,66,58,${red})` : undefined}} />)}
    </div>
    <div style={{position: 'absolute', left: 80, right: 80, top: 1250, color: palette.ink, fontFamily: 'Arial Black, Arial', fontSize: 76, lineHeight: .98}}>THE MODERN SIGNAL<br/>STARTED WITH<br/><span style={{color: palette.red}}>A FAILURE</span></div>
    <Label style={{left: 82, bottom: 100}}>FROM GAS TO ELECTRIC</Label>
  </SceneBase>;
};
