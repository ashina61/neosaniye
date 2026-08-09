import { useMemo } from 'react'
import { useVideoConfig } from 'remotion'
import { fontSizes, typeScaleFor } from '../tokens'

/**
 * The type scale for THIS composition, plus the matching spacing unit.
 *
 * Templates never read `fontSizes` directly. They ask for this, and the same
 * component lays out correctly at 1920×1080 and at 1080×1920 without knowing
 * which one it is in — which is the only way a template stays a dumb display
 * component while still working in both formats.
 *
 * `space()` scales alongside the type on purpose. Growing the words while
 * leaving the gaps at their landscape values gives you a vertical frame with
 * big text crammed into a small block: the rhythm between lines is part of the
 * type size, not decoration around it.
 */
export const useType = () => {
  const { width, height } = useVideoConfig()

  return useMemo(() => {
    const scale = typeScaleFor(width, height)
    const at = (size: number) => Math.round(size * scale)

    return {
      hero: at(fontSizes.hero),
      title: at(fontSizes.title),
      heading: at(fontSizes.heading),
      body: at(fontSizes.body),
      caption: at(fontSizes.caption),
      scale,
      /** A landscape pixel value, converted to this frame's scale. */
      space: at,
    }
  }, [width, height])
}
