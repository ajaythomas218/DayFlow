import { z } from 'zod'

export const calendarEventTypeEnum = z.enum([
  'meeting',
  'appointment',
  'focus_block',
  'reminder_block',
  'external',
])

export type CalendarEventType = z.infer<typeof calendarEventTypeEnum>

export const attendeeSchema = z.object({
  email: z.string().email('Invalid attendee email address'),
  name: z.string().trim().max(100).optional(),
  status: z.enum(['accepted', 'declined', 'tentative', 'needs_action']).default('needs_action'),
})

export const createCalendarEventSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
    description: z.string().trim().max(5000, 'Description cannot exceed 5000 characters').optional().nullable(),
    event_type: calendarEventTypeEnum.default('meeting'),
    start_time: z.string().datetime({ offset: true, message: 'Invalid start time format' }),
    end_time: z.string().datetime({ offset: true, message: 'Invalid end time format' }),
    is_all_day: z.boolean().default(false),
    location: z.string().trim().max(300).optional().nullable(),
    meeting_url: z
      .string()
      .trim()
      .url('Meeting URL must be a valid web address (e.g. https://meet.google.com/...)')
      .or(z.literal(''))
      .optional()
      .nullable(),
    attendees: z.array(attendeeSchema).default([]),
    recurrence_rule: z.string().trim().max(250).optional().nullable(),
    recurrence_parent_id: z.string().uuid().optional().nullable(),
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
    project_id: z.string().uuid('Invalid project ID').optional().nullable(),
    task_id: z.string().uuid('Invalid task ID').optional().nullable(),
    sync_with_google: z.boolean().optional().nullable(),
  })
  .refine(
    (data) => {
      return new Date(data.end_time).getTime() > new Date(data.start_time).getTime()
    },
    {
      message: 'End time must be strictly after start time',
      path: ['end_time'],
    }
  )

export const updateCalendarEventSchema = z
  .object({
    id: z.string().uuid('Invalid event ID'),
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).optional().nullable(),
    event_type: calendarEventTypeEnum.optional(),
    start_time: z.string().datetime({ offset: true }).optional(),
    end_time: z.string().datetime({ offset: true }).optional(),
    is_all_day: z.boolean().optional(),
    location: z.string().trim().max(300).optional().nullable(),
    meeting_url: z
      .string()
      .trim()
      .url('Meeting URL must be a valid web address')
      .or(z.literal(''))
      .optional()
      .nullable(),
    attendees: z.array(attendeeSchema).optional(),
    recurrence_rule: z.string().trim().max(250).optional().nullable(),
    recurrence_parent_id: z.string().uuid().optional().nullable(),
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
    project_id: z.string().uuid().optional().nullable(),
    task_id: z.string().uuid().optional().nullable(),
    sync_with_google: z.boolean().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.start_time && data.end_time) {
        return new Date(data.end_time).getTime() > new Date(data.start_time).getTime()
      }
      return true
    },
    {
      message: 'End time must be strictly after start time',
      path: ['end_time'],
    }
  )

export const scheduleTaskTimeblockSchema = z
  .object({
    taskId: z.string().uuid('Invalid task ID'),
    scheduled_start_at: z.string().datetime({ offset: true, message: 'Invalid start time format' }),
    scheduled_end_at: z.string().datetime({ offset: true, message: 'Invalid end time format' }),
    is_time_blocked: z.boolean().default(true),
  })
  .refine(
    (data) => new Date(data.scheduled_end_at).getTime() > new Date(data.scheduled_start_at).getTime(),
    {
      message: 'Scheduled end time must be strictly after scheduled start time',
      path: ['scheduled_end_at'],
    }
  )

export type CreateCalendarEventInput = z.infer<typeof createCalendarEventSchema>
export type UpdateCalendarEventInput = z.infer<typeof updateCalendarEventSchema>
export type ScheduleTaskTimeblockInput = z.infer<typeof scheduleTaskTimeblockSchema>
export type Attendee = z.infer<typeof attendeeSchema>
