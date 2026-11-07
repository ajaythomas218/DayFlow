import { z } from 'zod'

export const taskStatusEnum = z.enum(['todo', 'in_progress', 'completed', 'cancelled'])
export const taskPriorityEnum = z.enum(['p1', 'p2', 'p3', 'p4'])

export const createTaskSchema = z
  .object({
    title: z.string().trim().min(1, 'Task title is required').max(200, 'Title cannot exceed 200 characters'),
    description: z.string().trim().max(3000, 'Description cannot exceed 3000 characters').optional().nullable(),
    project_id: z.string().uuid('Invalid project ID').optional().nullable(),
    parent_task_id: z.string().uuid('Invalid parent task ID').optional().nullable(),
    status: taskStatusEnum.default('todo'),
    priority: taskPriorityEnum.default('p3'),
    deadline_at: z.string().datetime({ offset: true }).optional().nullable(),
    scheduled_start_at: z.string().datetime({ offset: true }).optional().nullable(),
    scheduled_end_at: z.string().datetime({ offset: true }).optional().nullable(),
    is_time_blocked: z.boolean().default(false),
    estimated_duration_minutes: z.number().int().positive('Duration must be greater than 0').optional().nullable(),
    recurrence_rule: z.string().trim().max(300).optional().nullable(),
    recurrence_parent_id: z.string().uuid().optional().nullable(),
    dependency_ids: z.array(z.string().uuid()).optional(),
    reminders: z
      .array(
        z.object({
          id: z.string().uuid().optional(),
          offset_minutes: z.number().int().min(0).max(43200),
          is_relative_to_start: z.boolean().default(true),
          channel: z.enum(['in_app', 'web_push', 'email']).default('in_app'),
          is_active: z.boolean().default(true),
        })
      )
      .optional(),
    sync_with_google: z.boolean().optional().nullable(),
  })
  .refine(
    (data) => {
      // Constraint: both null OR both set with scheduled_end_at > scheduled_start_at
      if (!data.scheduled_start_at && !data.scheduled_end_at) return true
      if (data.scheduled_start_at && data.scheduled_end_at) {
        return new Date(data.scheduled_end_at).getTime() > new Date(data.scheduled_start_at).getTime()
      }
      return false
    },
    {
      message: 'Scheduled end time must be after scheduled start time, and both must be provided together',
      path: ['scheduled_end_at'],
    }
  )

export const updateTaskSchema = z
  .object({
    id: z.string().uuid('Invalid task ID'),
    title: z.string().trim().min(1, 'Task title is required').max(200).optional(),
    description: z.string().trim().max(3000).optional().nullable(),
    project_id: z.string().uuid().optional().nullable(),
    parent_task_id: z.string().uuid().optional().nullable(),
    status: taskStatusEnum.optional(),
    priority: taskPriorityEnum.optional(),
    deadline_at: z.string().datetime({ offset: true }).optional().nullable(),
    scheduled_start_at: z.string().datetime({ offset: true }).optional().nullable(),
    scheduled_end_at: z.string().datetime({ offset: true }).optional().nullable(),
    is_time_blocked: z.boolean().optional(),
    estimated_duration_minutes: z.number().int().positive().optional().nullable(),
    completed_at: z.string().datetime({ offset: true }).optional().nullable(),
    recurrence_rule: z.string().trim().max(300).optional().nullable(),
    recurrence_parent_id: z.string().uuid().optional().nullable(),
    dependency_ids: z.array(z.string().uuid()).optional(),
    reminders: z
      .array(
        z.object({
          id: z.string().uuid().optional(),
          offset_minutes: z.number().int().min(0).max(43200),
          is_relative_to_start: z.boolean().default(true),
          channel: z.enum(['in_app', 'web_push', 'email']).default('in_app'),
          is_active: z.boolean().default(true),
        })
      )
      .optional(),
    sync_with_google: z.boolean().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.scheduled_start_at === undefined && data.scheduled_end_at === undefined) return true
      if (!data.scheduled_start_at && !data.scheduled_end_at) return true
      if (data.scheduled_start_at && data.scheduled_end_at) {
        return new Date(data.scheduled_end_at).getTime() > new Date(data.scheduled_start_at).getTime()
      }
      return false
    },
    {
      message: 'Scheduled end time must be after scheduled start time, and both must be provided together',
      path: ['scheduled_end_at'],
    }
  )

export const rescheduleTaskSchema = z.object({
  taskId: z.string().uuid('Invalid task ID'),
  newDeadline: z.string().datetime({ offset: true }).optional().nullable(),
  newScheduledStart: z.string().datetime({ offset: true }).optional().nullable(),
  newScheduledEnd: z.string().datetime({ offset: true }).optional().nullable(),
  reason: z.string().trim().max(300).optional().nullable(),
})

export const batchRescheduleSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1, 'At least one task must be selected'),
  daysForward: z.number().int().min(1).max(30).default(1),
  reason: z.string().trim().default('Rescheduled to tomorrow'),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
export type RescheduleTaskInput = z.infer<typeof rescheduleTaskSchema>
export type BatchRescheduleInput = z.infer<typeof batchRescheduleSchema>

