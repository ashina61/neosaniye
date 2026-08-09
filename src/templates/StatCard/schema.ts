import { z } from 'zod'

export const statCardSchema = z.object({
  label: z.string(),
  stat: z.number(),
  unit: z.string().optional(),
  theme: z.enum(['dark', 'light', 'neon', 'paper', 'brutal']),
  durationInFrames: z.number(),
  format: z.enum(['integer', 'decimal', 'currency', 'percent']).default('integer'),
})

export type StatCardProps = z.infer<typeof statCardSchema>
