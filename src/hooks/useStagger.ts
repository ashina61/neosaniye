import { interpolate, useCurrentFrame } from 'remotion'

export function useStagger(
  index: number,
  _total: number,
  startFrame: number,
  staggerFrames: number,
  durationFrames: number
): number {
  const frame = useCurrentFrame()
  const itemStart = startFrame + index * staggerFrames
  return interpolate(frame, [itemStart, itemStart + durationFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}
