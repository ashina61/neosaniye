import { z } from 'zod'

export const bulletRevealSchema = z.object({
  heading: z.string(),
  bullets: z.array(z.string()),
  theme: z.enum(['dark', 'light', 'neon', 'paper', 'brutal']),
  durationInFrames: z.number(),
  staggerFrames: z.number().default(18),
})

export type BulletRevealProps = z.infer<typeof bulletRevealSchema>
