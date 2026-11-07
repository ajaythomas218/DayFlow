import { describe, it, expect } from 'vitest'
import { createTaskSchema, updateTaskSchema } from '@/lib/validations/tasks'

describe('Task Validation & Date/Time Separation', () => {
  it('validates a standard task creation payload with deadline', () => {
    const valid = {
      title: 'Audit Postgres Row Level Security',
      description: 'Ensure all policies evaluate auth.uid() correctly',
      status: 'todo',
      priority: 'p1',
      deadline_at: '2026-10-28T18:00:00.000Z',
    }
    const parsed = createTaskSchema.safeParse(valid)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.title).toBe('Audit Postgres Row Level Security')
      expect(parsed.data.priority).toBe('p1')
      expect(parsed.data.is_time_blocked).toBe(false)
    }
  })

  it('rejects an empty or whitespace-only task title', () => {
    const invalid = {
      title: '   ',
      status: 'todo',
      priority: 'p2',
    }
    const parsed = createTaskSchema.safeParse(invalid)
    expect(parsed.success).toBe(false)
  })

  it('enforces scheduled start and end must be provided together', () => {
    // Only scheduled_start provided -> should fail
    const onlyStart = {
      title: 'Timeblock Test',
      scheduled_start_at: '2026-10-28T09:00:00.000Z',
    }
    const parsedStart = createTaskSchema.safeParse(onlyStart)
    expect(parsedStart.success).toBe(false)

    // Only scheduled_end provided -> should fail
    const onlyEnd = {
      title: 'Timeblock Test',
      scheduled_end_at: '2026-10-28T10:00:00.000Z',
    }
    const parsedEnd = createTaskSchema.safeParse(onlyEnd)
    expect(parsedEnd.success).toBe(false)
  })

  it('enforces scheduled end time strictly after scheduled start time', () => {
    // End before start -> should fail
    const endBeforeStart = {
      title: 'Invalid Order',
      scheduled_start_at: '2026-10-28T11:00:00.000Z',
      scheduled_end_at: '2026-10-28T10:00:00.000Z',
    }
    const parsedInvalid = createTaskSchema.safeParse(endBeforeStart)
    expect(parsedInvalid.success).toBe(false)

    // Equal times -> should fail
    const equalTimes = {
      title: 'Equal Times',
      scheduled_start_at: '2026-10-28T10:00:00.000Z',
      scheduled_end_at: '2026-10-28T10:00:00.000Z',
    }
    const parsedEqual = createTaskSchema.safeParse(equalTimes)
    expect(parsedEqual.success).toBe(false)

    // End after start -> should succeed
    const validTimeblock = {
      title: 'Focus Sprint',
      scheduled_start_at: '2026-10-28T09:00:00.000Z',
      scheduled_end_at: '2026-10-28T10:30:00.000Z',
      is_time_blocked: true,
    }
    const parsedValid = createTaskSchema.safeParse(validTimeblock)
    expect(parsedValid.success).toBe(true)
  })

  it('keeps deadline semantically distinct from scheduled timeblock', () => {
    // A task can have a scheduled time slot at 9 AM and a deadline at 5 PM on the same day
    const combined = {
      title: 'Client Review Preparation',
      scheduled_start_at: '2026-10-28T09:00:00.000Z',
      scheduled_end_at: '2026-10-28T10:00:00.000Z',
      deadline_at: '2026-10-28T17:00:00.000Z',
      is_time_blocked: true,
    }
    const parsed = createTaskSchema.safeParse(combined)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.deadline_at).toBe('2026-10-28T17:00:00.000Z')
      expect(parsed.data.scheduled_start_at).toBe('2026-10-28T09:00:00.000Z')
      expect(parsed.data.scheduled_end_at).toBe('2026-10-28T10:00:00.000Z')
    }
  })

  it('validates priority enums p1 through p4', () => {
    const priorities = ['p1', 'p2', 'p3', 'p4'] as const
    for (const priority of priorities) {
      const parsed = createTaskSchema.safeParse({
        title: 'Priority Test',
        priority,
      })
      expect(parsed.success).toBe(true)
    }

    const invalid = createTaskSchema.safeParse({
      title: 'Priority Test',
      priority: 'p5',
    })
    expect(invalid.success).toBe(false)
  })

  it('validates status enums todo, in_progress, completed, cancelled', () => {
    const statuses = ['todo', 'in_progress', 'completed', 'cancelled'] as const
    for (const status of statuses) {
      const parsed = createTaskSchema.safeParse({
        title: 'Status Test',
        status,
      })
      expect(parsed.success).toBe(true)
    }

    const invalid = createTaskSchema.safeParse({
      title: 'Status Test',
      status: 'archived', // archived is for projects, not tasks
    })
    expect(invalid.success).toBe(false)
  })

  it('validates parent-child relationships with valid UUIDs', () => {
    const subtask = {
      title: 'Write subtask test unit',
      parent_task_id: 'a1b2c3d4-e5f6-4a1b-9c2d-3e4f5a6b7c8d',
    }
    const parsed = createTaskSchema.safeParse(subtask)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.parent_task_id).toBe('a1b2c3d4-e5f6-4a1b-9c2d-3e4f5a6b7c8d')
    }
  })

  it('validates updateTaskSchema partial fields with UUID id', () => {
    const update = {
      id: 'a1b2c3d4-e5f6-4a1b-9c2d-3e4f5a6b7c8d',
      status: 'in_progress',
      priority: 'p1',
    }
    const parsed = updateTaskSchema.safeParse(update)
    expect(parsed.success).toBe(true)
  })
})
