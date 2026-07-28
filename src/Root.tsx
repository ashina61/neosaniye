import React from 'react';
import {Composition} from 'remotion';
import {TOTAL_FRAMES} from './generated/timing';
import {TrafficLightShort} from './videos/traffic-light/TrafficLightShort';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="NeoSaniyeTrafficLight"
    component={TrafficLightShort}
    durationInFrames={TOTAL_FRAMES}
    fps={30}
    width={1080}
    height={1920}
  />
);
