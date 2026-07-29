import React from 'react';
import {Composition} from 'remotion';
import {NeoSaniyeVox} from './vox/NeoSaniyeVox';
import {VOX_FPS, VOX_HEIGHT, VOX_TOTAL_FRAMES, VOX_WIDTH} from './vox/story';
import {VoxShort, sampleVideoData} from './vox-documentary/VoxShort';
import type {VoxVideoData} from './vox-documentary/types';

export const RemotionRoot: React.FC = () => (<>
  <Composition
    id="NeoSaniyeVox"
    component={NeoSaniyeVox}
    durationInFrames={VOX_TOTAL_FRAMES}
    fps={VOX_FPS}
    width={VOX_WIDTH}
    height={VOX_HEIGHT}
  />
  <Composition
    id="VoxShort"
    component={VoxShort}
    defaultProps={{videoData: sampleVideoData}}
    durationInFrames={sampleVideoData.durationInFrames}
    fps={30}
    width={1080}
    height={1920}
    calculateMetadata={({props}) => ({durationInFrames:(props.videoData as VoxVideoData).durationInFrames, width:1080, height:1920, fps:30})}
  />
</>);
