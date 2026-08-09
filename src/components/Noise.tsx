import React from 'react'
import { useCurrentFrame } from 'remotion'

interface NoiseProps {
  opacity?: number
  animate?: boolean
}

export const Noise: React.FC<NoiseProps> = ({ opacity = 0.04, animate = false }) => {
  const frame = useCurrentFrame()
  const seed = animate ? frame % 60 : 0
  const id = `noise-filter-${seed}`

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity,
        pointerEvents: 'none',
      }}
    >
      <defs>
        <filter id={id}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
            seed={seed}
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  )
}
