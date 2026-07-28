import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {clamp} from '../motion';
import type {TransitionKind} from '../story/types';

export const TransitionLayer: React.FC<{
  kind: TransitionKind;
  localFrame: number;
}> = ({kind, localFrame}) => {
  if (kind === 'hard-cut') return null;
  const alpha = interpolate(localFrame, [-8, 0, 8], [0, 1, 0], clamp);

  if (kind === 'occlusion') {
    return <AbsoluteFill style={{pointerEvents: 'none', background: '#d9a23e', transform: `translateX(${interpolate(localFrame, [-8, 8], [-1100, 1100], clamp)}px) rotate(9deg)`, opacity: alpha}} />;
  }

  if (kind === 'paper-reveal') {
    return <AbsoluteFill style={{pointerEvents: 'none', background: '#efe7d4', clipPath: `inset(${interpolate(localFrame, [-8, 0, 8], [100, 0, 100], clamp)}% 0 0 0)`, opacity: alpha}} />;
  }

  if (kind === 'push-through') {
    return <div style={{position: 'absolute', left: 440, top: 860, width: 200, height: 200, borderRadius: '50%', border: '26px solid #efe7d4', transform: `scale(${interpolate(localFrame, [-8, 2, 8], [.2, 7, 10], clamp)})`, opacity: alpha}} />;
  }

  return <div style={{position: 'absolute', left: 260, top: 480, width: 560, height: 560, borderRadius: '50%', background: '#7fc9ca', transform: `scale(${interpolate(localFrame, [-8, 0, 8], [.1, 1.5, 8], clamp)})`, opacity: alpha}} />;
};
