import { describe, it, expect } from 'vitest'
import { getDayRangeForDateString, getLocalDateString } from '@/lib/timezone'
import { saveDiaryEntrySchema } from '@/lib/validations/diary'

describe('Daily Diary Workflows, Timezones & Task Integration', () => {
  describe('Timezone Day Boundaries & Near-Midnight Semantics', () => {
    it('computes exact UTC day ranges for local calendar dates across timezones', () => {
      // 1. Asia/Kolkata (UTC+5:30)
      const kolkataRange = getDayRangeForDateString('2026-10-28', 'Asia/Kolkata')
      // 2026-10-28 00:00:00 IST is 2026-10-27 18:30:00 UTC
      expect(kolkataRange.startIso).toBe('2026-10-27T18:30:00.000Z')
      // 2026-10-28 23:59:59 IST is 2026-10-28 18:29:59.000Z
      expect(kolkataRange.endIso).toBe('2026-10-28T18:29:59.000Z')

      // 2. America/New_York (EDT = UTC-4 in late October)
      const nyRange = getDayRangeForDateString('2026-10-28', 'America/New_York')
      // 2026-10-28 00:00:00 EDT is 2026-10-28 04:00:00 UTC
      expect(nyRange.startIso).toBe('2026-10-28T04:00:00.000Z')
      // 2026-10-28 23:59:59 EDT is 2026-10-29 03:59:59.000Z
      expect(nyRange.endIso).toBe('2026-10-29T03:59:59.000Z')
    })

    it('correctly attributes events scheduled near local midnight to the local date rather than UTC date', () => {
      // In New York (EDT, UTC-4), an event at 23:30 on Oct 27 is 03:30 on Oct 28 in UTC
      const nyTime = new Date('2026-10-28T03:30:00.000Z')
      const localDateInNy = getLocalDateString('America/New_York', nyTime)
      expect(localDateInNy).toBe('2026-10-27')

      const localDateInUtc = getLocalDateString('UTC', nyTime)
      expect(localDateInUtc).toBe('2026-10-28')

      // Ensure the range for Oct 27 in NY covers this event
      const nyOct27Range = getDayRangeForDateString('2026-10-27', 'America/New_York')
      expect(nyTime.toISOString() >= nyOct27Range.startIso && nyTime.toISOString() <= nyOct27Range.endIso).toBe(true)
    })
  })

  describe('Canonical Task Slicing & Overdue Protection', () => {
    it('classifies tasks into scheduled, due, and overdue without altering task deadlines or schedules', () => {
      const userTz = 'America/New_York'
      const targetDate = '2026-10-28'
      const { startIso, endIso } = getDayRangeForDateString(targetDate, userTz)

      const mockTasks = [
        {
          id: 'task-1',
          title: 'Due today in NY',
          deadline_at: '2026-10-28T16:00:00.000Z', // 12:00 EDT (falls in day)
          scheduled_start_at: null,
          status: 'todo',
        },
        {
          id: 'task-2',
          title: 'Scheduled today in NY',
          deadline_at: null,
          scheduled_start_at: '2026-10-28T18:00:00.000Z', // 14:00 EDT (falls in day)
          status: 'in_progress',
        },
        {
          id: 'task-3',
          title: 'Overdue task from yesterday',
          deadline_at: '2026-10-27T14:00:00.000Z', // Before startIso
          scheduled_start_at: null,
          status: 'todo',
        },
        {
          id: 'task-4',
          title: 'Completed task earlier today',
          completed_at: '2026-10-28T15:00:00.000Z',
          deadline_at: '2026-10-28T17:00:00.000Z',
          status: 'completed',
        },
      ]

      // Filter due today
      const dueToday = mockTasks.filter(
        (t) => t.deadline_at && t.deadline_at >= startIso && t.deadline_at <= endIso
      )
      expect(dueToday.map((t) => t.id)).toEqual(['task-1', 'task-4'])

      // Filter scheduled today
      const scheduledToday = mockTasks.filter(
        (t) => t.scheduled_start_at && t.scheduled_start_at >= startIso && t.scheduled_start_at <= endIso
      )
      expect(scheduledToday.map((t) => t.id)).toEqual(['task-2'])

      // Filter overdue (deadline < startIso and not completed)
      const overdue = mockTasks.filter(
        (t) => t.status !== 'completed' && t.deadline_at && t.deadline_at < startIso
      )
      expect(overdue.map((t) => t.id)).toEqual(['task-3'])
      // Check that original deadline is preserved
      expect(overdue[0].deadline_at).toBe('2026-10-27T14:00:00.000Z')
    })
  })

  describe('Diary Entry State Preservation', () => {
    it('validates upsert payload and guarantees journal notes do not mutate task records', () => {
      const diaryPayload = {
        entry_date: '2026-10-28',
        morning_intentions: 'Complete review and maintain focus',
        journal_content: 'Notes captured throughout the morning sprint.',
        evening_reflection: 'All milestones delivered.',
        wins: 'Zero lint errors, all tests green.',
        energy_level: 4,
        mood_rating: 4,
      }

      const parsed = saveDiaryEntrySchema.parse(diaryPayload)
      expect(parsed.entry_date).toBe('2026-10-28')
      expect(parsed.morning_intentions).toBe('Complete review and maintain focus')

      // Assert that diary payload does not contain or mutate task fields
      expect((parsed as Record<string, unknown>).task_id).toBeUndefined()
      expect((parsed as Record<string, unknown>).status).toBeUndefined()
      expect((parsed as Record<string, unknown>).deadline_at).toBeUndefined()
    })
  })
})
