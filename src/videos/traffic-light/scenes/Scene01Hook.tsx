import React from 'react';
import {interpolate} from 'remotion';
import {enterSpring, clamp} from '../../../core/motion';
import {DrawPath} from '../../../core/graphics/DrawPath';
import {SceneBase, Label} from './shared';
import {palette} from '../story';

export const Scene01Hook: React.FC<{frame: number; duration: number}> = ({frame, duration}) => {
  const enter = enterSpring(frame, 8);
  const zoom = interpolate(frame, [0, duration], [1, 1.09], clamp);
  return <SceneBase>
    <div style={{position: 'absolute', left: 220, top: 260, width: 640, height: 980, transform: `scale(${zoom})`}}>
      <div style={{position: 'absolute', left: 285, top: 80, width: 70, height: 780, background: palette.ink}} />
      <div style={{position: 'absolute', left: 100, top: 210, width: 440, height: 90, background: palette.red, transform: 'rotate(-10deg)', border: `10px solid ${palette.paper}`}} />
      <div style={{position: 'absolute', left: 100, top: 380, width: 440, height: 90, background: palette.cyan, transform: 'rotate(10deg)', border: `10px solid ${palette.paper}`}} />
      <div style={{position: 'absolute', left: 210, top: 650, width: 220, height: 220, borderRadius: '50%', background: palette.gas, boxShadow: '0 0 90px rgba(243,208,125,.8)', border: `14px solid ${palette.ink}`}} />
      <DrawPath d="M90 910 C180 780 460 780 550 910" progress={interpolate(frame, [10, duration * .7], [0, 1], clamp)} color={palette.ink} width={12} />
    </div>
    <div style={{position: 'absolute', left: 80, right: 80, top: 1280, transform: `translateY(${(1 - enter) * 80}px)`, opacity: enter, color: palette.ink, fontFamily: 'Arial Black, Arial', fontSize: 98, lineHeight: .9}}>THE FIRST<br/>TRAFFIC LIGHT<br/><span style={{color: palette.red}}>EXPLODED</span></div>
    <Label style={{left: 82, bottom: 110}}>LONDON / 1868</Label>
  </SceneBase>;
};
