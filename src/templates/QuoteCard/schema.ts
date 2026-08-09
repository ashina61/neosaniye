import { z } from 'zod'

export const quoteCardSchema = z.object({
  quote: z.string(),
  name: z.string(),
  title: z.string().optional(),
  theme: z.enum(['dark', 'light', 'neon', 'paper', 'brutal']),
  durationInFrames: z.number(),
})

export type QuoteCardProps = z.infer<typeof quoteCardSchema>
