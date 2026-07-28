import React from 'react';
import {Composition} from 'remotion';
import {NeoSaniyeVox} from './vox/NeoSaniyeVox';
import {VOX_FPS, VOX_HEIGHT, VOX_TOTAL_FRAMES, VOX_WIDTH} from './vox/story';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="NeoSaniyeVox"
    component={NeoSaniyeVox}
    durationInFrames={VOX_TOTAL_FRAMES}
    fps={VOX_FPS}
    width={VOX_WIDTH}
    height={VOX_HEIGHT}
  />
);
