import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {Zoom, type ZoomData} from './Zoom';

type Props = {data: ZoomData};

const fallback: ZoomData = {
  base: 0.1,
  ratio: 2,
  folds: 42,
  end: 900,
  title: {pre: 'bir kağıdı', big: '42', post: 'kez katla'},
  close: {pre: 'ama katlayamazsın', big: '12', post: 'dünya rekoru'},
};

const Root: React.FC = () => (
  <Composition
    id="Zoom"
    component={Zoom as React.FC<Props>}
    durationInFrames={900}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={{data: fallback}}
    calculateMetadata={({props}: {props: Props}) => ({durationInFrames: Math.max(2, props.data.end)})}
  />
);

registerRoot(Root);
