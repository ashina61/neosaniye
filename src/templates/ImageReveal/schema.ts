import { z } from 'zod'

export const imageRevealSchema = z.object({
  src: z.string(),
  fit: z.enum(['cover', 'contain']).default('cover'),
  caption: z.string().optional(),
  theme: z.enum(['dark', 'light', 'neon', 'paper', 'brutal']),
  durationInFrames: z.number(),
})

export type ImageRevealProps = z.infer<typeof imageRevealSchema>
