import { z } from 'zod'

export const saveWeeklyReviewSchema = z.object({
  week_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Week start date must be YYYY-MM-DD'),
  reflection_content: z.string().trim().optional().nullable(),
  wins: z.string().trim().optional().nullable(),
  challenges: z.string().trim().optional().nullable(),
  lessons_learned: z.string().trim().optional().nullable(),
  next_week_priorities: z.string().trim().optional().nullable(),
})

export const getWeeklyReviewSchema = z.object({
  week_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Week start date must be YYYY-MM-DD'),
})

export type SaveWeeklyReviewInput = z.infer<typeof saveWeeklyReviewSchema>
export type GetWeeklyReviewInput = z.infer<typeof getWeeklyReviewSchema>

