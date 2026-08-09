import { z } from 'zod'

export const titleCardSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  theme: z.enum(['dark', 'light', 'neon', 'paper', 'brutal']),
  durationInFrames: z.number(),
  enterDuration: z.number().default(20),
})

export type TitleCardProps = z.infer<typeof titleCardSchema>
