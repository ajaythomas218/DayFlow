import { z } from 'zod'

export const studentReviewStatusEnum = z.enum([
  'awaiting_review',
  'in_review',
  'feedback_ready',
  'completed',
  'pending',
  'needs_follow_up',
])

export const createStudentReviewSchema = z.object({
  student_identifier: z
    .string()
    .trim()
    .min(1, 'Student identifier is required')
    .max(120, 'Student identifier is too long'),
  assignment_title: z
    .string()
    .trim()
    .min(1, 'Assignment title is required')
    .max(255, 'Assignment title is too long'),
  course_id: z.string().uuid('Invalid course ID').optional().nullable(),
  submission_date: z.string().datetime({ message: 'Valid submission date required' }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  status: studentReviewStatusEnum.default('awaiting_review'),
  feedback_notes: z.string().trim().optional().nullable(),
  score_or_grade: z.string().trim().max(50).optional().nullable(),
  reviewed_at: z.string().datetime().optional().nullable(),
  follow_up_due_at: z.string().datetime().optional().nullable(),
  external_risk_check_prompted: z.boolean().default(false),
  external_system_link: z.string().trim().url('Invalid link URL').or(z.literal('')).optional().nullable(),
})

export const updateStudentReviewSchema = z.object({
  id: z.string().uuid('Invalid review ID'),
  student_identifier: z.string().trim().min(1).max(120).optional(),
  assignment_title: z.string().trim().min(1).max(255).optional(),
  course_id: z.string().uuid().optional().nullable(),
  submission_date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  status: studentReviewStatusEnum.optional(),
  feedback_notes: z.string().trim().optional().nullable(),
  score_or_grade: z.string().trim().max(50).optional().nullable(),
  reviewed_at: z.string().datetime().optional().nullable(),
  follow_up_due_at: z.string().datetime().optional().nullable(),
  external_risk_check_prompted: z.boolean().optional(),
  external_system_link: z.string().trim().url('Invalid link URL').or(z.literal('')).optional().nullable(),
})

export const createReviewFollowUpTaskSchema = z.object({
  review_id: z.string().uuid('Invalid review ID'),
  title: z.string().trim().min(1, 'Task title is required').max(255),
  deadline_at: z.string().datetime().optional().nullable(),
  priority: z.enum(['p1', 'p2', 'p3', 'p4']).default('p2'),
  description: z.string().trim().optional().nullable(),
})

export const configureExternalRiskReminderSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']),
  time_of_day: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format (e.g. 09:00)'),
  enabled: z.boolean().default(true),
})

export type CreateStudentReviewInput = z.infer<typeof createStudentReviewSchema>
export type UpdateStudentReviewInput = z.infer<typeof updateStudentReviewSchema>
export type CreateReviewFollowUpTaskInput = z.infer<typeof createReviewFollowUpTaskSchema>
export type ConfigureExternalRiskReminderInput = z.infer<typeof configureExternalRiskReminderSchema>

