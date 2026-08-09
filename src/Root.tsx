import React from 'react'
import { Composition } from 'remotion'
import { Video002, meta as video002Meta } from './videos/Video002'
import { Video003, meta as video003Meta } from './videos/Video003'
import { formats } from './tokens'
import './lib/fonts'

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={video002Meta.id}
        component={Video002}
        durationInFrames={video002Meta.durationInFrames}
        fps={video002Meta.fps}
        {...formats[video002Meta.format]}
      />
      <Composition
        id={video003Meta.id}
        component={Video003}
        durationInFrames={video003Meta.durationInFrames}
        fps={video003Meta.fps}
        {...formats[video003Meta.format]}
      />
    </>
  )
}
