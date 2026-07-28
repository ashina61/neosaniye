import React from 'react';
import {Composition} from 'remotion';
import {NeoSaniyeShort} from './NeoSaniyeShort';
import {TOTAL_FRAMES} from './generated/timing';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="NeoSaniyeShort"
    component={NeoSaniyeShort}
    durationInFrames={TOTAL_FRAMES}
    fps={30}
    width={1080}
    height={1920}
  />
);
