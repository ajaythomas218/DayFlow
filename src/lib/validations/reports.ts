import { z } from 'zod'

export const reportsFilterSchema = z
  .object({
    preset: z.enum(['this_week', 'last_week', 'this_month', 'last_month', 'custom']).default('this_week'),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
    project_id: z.string().uuid().or(z.literal('all')).optional().default('all'),
  })
  .refine(
    (data) => {
      if (data.preset === 'custom') {
        if (!data.start_date || !data.end_date) return false
        return data.start_date <= data.end_date
      }
      return true
    },
    {
      message: 'Custom range requires valid start_date <= end_date',
      path: ['end_date'],
    }
  )

export type ReportsFilterInput = z.input<typeof reportsFilterSchema>
export type ReportsFilterOutput = z.output<typeof reportsFilterSchema>
