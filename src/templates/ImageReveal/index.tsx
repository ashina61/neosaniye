import React from 'react'
import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { fontFamilies, themes } from '../../tokens'
import { useType } from '../../hooks/useType'
import { type ImageRevealProps } from './schema'

export const ImageReveal: React.FC<ImageRevealProps> = ({
  src,
  fit,
  caption,
  theme,
  durationInFrames,
}) => {
  const type = useType()
  const frame = useCurrentFrame()
  const { width, height, fps } = useVideoConfig()
  const t = themes[theme]

  const enterProgress = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 80, mass: 1 },
    durationInFrames: 40,
  })

  const scale = interpolate(enterProgress, [0, 1], [1.08, 1.0])
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const captionOpacity = interpolate(frame, [20, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const exitStart = durationInFrames - 8
  const exitOpacity = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <div
      style={{
        width,
        height,
        background: t.bg,
        opacity: exitOpacity,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity,
          transform: `scale(${scale})`,
        }}
      >
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: fit,
          }}
        />
      </div>
      {caption && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: `${type.space(60)}px ${type.space(60)}px ${type.space(48)}px`,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
            opacity: captionOpacity,
          }}
        >
          <p
            style={{
              fontFamily: fontFamilies.body,
              fontSize: type.caption,
              color: '#ffffff',
              margin: 0,
              textAlign: 'center',
            }}
          >
            {caption}
          </p>
        </div>
      )}
    </div>
  )
}
