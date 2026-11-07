import { describe, it, expect } from 'vitest'
import {
  createCalendarEventSchema,
  updateCalendarEventSchema,
  scheduleTaskTimeblockSchema,
} from '@/lib/validations/calendar'

describe('Calendar Event Validation', () => {
  const validEvent = {
    title: 'Sprint Planning',
    event_type: 'meeting',
    start_time: '2026-10-28T09:00:00.000Z',
    end_time: '2026-10-28T10:00:00.000Z',
    timezone: 'America/New_York',
    location: 'Conference Room A',
    meeting_url: 'https://meet.google.com/abc-defg-hij',
    description: 'Weekly team sprint planning and backlog refinement.',
    agenda: '1. Review progress\n2. Plan deliverables\n3. Assign tasks',
    attendees: [
      { name: 'Alice Smith', email: 'alice@example.com' },
      { name: 'Bob Jones', email: 'bob@example.com' },
    ],
    project_id: '11111111-1111-4111-a111-111111111111',
    task_id: '22222222-2222-4222-a222-222222222222',
  }

  it('validates a complete calendar event payload', () => {
    const result = createCalendarEventSchema.safeParse(validEvent)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('Sprint Planning')
      expect(result.data.event_type).toBe('meeting')
      expect(result.data.project_id).toBe('11111111-1111-4111-a111-111111111111')
      expect(result.data.task_id).toBe('22222222-2222-4222-a222-222222222222')
      expect(result.data.attendees).toHaveLength(2)
    }
  })

  it('rejects an event where end_time is before or equal to start_time', () => {
    const invalidEndTime = {
      ...validEvent,
      start_time: '2026-10-28T10:00:00.000Z',
      end_time: '2026-10-28T09:00:00.000Z',
    }
    const result = createCalendarEventSchema.safeParse(invalidEndTime)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('after start time')
    }

    const equalTimes = {
      ...validEvent,
      start_time: '2026-10-28T10:00:00.000Z',
      end_time: '2026-10-28T10:00:00.000Z',
    }
    const equalResult = createCalendarEventSchema.safeParse(equalTimes)
    expect(equalResult.success).toBe(false)
  })

  it('validates all supported calendar event types', () => {
    const types = ['meeting', 'appointment', 'focus_block', 'reminder_block', 'external'] as const
    for (const t of types) {
      const res = createCalendarEventSchema.safeParse({
        ...validEvent,
        event_type: t,
      })
      expect(res.success).toBe(true)
    }

    const invalidType = createCalendarEventSchema.safeParse({
      ...validEvent,
      event_type: 'invalid_type',
    })
    expect(invalidType.success).toBe(false)
  })

  it('validates meeting URLs with valid protocol', () => {
    const validUrlEvent = {
      ...validEvent,
      meeting_url: 'https://zoom.us/j/123456789',
    }
    expect(createCalendarEventSchema.safeParse(validUrlEvent).success).toBe(true)

    const invalidUrlEvent = {
      ...validEvent,
      meeting_url: 'not-a-valid-url',
    }
    expect(createCalendarEventSchema.safeParse(invalidUrlEvent).success).toBe(false)
  })

  it('accepts optional nullable project_id and task_id', () => {
    const standaloneEvent = {
      title: 'Doctor Appointment',
      event_type: 'appointment',
      start_time: '2026-10-28T14:00:00.000Z',
      end_time: '2026-10-28T15:00:00.000Z',
      timezone: 'UTC',
      project_id: null,
      task_id: null,
    }
    const result = createCalendarEventSchema.safeParse(standaloneEvent)
    expect(result.success).toBe(true)
  })

  it('validates updateCalendarEventSchema with ID', () => {
    const updatePayload = {
      id: '33333333-3333-4333-a333-333333333333',
      title: 'Updated Title',
      start_time: '2026-10-28T11:00:00.000Z',
      end_time: '2026-10-28T12:00:00.000Z',
    }
    const result = updateCalendarEventSchema.safeParse(updatePayload)
    expect(result.success).toBe(true)
  })

  it('validates scheduleTaskTimeblockSchema', () => {
    const validSchedule = {
      taskId: '22222222-2222-4222-a222-222222222222',
      scheduled_start_at: '2026-10-28T13:00:00.000Z',
      scheduled_end_at: '2026-10-28T15:00:00.000Z',
    }
    const result = scheduleTaskTimeblockSchema.safeParse(validSchedule)
    expect(result.success).toBe(true)

    const invalidSchedule = {
      taskId: '22222222-2222-4222-a222-222222222222',
      scheduled_start_at: '2026-10-28T15:00:00.000Z',
      scheduled_end_at: '2026-10-28T13:00:00.000Z',
    }
    const invalidResult = scheduleTaskTimeblockSchema.safeParse(invalidSchedule)
    expect(invalidResult.success).toBe(false)
  })
})
