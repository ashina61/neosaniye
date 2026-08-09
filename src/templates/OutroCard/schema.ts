import { z } from 'zod'

export const outroCardSchema = z.object({
  cta: z.string(),
  handle: z.string(),
  theme: z.enum(['dark', 'light', 'neon', 'paper', 'brutal']),
  durationInFrames: z.number(),
  showProgressBar: z.boolean().default(true),
})

export type OutroCardProps = z.infer<typeof outroCardSchema>
