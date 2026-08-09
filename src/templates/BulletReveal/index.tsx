import React from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { fontFamilies, themes } from '../../tokens'
import { useType } from '../../hooks/useType'
import { useSlideIn } from '../../hooks/useSlideIn'
import { type BulletRevealProps } from './schema'

export const BulletReveal: React.FC<BulletRevealProps> = ({
  heading,
  bullets,
  theme,
  durationInFrames,
  staggerFrames,
}) => {
  const type = useType()
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const t = themes[theme]

  const headingSlide = useSlideIn('left', 0, 20, 80)

  const exitStart = durationInFrames - 8
  const exitOpacity = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const activeBulletIndex = Math.floor((frame - 20) / staggerFrames)

  return (
    <div
      style={{
        width,
        height,
        background: t.bg,
        opacity: exitOpacity,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: `0 ${type.space(80)}px`,
        overflow: 'hidden',
      }}
    >
      <h2
        style={{
          fontFamily: fontFamilies.display,
          fontSize: type.title,
          color: t.text,
          margin: `0 0 ${type.space(60)}px`,
          opacity: headingSlide.opacity,
          transform: `translateX(${headingSlide.x}px)`,
          letterSpacing: '0.02em',
        }}
      >
        {heading}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: type.space(32) }}>
        {bullets.map((bullet, i) => {
          const itemStart = 20 + i * staggerFrames
          const progress = interpolate(frame, [itemStart, itemStart + 15], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
          const isActive = i === activeBulletIndex
          const isPast = i < activeBulletIndex
          const bulletOpacity = progress === 0 ? 0 : isPast && !isActive ? 0.45 : 1

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: type.space(24),
                opacity: bulletOpacity,
                transform: `translateY(${interpolate(progress, [0, 1], [30, 0])}px)`,
              }}
            >
              <span
                style={{
                  fontFamily: fontFamilies.display,
                  fontSize: type.heading,
                  color: t.accent,
                  minWidth: 48,
                  lineHeight: 1,
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: type.body,
                  color: t.text,
                  lineHeight: 1.3,
                }}
              >
                {bullet}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
