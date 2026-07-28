import React from 'react';
import {enterSpring} from '../../../core/motion';
import {PaperLayer} from '../../../core/graphics/PaperLayer';
import {StickerCutout} from '../../../core/graphics/StickerCutout';
import {SceneBase, Label} from './shared';
import {palette} from '../story';

export const Scene02Setup: React.FC<{frame: number}> = ({frame}) => {
  const enter = enterSpring(frame);
  return <SceneBase>
    <PaperLayer color="#d6c7a8" style={{left: 80, top: 230, width: 920, height: 960, transform: `translateX(${(1 - enter) * -220}px) rotate(-3deg)`}} />
    <StickerCutout frame={frame} seed={3} style={{left: 160, top: 320, width: 760, height: 690}}>
      <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(#d8d4c9,#85898f)', clipPath: 'polygon(8% 92%, 12% 28%, 25% 18%, 31% 38%, 38% 8%, 47% 36%, 56% 12%, 63% 35%, 76% 22%, 82% 92%)', border: `14px solid ${palette.paper}`}} />
    </StickerCutout>
    <div style={{position: 'absolute', left: 130, top: 1050, width: 820, color: palette.ink, fontFamily: 'Arial Black, Arial', fontSize: 66, lineHeight: 1.02}}>HORSE-DRAWN TRAFFIC<br/>HAD BECOME DANGEROUS</div>
    <Label style={{left: 135, top: 235}}>HOUSES OF PARLIAMENT</Label>
  </SceneBase>;
};
