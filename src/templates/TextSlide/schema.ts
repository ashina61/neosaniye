import { z } from 'zod'

export const textSlideSchema = z.object({
  text: z.string(),
  theme: z.enum(['dark', 'light', 'neon', 'paper', 'brutal']),
  durationInFrames: z.number(),
  highlightWord: z.string().optional(),
  icon: z.string().optional(),
})

export type TextSlideProps = z.infer<typeof textSlideSchema>
