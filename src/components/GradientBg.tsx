import React from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'

interface GradientBgProps {
  colors: string[]
  animated?: boolean
  speed?: number
}

export const GradientBg: React.FC<GradientBgProps> = ({
  colors,
  animated = true,
  speed = 1,
}) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  const rotation = animated
    ? interpolate(frame, [0, durationInFrames], [0, 360 * speed])
    : 0

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(${rotation}deg, ${colors.join(', ')})`,
      }}
    />
  )
}
