import React from 'react';
import {Composition} from 'remotion';
import {Episode} from './Episode';
import type {EpisodeConfig} from './schema';
import {DEFAULT_LOOK, totalDurationInFrames} from './schema';

/**
 * ONE composition for every episode.
 *
 * Dimensions, fps and duration all come from the config through
 * `calculateMetadata`, so nothing about a particular episode is compiled in —
 * the render script passes its config as input props and this file never
 * learns which episode it is drawing.
 */
const FALLBACK: EpisodeConfig = {
  id: 'unconfigured',
  title: 'No episode loaded',
  fps: 30,
  width: 1080,
  height: 1920,
  look: DEFAULT_LOOK,
  scenes: [
    {
      id: 'placeholder',
      sceneType: 'parallax-punch',
      durationInFrames: 60,
      voText: 'Pass an episode config with --episode.',
      onScreenText: [{text: 'no episode loaded', atFrame: 6, durationInFrames: 48, position: 'center'}],
    },
  ],
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Episode"
    component={Episode as React.FC<Record<string, unknown>>}
    durationInFrames={totalDurationInFrames(FALLBACK)}
    fps={FALLBACK.fps}
    width={FALLBACK.width}
    height={FALLBACK.height}
    defaultProps={{config: FALLBACK} as Record<string, unknown>}
    calculateMetadata={({props}) => {
      const config = (props as {config?: EpisodeConfig}).config ?? FALLBACK;
      return {
        durationInFrames: totalDurationInFrames(config),
        fps: config.fps,
        width: config.width,
        height: config.height,
      };
    }}
  />
);
