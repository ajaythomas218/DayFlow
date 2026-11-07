import { z } from 'zod'

export const projectStatusEnum = z.enum(['backlog', 'active', 'on_hold', 'completed', 'archived'])

export const createProjectSchema = z.object({
  title: z.string().trim().min(1, 'Project title is required').max(120, 'Title cannot exceed 120 characters'),
  description: z.string().trim().max(1000, 'Description cannot exceed 1000 characters').optional().nullable(),
  color_hex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid 6-character hex code (e.g. #8B7CFF)')
    .default('#8B7CFF'),
  status: projectStatusEnum.default('active'),
  target_completion_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Target date must be formatted YYYY-MM-DD')
    .optional()
    .nullable(),
})

export const updateProjectSchema = createProjectSchema.partial().extend({
  id: z.string().uuid('Invalid project ID'),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>

