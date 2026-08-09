import React from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { fontFamilies, fontSizes, themes } from '../../tokens'
import { Noise } from '../../components/Noise'
import { useTextReveal } from '../../hooks/useTextReveal'
import { type TextSlideProps } from './schema'

export const TextSlide: React.FC<TextSlideProps> = ({
  text,
  theme,
  durationInFrames,
  highlightWord,
  icon,
}) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const t = themes[theme]

  const exitStart = durationInFrames - 8
  const exitOpacity = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const words = text.split(' ')
  const wordAnimations = useTextReveal(text, 'words', 8, 5)

  const iconOpacity = interpolate(frame, [0, 12], [0, 1], {
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
          width: '75%',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {icon && (
          <div
            style={{
              fontSize: fontSizes.heading,
              marginBottom: 32,
              opacity: iconOpacity,
            }}
          >
            {icon}
          </div>
        )}
        <p
          style={{
            fontFamily: fontFamilies.body,
            fontWeight: 700,
            fontSize: fontSizes.heading,
            color: t.text,
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {words.map((word, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                opacity: wordAnimations[i]?.opacity ?? 0,
                transform: `translateY(${wordAnimations[i]?.y ?? 30}px)`,
                marginRight: '0.25em',
                color: highlightWord && word === highlightWord ? t.accent : t.text,
              }}
            >
              {word}
            </span>
          ))}
        </p>
      </div>
      <Noise opacity={0.03} />
    </div>
  )
}
