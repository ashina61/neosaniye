import React from 'react';
import {boil} from '../motion';

export const StickerCutout: React.FC<{
  frame: number;
  seed?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({frame, seed = 0, style, children}) => {
  const jitter = boil(frame, seed, 1.25);
  return (
    <div
      style={{
        position: 'absolute',
        filter: 'drop-shadow(0 16px 18px rgba(0,0,0,.28)) drop-shadow(0 0 0 #fff)',
        transform: `translate(${jitter.x}px, ${jitter.y}px) rotate(${jitter.rotate}deg)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
