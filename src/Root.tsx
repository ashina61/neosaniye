import React from 'react';
import {Composition} from 'remotion';
import {EIFFEL_SHORT_DURATION, EiffelTowerShort} from './shorts/EiffelTowerShort';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="NeoSaniyeEiffelTower"
    component={EiffelTowerShort}
    durationInFrames={EIFFEL_SHORT_DURATION}
    fps={30}
    width={1080}
    height={1920}
  />
);
