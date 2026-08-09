import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

export function useTextReveal(
  text: string,
  mode: 'words' | 'chars',
  startFrame: number,
  staggerFrames: number = 4
): Array<{ opacity: number; y: number }> {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const units = mode === 'words' ? text.split(' ') : text.split('')

  return units.map((_, i) => {
    const itemStart = startFrame + i * staggerFrames
    const progress = spring({
      frame: frame - itemStart,
      fps,
      config: { damping: 200, stiffness: 300, mass: 0.8 },
    })
    return {
      opacity: progress,
      y: interpolate(progress, [0, 1], [30, 0]),
    }
  })
}
