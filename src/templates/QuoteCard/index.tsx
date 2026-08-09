import React from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { fontFamilies, fontSizes, themes } from '../../tokens'
import { useSlideIn } from '../../hooks/useSlideIn'
import { type QuoteCardProps } from './schema'

export const QuoteCard: React.FC<QuoteCardProps> = ({
  quote,
  name,
  title,
  theme,
  durationInFrames,
}) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const t = themes[theme]

  const slide = useSlideIn('right', 0, 25, 80)

  const attributionOpacity = interpolate(frame, [25, 40], [0, 1], {
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
        padding: '0 80px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 40,
          opacity: slide.opacity,
          transform: `translateX(${slide.x}px)`,
        }}
      >
        <div
          style={{
            width: 6,
            background: t.accent,
            borderRadius: 3,
            flexShrink: 0,
          }}
        />
        <div>
          <p
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSizes.heading,
              fontStyle: 'italic',
              color: t.text,
              lineHeight: 1.4,
              margin: '0 0 40px',
            }}
          >
            &ldquo;{quote}&rdquo;
          </p>
          <div style={{ opacity: attributionOpacity }}>
            <span
              style={{
                fontFamily: fontFamilies.body,
                fontWeight: 700,
                fontSize: fontSizes.body,
                color: t.text,
                display: 'block',
              }}
            >
              {name}
            </span>
            {title && (
              <span
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: fontSizes.caption,
                  color: t.muted,
                  display: 'block',
                  marginTop: 8,
                }}
              >
                {title}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
