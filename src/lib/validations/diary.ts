import { z } from 'zod'

export const dateStringRegex = /^\d{4}-\d{2}-\d{2}$/

export const saveDiaryEntrySchema = z.object({
  entry_date: z
    .string()
    .regex(dateStringRegex, 'Date must be formatted as YYYY-MM-DD'),
  morning_intentions: z
    .string()
    .trim()
    .max(2000, 'Morning intention cannot exceed 2000 characters')
    .optional()
    .nullable(),
  journal_content: z
    .string()
    .trim()
    .max(10000, 'Journal notes cannot exceed 10000 characters')
    .optional()
    .nullable(),
  evening_reflection: z
    .string()
    .trim()
    .max(5000, 'Evening reflection cannot exceed 5000 characters')
    .optional()
    .nullable(),
  wins: z
    .string()
    .trim()
    .max(3000, 'Wins cannot exceed 3000 characters')
    .optional()
    .nullable(),
  challenges: z
    .string()
    .trim()
    .max(3000, 'Challenges cannot exceed 3000 characters')
    .optional()
    .nullable(),
  lessons_learned: z
    .string()
    .trim()
    .max(3000, 'Lessons learned cannot exceed 3000 characters')
    .optional()
    .nullable(),
  tomorrow_plan: z
    .string()
    .trim()
    .max(3000, "Tomorrow's plan cannot exceed 3000 characters")
    .optional()
    .nullable(),
  energy_level: z
    .number()
    .int()
    .min(1, 'Energy level must be between 1 and 5')
    .max(5, 'Energy level must be between 1 and 5')
    .optional()
    .nullable(),
  mood_rating: z
    .number()
    .int()
    .min(1, 'Mood rating must be between 1 and 5')
    .max(5, 'Mood rating must be between 1 and 5')
    .optional()
    .nullable(),
})

export const toggleFocusTaskSchema = z.object({
  entry_date: z.string().regex(dateStringRegex, 'Date must be formatted as YYYY-MM-DD'),
  task_id: z.string().uuid('Invalid task ID'),
  is_focus_task: z.boolean(),
  reflection_note: z.string().trim().max(1000).optional().nullable(),
})

export type SaveDiaryEntryInput = z.infer<typeof saveDiaryEntrySchema>
export type ToggleFocusTaskInput = z.infer<typeof toggleFocusTaskSchema>

