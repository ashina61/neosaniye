import { z } from 'zod'

export const listRaceSchema = z.object({
  items: z.array(
    z.object({
      label: z.string(),
      value: z.number().optional(),
    })
  ),
  theme: z.enum(['dark', 'light', 'neon', 'paper', 'brutal']),
  durationInFrames: z.number(),
  title: z.string().optional(),
})

export type ListRaceProps = z.infer<typeof listRaceSchema>
