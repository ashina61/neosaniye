import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { fontFamilies, fontSizes, themes } from '../../tokens'
import { GradientBg } from '../../components/GradientBg'
import { ProgressBar } from '../../components/ProgressBar'
import { Noise } from '../../components/Noise'
import { type OutroCardProps } from './schema'

export const OutroCard: React.FC<OutroCardProps> = ({
  cta,
  handle,
  theme,
  durationInFrames,
  showProgressBar,
}) => {
  const frame = useCurrentFrame()
  const { width, height, fps } = useVideoConfig()
  const t = themes[theme]

  const enterProgress = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 200, mass: 0.8 },
  })

  const ctaOpacity = interpolate(enterProgress, [0, 1], [0, 1])
  const ctaY = interpolate(enterProgress, [0, 1], [40, 0])

  const handleOpacity = interpolate(frame, [15, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Pulse: scale 1.0 → 1.03 looping
  const pulseFrame = frame % 60
  const pulse = spring({
    frame: pulseFrame,
    fps,
    config: { damping: 10, stiffness: 100, mass: 1 },
  })
  const pulseScale = interpolate(pulse, [0, 1], [1.0, 1.03])

  return (
    <div
      style={{
        width,
        height,
        background: t.bg,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <GradientBg colors={[t.bg, t.surface, t.bg]} animated speed={0.3} />
      <div
        style={{
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <h2
          style={{
            fontFamily: fontFamilies.display,
            fontSize: fontSizes.title,
            color: t.text,
            margin: '0 0 24px',
            letterSpacing: '0.03em',
            opacity: ctaOpacity,
            transform: `translateY(${ctaY}px) scale(${pulseScale})`,
          }}
        >
          {cta}
        </h2>
        <p
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSizes.body,
            color: t.accent,
            margin: 0,
            fontWeight: 700,
            opacity: handleOpacity,
          }}
        >
          {handle}
        </p>
      </div>
      {showProgressBar && (
        <ProgressBar color={t.accent} height={6} position="bottom" />
      )}
      <Noise opacity={0.04} />
    </div>
  )
}
