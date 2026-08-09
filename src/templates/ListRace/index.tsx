import React from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { fontFamilies, fontSizes, themes } from '../../tokens'
import { type ListRaceProps } from './schema'

export const ListRace: React.FC<ListRaceProps> = ({
  items,
  theme,
  durationInFrames,
  title,
}) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const t = themes[theme]

  const maxValue = Math.max(...items.map((item) => item.value ?? 0))

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {
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
        justifyContent: 'center',
        padding: '0 80px',
        overflow: 'hidden',
      }}
    >
      {title && (
        <h2
          style={{
            fontFamily: fontFamilies.display,
            fontSize: fontSizes.title,
            color: t.text,
            margin: '0 0 48px',
            opacity: titleOpacity,
            letterSpacing: '0.02em',
          }}
        >
          {title}
        </h2>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {items.map((item, i) => {
          const slideStart = 10 + i * 12
          const slideProgress = interpolate(frame, [slideStart, slideStart + 20], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })

          const barStart = 20 + i * 12
          const barProgress = interpolate(frame, [barStart, barStart + (durationInFrames - 50)], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })

          const barWidth =
            item.value !== undefined && maxValue > 0
              ? interpolate(barProgress, [0, 1], [0, (item.value / maxValue) * 100])
              : 0

          return (
            <div
              key={i}
              style={{
                opacity: slideProgress,
                transform: `translateY(${interpolate(slideProgress, [0, 1], [40, 0])}px)`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 8 }}>
                <span
                  style={{
                    fontFamily: fontFamilies.display,
                    fontSize: fontSizes.body,
                    color: t.accent,
                    minWidth: 40,
                    lineHeight: 1,
                  }}
                >
                  #{i + 1}
                </span>
                <span
                  style={{
                    fontFamily: fontFamilies.body,
                    fontSize: fontSizes.body,
                    color: t.text,
                    fontWeight: 600,
                  }}
                >
                  {item.label}
                </span>
                {item.value !== undefined && (
                  <span
                    style={{
                      fontFamily: fontFamilies.mono,
                      fontSize: fontSizes.caption,
                      color: t.muted,
                      marginLeft: 'auto',
                    }}
                  >
                    {item.value.toLocaleString()}
                  </span>
                )}
              </div>
              {item.value !== undefined && (
                <div
                  style={{
                    height: 6,
                    background: t.surface,
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${barWidth}%`,
                      background: t.accent,
                      borderRadius: 3,
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
