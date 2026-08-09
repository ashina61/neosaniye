import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

export function useSlideIn(
  direction: 'up' | 'down' | 'left' | 'right',
  startFrame: number,
  durationFrames: number = 20,
  distance: number = 60
): { x: number; y: number; opacity: number } {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 200, stiffness: 300, mass: 0.8 },
    durationInFrames: durationFrames,
  })

  const opacity = interpolate(frame, [startFrame, startFrame + 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const offset = interpolate(progress, [0, 1], [distance, 0])

  const x =
    direction === 'left'
      ? -offset
      : direction === 'right'
        ? offset
        : 0

  const y =
    direction === 'up'
      ? offset
      : direction === 'down'
        ? -offset
        : 0

  return { x, y, opacity }
}
