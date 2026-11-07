import { describe, it, expect } from 'vitest'
import {
  reminderRuleSchema,
  reminderSettingsSchema,
} from '@/lib/validations/reminders'

describe('Reminder Validation & Schemas', () => {
  it('validates valid reminder rule configurations', () => {
    const validAtStart = {
      offset_minutes: 0,
      is_relative_to_start: true,
      channel: 'in_app' as const,
      is_active: true,
    }
    expect(reminderRuleSchema.safeParse(validAtStart).success).toBe(true)

    const validOneHourBefore = {
      offset_minutes: 60,
      is_relative_to_start: true,
      channel: 'web_push' as const,
      is_active: true,
    }
    expect(reminderRuleSchema.safeParse(validOneHourBefore).success).toBe(true)

    const validDeadlineReminder = {
      offset_minutes: 1440, // 1 day
      is_relative_to_start: false,
      channel: 'email' as const,
      is_active: true,
    }
    expect(reminderRuleSchema.safeParse(validDeadlineReminder).success).toBe(true)
  })

  it('rejects negative offsets', () => {
    const negativeOffset = {
      offset_minutes: -10,
      is_relative_to_start: true,
      channel: 'in_app',
    }
    const res = reminderRuleSchema.safeParse(negativeOffset)
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error.issues[0]?.message).toContain('Offset cannot be negative')
    }
  })

  it('rejects offsets exceeding the 30-day maximum horizon (43,200 minutes)', () => {
    const excessiveOffset = {
      offset_minutes: 43201,
      is_relative_to_start: true,
      channel: 'in_app',
    }
    const res = reminderRuleSchema.safeParse(excessiveOffset)
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error.issues[0]?.message).toContain('Offset cannot exceed 30 days')
    }
  })

  it('rejects invalid notification channels', () => {
    const invalidChannel = {
      offset_minutes: 15,
      is_relative_to_start: true,
      channel: 'sms',
    }
    expect(reminderRuleSchema.safeParse(invalidChannel).success).toBe(false)
  })

  it('validates user default reminder settings schema with multiple presets', () => {
    const settings = {
      reminders_enabled_by_default: true,
      task_default_reminders: [
        { offset_minutes: 15, is_relative_to_start: true, channel: 'in_app', is_active: true },
        { offset_minutes: 60, is_relative_to_start: false, channel: 'in_app', is_active: true },
      ],
      event_default_reminders: [
        { offset_minutes: 10, is_relative_to_start: true, channel: 'in_app', is_active: true },
        { offset_minutes: 0, is_relative_to_start: true, channel: 'web_push', is_active: true },
      ],
    }

    const res = reminderSettingsSchema.safeParse(settings)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.task_default_reminders).toHaveLength(2)
      expect(res.data.event_default_reminders).toHaveLength(2)
      expect(res.data.reminders_enabled_by_default).toBe(true)
    }
  })
})

