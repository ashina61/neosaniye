import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {Short, type ShortData} from './Short';

type Props = {data: ShortData};
const empty: ShortData = {marks: [0, 30], words: []};

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
      durationInFrames: Math.max(2, props.data.marks[props.data.marks.length - 1]),
    })}
  />
);

registerRoot(Root);
