import React from 'react'
import { Audio, interpolate, useVideoConfig } from 'remotion'

interface AudioTrackProps {
  src: string
  volume?: number
  fadeInFrames?: number
  fadeOutFrames?: number
}

export const AudioTrack: React.FC<AudioTrackProps> = ({
  src,
  volume = 1,
  fadeInFrames = 15,
  fadeOutFrames = 15,
}) => {
  const { durationInFrames } = useVideoConfig()

  return (
    <Audio
      src={src}
      volume={(f) => {
        const fadeIn = interpolate(f, [0, fadeInFrames], [0, volume], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
        const fadeOut = interpolate(
          f,
          [durationInFrames - fadeOutFrames, durationInFrames],
          [volume, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        )
        return Math.min(fadeIn, fadeOut)
      }}
    />
  )
}
