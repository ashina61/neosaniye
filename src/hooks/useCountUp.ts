import { interpolate, useCurrentFrame } from 'remotion'
import { formatNumber } from '../lib/utils'

export function useCountUp(
  target: number,
  startFrame: number,
  durationFrames: number,
  format: 'integer' | 'decimal' | 'currency' | 'percent' = 'integer'
): string {
  const frame = useCurrentFrame()
  const value = interpolate(frame, [startFrame, startFrame + durationFrames], [0, target], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  return formatNumber(value, format)
}
