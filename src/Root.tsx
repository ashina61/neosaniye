import React from 'react'
import { Composition } from 'remotion'
import { Video002, meta as video002Meta } from './videos/Video002'
import { formats } from './tokens'
import './lib/fonts'

export const RemotionRoot: React.FC = () => {
  const { width, height } = formats[video002Meta.format]

  return (
    <>
      <Composition
        id={video002Meta.id}
        component={Video002}
        durationInFrames={video002Meta.durationInFrames}
        fps={video002Meta.fps}
        width={width}
        height={height}
      />
    </>
  )
}
