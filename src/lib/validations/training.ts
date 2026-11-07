import { z } from 'zod'

export const courseStatusEnum = z.enum([
  'planned',
  'active',
  'paused',
  'completed',
  'archived',
])

export const createCourseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Course title is required')
    .max(255, 'Course title is too long'),
  description: z.string().trim().optional().nullable(),
  provider: z.string().trim().max(255).optional().nullable(),
  category: z.string().trim().max(100).optional().nullable(),
  target_hours: z
    .number()
    .min(0, 'Target hours cannot be negative')
    .max(999, 'Target hours too large')
    .optional()
    .nullable(),
  status: courseStatusEnum.default('planned'),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  personal_notes: z.string().trim().optional().nullable(),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return new Date(data.end_date) >= new Date(data.start_date)
    }
    return true
  },
  {
    message: 'End date cannot be earlier than start date',
    path: ['end_date'],
  }
)

export const updateCourseSchema = z.object({
  id: z.string().uuid('Invalid course ID'),
  title: z.string().trim().min(1, 'Course title is required').max(255).optional(),
  description: z.string().trim().optional().nullable(),
  provider: z.string().trim().max(255).optional().nullable(),
  category: z.string().trim().max(100).optional().nullable(),
  target_hours: z.number().min(0).max(999).optional().nullable(),
  status: courseStatusEnum.optional(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  personal_notes: z.string().trim().optional().nullable(),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return new Date(data.end_date) >= new Date(data.start_date)
    }
    return true
  },
  {
    message: 'End date cannot be earlier than start date',
    path: ['end_date'],
  }
)

export const checklistTemplateItemSchema = z.object({
  id: z.string().uuid().optional(),
  task_title: z.string().trim().min(1, 'Item title is required').max(255),
  estimated_duration_minutes: z.number().min(1).max(1440).default(15),
  sort_order: z.number().int().default(0),
  is_mandatory: z.boolean().default(true),
  due_offset_days: z.number().int().min(-30).max(180).default(0),
  relative_to: z.string().default('session_start'),
  is_archived: z.boolean().default(false),
})

export const saveChecklistTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  course_id: z.string().uuid('Invalid course ID'),
  template_name: z
    .string()
    .trim()
    .min(1, 'Template name is required')
    .max(255, 'Template name is too long'),
  description: z.string().trim().optional().nullable(),
  is_archived: z.boolean().default(false),
  items: z.array(checklistTemplateItemSchema).default([]),
})

export const sessionStatusEnum = z.enum([
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
])

export const createTrainingSessionSchema = z.object({
  course_id: z.string().uuid('Invalid course ID'),
  template_id: z.string().uuid('Invalid template ID').optional().nullable(),
  session_title: z
    .string()
    .trim()
    .min(1, 'Session title is required')
    .max(255),
  scheduled_start: z.string().datetime({ message: 'Valid start datetime is required' }),
  scheduled_end: z.string().datetime().optional().nullable(),
  timezone: z.string().default('UTC'),
  actual_duration_minutes: z.number().int().min(0).max(1440).optional().nullable(),
  status: sessionStatusEnum.default('scheduled'),
  notes: z.string().trim().optional().nullable(),
  location: z.string().trim().max(255).optional().nullable(),
  meeting_url: z.string().trim().url('Invalid meeting URL').or(z.literal('')).optional().nullable(),
  sync_to_calendar: z.boolean().default(false),
  generate_tasks: z.boolean().default(false),
}).refine(
  (data) => {
    if (data.scheduled_start && data.scheduled_end) {
      return new Date(data.scheduled_end) > new Date(data.scheduled_start)
    }
    return true
  },
  {
    message: 'Session end time must be after start time',
    path: ['scheduled_end'],
  }
)

export const updateTrainingSessionSchema = z.object({
  id: z.string().uuid('Invalid session ID'),
  course_id: z.string().uuid().optional(),
  template_id: z.string().uuid().optional().nullable(),
  session_title: z.string().trim().min(1).max(255).optional(),
  scheduled_start: z.string().datetime().optional(),
  scheduled_end: z.string().datetime().optional().nullable(),
  timezone: z.string().optional(),
  actual_duration_minutes: z.number().int().min(0).max(1440).optional().nullable(),
  status: sessionStatusEnum.optional(),
  notes: z.string().trim().optional().nullable(),
  location: z.string().trim().max(255).optional().nullable(),
  meeting_url: z.string().trim().url('Invalid meeting URL').or(z.literal('')).optional().nullable(),
}).refine(
  (data) => {
    if (data.scheduled_start && data.scheduled_end) {
      return new Date(data.scheduled_end) > new Date(data.scheduled_start)
    }
    return true
  },
  {
    message: 'Session end time must be after start time',
    path: ['scheduled_end'],
  }
)

export const generateSessionTasksSchema = z.object({
  session_id: z.string().uuid('Invalid session ID'),
  course_id: z.string().uuid('Invalid course ID'),
  template_id: z.string().uuid('Invalid template ID'),
})

export type CreateCourseInput = z.infer<typeof createCourseSchema>
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>
export type SaveChecklistTemplateInput = z.infer<typeof saveChecklistTemplateSchema>
export type ChecklistTemplateItemInput = z.infer<typeof checklistTemplateItemSchema>
export type CreateTrainingSessionInput = z.infer<typeof createTrainingSessionSchema>
export type UpdateTrainingSessionInput = z.infer<typeof updateTrainingSessionSchema>
export type GenerateSessionTasksInput = z.infer<typeof generateSessionTasksSchema>

