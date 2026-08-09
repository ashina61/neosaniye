import React from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { fontFamilies, fontSizes, themes } from '../../tokens'
import { GradientBg } from '../../components/GradientBg'
import { Noise } from '../../components/Noise'
import { useTextReveal } from '../../hooks/useTextReveal'
import { type TitleCardProps } from './schema'

export const TitleCard: React.FC<TitleCardProps> = ({
  title,
  subtitle,
  theme,
  durationInFrames,
  enterDuration,
}) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const t = themes[theme]

  const exitStart = durationInFrames - 8
  const exitOpacity = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const words = title.split(' ')
  const wordAnimations = useTextReveal(title, 'words', 0, 5)

  const subtitleOpacity = interpolate(
    frame,
    [enterDuration + 10, enterDuration + 22],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

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
      <GradientBg colors={[t.bg, t.surface, t.bg]} animated speed={0.5} />
      <div
        style={{
          textAlign: 'center',
          padding: '0 60px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <h1
          style={{
            fontFamily: fontFamilies.display,
            fontSize: fontSizes.hero,
            color: t.text,
            margin: 0,
            lineHeight: 1.05,
            letterSpacing: '0.02em',
          }}
        >
          {words.map((word, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                opacity: wordAnimations[i]?.opacity ?? 0,
                transform: `translateY(${wordAnimations[i]?.y ?? 30}px)`,
                marginRight: '0.2em',
              }}
            >
              {word}
            </span>
          ))}
        </h1>
        {subtitle && (
          <p
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSizes.body,
              color: t.muted,
              marginTop: 24,
              marginBottom: 0,
              opacity: subtitleOpacity,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <Noise opacity={0.04} />
    </div>
  )
}
