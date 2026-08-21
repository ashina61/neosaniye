import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {Broll, type BrollData} from './Broll';

type Props = {data: BrollData};

const empty: BrollData = {accent: '#E04329', ink: '#1A1A1A', beats: [], end: 60};

const Root: React.FC = () => (
  <Composition
    id="Broll"
    component={Broll as React.FC<Props>}
    durationInFrames={900}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={{data: empty}}
    calculateMetadata={({props}: {props: Props}) => ({durationInFrames: Math.max(2, props.data.end)})}
  />
);

registerRoot(Root);
