import React from 'react'
import { useTextReveal } from '../hooks/useTextReveal'

interface AnimatedTextProps {
  text: string
  mode: 'words' | 'chars'
  startFrame: number
  staggerFrames?: number
  style?: React.CSSProperties
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  mode,
  startFrame,
  staggerFrames = 4,
  style,
}) => {
  const units = mode === 'words' ? text.split(' ') : text.split('')
  const animations = useTextReveal(text, mode, startFrame, staggerFrames)

  return (
    <span style={{ display: 'inline', ...style }}>
      {units.map((unit, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            opacity: animations[i]?.opacity ?? 0,
            transform: `translateY(${animations[i]?.y ?? 30}px)`,
            marginRight: mode === 'words' ? '0.25em' : undefined,
          }}
        >
          {unit}
        </span>
      ))}
    </span>
  )
}
