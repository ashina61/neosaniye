import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {clamp} from '../motion';
import type {TransitionKind} from '../story/types';

export const TransitionLayer: React.FC<{
  kind: TransitionKind;
  localFrame: number;
}> = ({kind, localFrame}) => {
  if (kind === 'hard-cut' || kind === 'match-object') return null;

  const alpha = interpolate(localFrame, [-8, 0, 8], [0, 1, 0], clamp);

  if (kind === 'occlusion') {
    return (
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: '#d9a23e',
          transform: `translateX(${interpolate(localFrame, [-8, 8], [-1250, 1250], clamp)}px) rotate(9deg)`,
          opacity: alpha,
        }}
      />
    );
  }

  if (kind === 'paper-reveal') {
    const inset = interpolate(localFrame, [-8, 0, 8], [100, 0, 100], clamp);
    return (
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: '#efe7d4',
          clipPath: `polygon(0 ${inset}%, 100% ${Math.max(0, inset - 8)}%, 100% 100%, 0 100%)`,
          opacity: alpha,
        }}
      />
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: 440,
        top: 860,
        width: 200,
        height: 200,
        borderRadius: '50%',
        border: '26px solid #efe7d4',
        transform: `scale(${interpolate(localFrame, [-8, 2, 8], [.2, 7, 10], clamp)})`,
        opacity: alpha,
        pointerEvents: 'none',
      }}
    />
  );
};
