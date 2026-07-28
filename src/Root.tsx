import React from 'react';
import {Composition} from 'remotion';
import {TOTAL_FRAMES} from './generated/timing';
import {VenusShort} from './VenusShort';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="NeoSaniyeVenus"
    component={VenusShort}
    durationInFrames={TOTAL_FRAMES}
    fps={30}
    width={1080}
    height={1920}
  />
);
