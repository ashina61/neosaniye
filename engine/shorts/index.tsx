import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {Short, type ShortData} from './Short';

type Props = {data: ShortData};
const empty: ShortData = {scenes: [], words: [], end: 30};

const Root: React.FC = () => (
  <Composition
    id="Short"
    component={Short as React.FC<Props>}
    durationInFrames={900}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={{data: empty}}
    calculateMetadata={({props}: {props: Props}) => ({
      durationInFrames: Math.max(2, props.data.end),
    })}
  />
);

registerRoot(Root);
