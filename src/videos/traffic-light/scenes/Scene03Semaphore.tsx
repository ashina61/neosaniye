import React from 'react';
import {interpolate} from 'remotion';
import {clamp, enterSpring} from '../../../core/motion';
import {DrawPath} from '../../../core/graphics/DrawPath';
import {SceneBase, Label} from './shared';
import {palette} from '../story';

export const Scene03Semaphore: React.FC<{frame: number; duration: number}> = ({frame, duration}) => {
  const enter = enterSpring(frame);
  const arm = interpolate(frame, [8, duration * .58], [28, -20], clamp);
  return <SceneBase>
    <div style={{position: 'absolute', left: 490, top: 220, width: 90, height: 1120, background: palette.ink, transform: `translateY(${(1 - enter) * 900}px)`}} />
    <div style={{position: 'absolute', left: 170, top: 520, width: 410, height: 92, background: palette.red, border: `12px solid ${palette.paper}`, transformOrigin: '100% 50%', transform: `rotate(${arm}deg)`}} />
    <div style={{position: 'absolute', left: 500, top: 690, width: 410, height: 92, background: palette.cyan, border: `12px solid ${palette.paper}`, transformOrigin: '0% 50%', transform: `rotate(${-arm}deg)`}} />
    <DrawPath d="M105 435 C230 250 790 250 910 435" progress={interpolate(frame, [12, duration * .8], [0, 1], clamp)} color={palette.mustard} width={10} />
    <Label style={{left: 110, top: 300, background: palette.red}}>STOP</Label>
    <Label style={{right: 110, top: 300, background: palette.cyan, color: palette.ink}}>CAUTION</Label>
    <div style={{position: 'absolute', left: 100, right: 100, bottom: 180, color: palette.ink, fontFamily: 'Arial Black, Arial', fontSize: 70}}>TWO ARMS.<br/>TWO COMMANDS.</div>
  </SceneBase>;
};
