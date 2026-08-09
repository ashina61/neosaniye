import React from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'

interface ProgressBarProps {
  color: string
  height?: number
  position?: 'top' | 'bottom'
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  color,
  height = 4,
  position = 'bottom',
}) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  const progress = interpolate(frame, [0, durationInFrames], [0, 100], {
    extrapolateRight: 'clamp',
  })

  return (
    <div
      style={{
        position: 'absolute',
        [position]: 0,
        left: 0,
        width: `${progress}%`,
        height,
        background: color,
      }}
    />
  )
}
