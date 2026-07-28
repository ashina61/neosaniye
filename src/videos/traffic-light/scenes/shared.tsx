import React from 'react';
import {AbsoluteFill} from 'remotion';
import {PaperLayer} from '../../../core/graphics/PaperLayer';
import {palette} from '../story';

export const SceneBase: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill style={{background: palette.paper, overflow: 'hidden'}}>
    <PaperLayer color={palette.cyan} style={{left: -130, top: -180, width: 760, height: 820, opacity: .38, transform: 'rotate(-8deg)'}} />
    <PaperLayer color={palette.mustard} style={{right: -230, bottom: -120, width: 760, height: 760, opacity: .44, transform: 'rotate(12deg)'}} />
    <AbsoluteFill style={{backgroundImage: 'radial-gradient(circle, rgba(23,32,42,.12) 0 1px, transparent 1.5px)', backgroundSize: '18px 18px', opacity: .18}} />
    {children}
  </AbsoluteFill>
);

export const Label: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={{position: 'absolute', padding: '13px 24px', background: palette.ink, color: palette.paper, fontFamily: 'Arial Black, Arial', fontSize: 28, letterSpacing: 2, ...style}}>{children}</div>
);
