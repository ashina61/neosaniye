import {Composition, registerRoot} from 'remotion';
import React from 'react';
import {Reel, type ReelData} from './Reel';

/**
 * The v2 composition. Everything it needs arrives as input props, so this file
 * — like the rest of the engine — never learns an episode id or a file name.
 * The duration is the reel's own last frame, so the video ends when the
 * narration does rather than at a number somebody typed.
 */
type Props = {data: ReelData; accent?: string};

const empty: ReelData = {shots: [], words: []};

const Root: React.FC = () => (
  <Composition
    id="Reel"
    component={Reel as React.FC<Props>}
    durationInFrames={900}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={{data: empty}}
    calculateMetadata={({props}: {props: Props}) => ({
      durationInFrames: Math.max(
        1,
        ...props.data.shots.map((shot) => shot.to),
        ...props.data.words.map((word) => word.to),
      ),
    })}
  />
);

registerRoot(Root);
