import React from 'react';
import {Composition} from 'remotion';
import {NeoSaniyeShort} from './Video';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="NeoSaniyeShort"
      component={NeoSaniyeShort}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
