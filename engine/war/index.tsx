import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {War, type WarData} from './War';

type Props = {data: WarData};

const Root: React.FC = () => (
  <Composition
    id="War"
    component={War as React.FC<Props>}
    durationInFrames={1470}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={{data: {end: 1470}}}
    calculateMetadata={({props}: {props: Props}) => ({durationInFrames: Math.max(2, props.data.end)})}
  />
);

registerRoot(Root);
