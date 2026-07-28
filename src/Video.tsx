import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

export const NeoSaniyeShort: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entrance = spring({
    frame,
    fps,
    config: {damping: 14, stiffness: 120, mass: 0.8},
  });
  const opacity = interpolate(frame, [0, 12, 132, 149], [0, 1, 1, 0], clamp);

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        background: '#111111',
        color: '#ffffff',
        display: 'flex',
        fontFamily: 'Arial, sans-serif',
        justifyContent: 'center',
        opacity,
      }}
    >
      <div
        style={{
          fontSize: 108,
          fontWeight: 900,
          letterSpacing: -5,
          textAlign: 'center',
          transform: `scale(${0.75 + entrance * 0.25})`,
        }}
      >
        NEO<span style={{color: '#f4c430'}}>SANİYE</span>
      </div>
      <div
        style={{
          bottom: 180,
          fontSize: 34,
          letterSpacing: 8,
          position: 'absolute',
          textTransform: 'uppercase',
        }}
      >
        Temiz başlangıç
      </div>
    </AbsoluteFill>
  );
};
