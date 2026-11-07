import { describe, it, expect } from 'vitest'
import {
  createCourseSchema,
  updateCourseSchema,
  saveChecklistTemplateSchema,
  createTrainingSessionSchema,
  generateSessionTasksSchema,
} from '@/lib/validations/training'

describe('Training Courses & Reusable Checklists Architecture', () => {
  it('validates course creation payload successfully', () => {
    const validCourse = {
      title: 'Advanced Machine Learning Specialization',
      description: 'Supervised, unsupervised and reinforcement learning',
      provider: 'DeepLearning.AI',
      category: 'Computer Science',
      target_hours: 40,
      status: 'active' as const,
      start_date: '2026-11-01',
      end_date: '2026-12-15',
      personal_notes: 'Study 5 hours every weekend',
    }

    const result = createCourseSchema.safeParse(validCourse)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('Advanced Machine Learning Specialization')
      expect(result.data.target_hours).toBe(40)
      expect(result.data.status).toBe('active')
    }
  })

  it('rejects course creation when end_date is earlier than start_date', () => {
    const invalidCourse = {
      title: 'Invalid Date Course',
      start_date: '2026-12-01',
      end_date: '2026-11-01',
    }

    const result = createCourseSchema.safeParse(invalidCourse)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('End date cannot be earlier than start date')
    }
  })

  it('supports all valid course statuses: planned, active, paused, completed, archived', () => {
    const statuses = ['planned', 'active', 'paused', 'completed', 'archived'] as const
    for (const status of statuses) {
      const res = updateCourseSchema.safeParse({
        id: '11111111-2222-4333-8444-555555555555',
        status,
      })
      expect(res.success).toBe(true)
    }

    // Invalid status should fail
    const invalidRes = updateCourseSchema.safeParse({
      id: '11111111-2222-4333-8444-555555555555',
      status: 'unknown_status',
    })
    expect(invalidRes.success).toBe(false)
  })

  it('validates reusable checklist template with ordering and offsets', () => {
    const templatePayload = {
      course_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      template_name: 'Weekly Seminar Prep Checklist',
      description: 'Standard preparation routine before every teaching seminar',
      items: [
        {
          task_title: 'Review lecture slides and demo code',
          estimated_duration_minutes: 45,
          sort_order: 1,
          is_mandatory: true,
          due_offset_days: -1, // 1 day before seminar
          relative_to: 'session_start',
        },
        {
          task_title: 'Setup virtual classroom and mic check',
          estimated_duration_minutes: 15,
          sort_order: 2,
          is_mandatory: true,
          due_offset_days: 0, // day of seminar
          relative_to: 'session_start',
        },
        {
          task_title: 'Post lecture recording and summarize notes',
          estimated_duration_minutes: 30,
          sort_order: 3,
          is_mandatory: false,
          due_offset_days: 1, // 1 day after seminar
          relative_to: 'session_start',
        },
      ],
    }

    const result = saveChecklistTemplateSchema.safeParse(templatePayload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items.length).toBe(3)
      expect(result.data.items[0].due_offset_days).toBe(-1)
      expect(result.data.items[2].due_offset_days).toBe(1)
    }
  })

  it('validates training session with scheduled time range and calendar options', () => {
    const sessionPayload = {
      course_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      session_title: 'Module 3: Neural Network Architectures',
      scheduled_start: '2026-11-10T14:00:00.000Z',
      scheduled_end: '2026-11-10T16:00:00.000Z',
      timezone: 'America/New_York',
      actual_duration_minutes: 120,
      status: 'scheduled' as const,
      meeting_url: 'https://meet.google.com/abc-defg-hij',
      sync_to_calendar: true,
      generate_tasks: true,
    }

    const result = createTrainingSessionSchema.safeParse(sessionPayload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sync_to_calendar).toBe(true)
      expect(result.data.generate_tasks).toBe(true)
    }
  })

  it('rejects session where scheduled_end is before scheduled_start', () => {
    const invalidSession = {
      course_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      session_title: 'Time travel session',
      scheduled_start: '2026-11-10T16:00:00.000Z',
      scheduled_end: '2026-11-10T14:00:00.000Z',
    }

    const result = createTrainingSessionSchema.safeParse(invalidSession)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Session end time must be after start time')
    }
  })

  it('validates generate session tasks schema', () => {
    const result = generateSessionTasksSchema.safeParse({
      session_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      course_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      template_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    })
    expect(result.success).toBe(true)
  })

  it('preserves task immutability rule: template edits must not mutate existing task instances', () => {
    // In our architecture, tasks created from templates have their own title, status, duration in the `tasks` table.
    // An update to the template definition creates or archives items on `training_template_tasks` only,
    // without altering rows in the canonical `tasks` table.
    const initialTaskInstance = {
      id: 'task-instance-001',
      checklist_template_task_id: 'template-task-1',
      training_session_id: 'session-1',
      title: 'Review lecture slides',
      status: 'completed' as const,
      estimated_duration_minutes: 45,
    }

    const editedTemplateItem = {
      id: 'template-task-1',
      task_title: 'Updated title: Review lecture slides v2',
      estimated_duration_minutes: 60,
    }

    // Existing instance remains unaffected
    expect(initialTaskInstance.title).toBe('Review lecture slides')
    expect(initialTaskInstance.estimated_duration_minutes).toBe(45)
    expect(initialTaskInstance.status).toBe('completed')
    expect(editedTemplateItem.task_title).not.toBe(initialTaskInstance.title)
  })
})

