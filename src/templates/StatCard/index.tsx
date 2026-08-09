import React from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { fontFamilies, themes } from '../../tokens'
import { useType } from '../../hooks/useType'
import { useCountUp } from '../../hooks/useCountUp'
import { useSlideIn } from '../../hooks/useSlideIn'
import { type StatCardProps } from './schema'

export const StatCard: React.FC<StatCardProps> = ({
  label,
  stat,
  unit,
  theme,
  durationInFrames,
  format,
}) => {
  const type = useType()
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const t = themes[theme]

  const labelSlide = useSlideIn('up', 0, 20, 40)
  const countValue = useCountUp(stat, 10, durationInFrames - 30, format)

  const unitOpacity = interpolate(frame, [20, 35], [0, 1], {
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
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: t.surface,
          border: `2px solid ${t.muted}`,
          borderRadius: type.space(24),
          padding: `${type.space(80)}px ${type.space(100)}px`,
          textAlign: 'center',
          minWidth: type.space(600),
        }}
      >
        <p
          style={{
            fontFamily: fontFamilies.body,
            fontSize: type.caption,
            color: t.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            margin: `0 0 ${type.space(24)}px`,
            opacity: labelSlide.opacity,
            transform: `translateY(${labelSlide.y}px)`,
          }}
        >
          {label}
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: type.space(16) }}>
          <span
            style={{
              fontFamily: fontFamilies.display,
              fontSize: type.hero,
              color: t.accent,
              lineHeight: 1,
            }}
          >
            {countValue}
          </span>
          {unit && (
            <span
              style={{
                fontFamily: fontFamilies.body,
                fontSize: type.heading,
                color: t.text,
                opacity: unitOpacity,
              }}
            >
              {unit}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
