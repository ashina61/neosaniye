import React from 'react';
import {enterSpring} from '../../../core/motion';
import {StickerCutout} from '../../../core/graphics/StickerCutout';
import {DrawPath} from '../../../core/graphics/DrawPath';
import {SceneBase, Label} from './shared';
import {palette} from '../story';

export const Scene05Operator: React.FC<{frame: number}> = ({frame}) => {
  const enter = enterSpring(frame, 4);
  return <SceneBase>
    <StickerCutout frame={frame} seed={7} style={{left: 140, top: 280, width: 560, height: 970, transformOrigin: '50% 100%'}}>
      <div style={{position: 'absolute', left: 170, top: 0, width: 220, height: 220, borderRadius: '50%', background: '#6d7377', border: `16px solid ${palette.paper}`}} />
      <div style={{position: 'absolute', left: 95, top: 190, width: 370, height: 650, background: '#4d555c', clipPath: 'polygon(24% 0,76% 0,100% 100%,0 100%)', border: `16px solid ${palette.paper}`}} />
      <div style={{position: 'absolute', left: 335, top: 360, width: 330, height: 60, background: '#4d555c', transform: 'rotate(-18deg)', border: `12px solid ${palette.paper}`}} />
    </StickerCutout>
    <div style={{position: 'absolute', right: 90, top: 400, width: 330, height: 650, border: `6px solid ${palette.ink}`, background: '#d7ccb4', transform: `scale(${enter})`}}>
      <DrawPath d="M170 80 L170 570 M80 235 L260 235 M80 365 L260 365" progress={enter} color={palette.ink} width={10} viewBox="0 0 340 650" />
    </div>
    <div style={{position: 'absolute', left: 90, right: 90, bottom: 190, color: palette.ink, fontFamily: 'Arial Black, Arial', fontSize: 68}}>A POLICE OFFICER<br/>RAN IT <span style={{color: palette.red}}>BY HAND</span></div>
    <Label style={{right: 90, top: 300}}>MANUAL CONTROL</Label>
  </SceneBase>;
};
