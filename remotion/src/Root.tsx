import React from 'react';
import {Composition} from 'remotion';
import {DynamicShort} from './DynamicShort';
import {DEFAULT_PRODUCTION, type ProductionSpec} from './schema';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="NeoSaniyeDynamicShort"
    component={DynamicShort}
    durationInFrames={DEFAULT_PRODUCTION.meta.durationInFrames}
    fps={DEFAULT_PRODUCTION.meta.fps}
    width={DEFAULT_PRODUCTION.meta.width}
    height={DEFAULT_PRODUCTION.meta.height}
    defaultProps={DEFAULT_PRODUCTION}
    calculateMetadata={({props}) => {
      const spec = props as ProductionSpec;
      return {
        durationInFrames: spec.meta.durationInFrames,
        fps: spec.meta.fps,
        width: spec.meta.width,
        height: spec.meta.height,
      };
    }}
  />
);
