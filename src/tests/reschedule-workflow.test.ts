import { describe, it, expect } from 'vitest'
import { rescheduleTaskSchema, batchRescheduleSchema } from '@/lib/validations/tasks'

describe('Rescheduling Workflows & History Audit Validation', () => {
  it('validates single task reschedule payload', () => {
    const valid = {
      taskId: 'a1b2c3d4-e5f6-4a1b-9c2d-3e4f5a6b7c8d',
      newDeadline: '2026-10-29T18:00:00.000Z',
      newScheduledStart: '2026-10-29T09:00:00.000Z',
      newScheduledEnd: '2026-10-29T10:00:00.000Z',
      reason: 'Moved forward due to client calendar conflict',
    }
    const parsed = rescheduleTaskSchema.safeParse(valid)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.taskId).toBe('a1b2c3d4-e5f6-4a1b-9c2d-3e4f5a6b7c8d')
      expect(parsed.data.reason).toBe('Moved forward due to client calendar conflict')
    }
  })

  it('rejects invalid UUID in single reschedule request', () => {
    const invalid = {
      taskId: 'not-a-uuid',
      newDeadline: '2026-10-29T18:00:00.000Z',
    }
    const parsed = rescheduleTaskSchema.safeParse(invalid)
    expect(parsed.success).toBe(false)
  })

  it('validates batch reschedule payload with minimum one task', () => {
    const valid = {
      taskIds: [
        'a1b2c3d4-e5f6-4a1b-9c2d-3e4f5a6b7c8d',
        'b2c3d4e5-f6a1-4b2c-8d3e-4f5a6b7c8d9e',
      ],
      daysForward: 1,
      reason: 'Batch reschedule overdue tasks',
    }
    const parsed = batchRescheduleSchema.safeParse(valid)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.taskIds.length).toBe(2)
      expect(parsed.data.daysForward).toBe(1)
    }
  })

  it('rejects empty taskIds in batch reschedule request', () => {
    const empty = {
      taskIds: [],
      daysForward: 1,
    }
    const parsed = batchRescheduleSchema.safeParse(empty)
    expect(parsed.success).toBe(false)
  })

  it('restricts batch days forward between 1 and 30', () => {
    const invalidDays = {
      taskIds: ['a1b2c3d4-e5f6-4a1b-9c2d-3e4f5a6b7c8d'],
      daysForward: 0,
    }
    expect(batchRescheduleSchema.safeParse(invalidDays).success).toBe(false)

    const tooFar = {
      taskIds: ['a1b2c3d4-e5f6-4a1b-9c2d-3e4f5a6b7c8d'],
      daysForward: 31,
    }
    expect(batchRescheduleSchema.safeParse(tooFar).success).toBe(false)
  })
})

