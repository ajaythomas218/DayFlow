import { describe, it, expect } from 'vitest'
import {
  getLocalDateString,
  isTodayInTimezone,
  isOverdueInTimezone,
  isUpcomingInTimezone,
} from '@/lib/timezone'

describe('Timezone-Aware Date Horizons', () => {
  it('correctly formats local date across different IANA timezones', () => {
    // 2026-10-27T22:30:00.000Z:
    // In UTC, this is 2026-10-27
    // In Asia/Tokyo (+9), this is 2026-10-28 07:30
    // In America/New_York (-4), this is 2026-10-27 18:30
    const testDate = new Date('2026-10-27T22:30:00.000Z')

    expect(getLocalDateString('UTC', testDate)).toBe('2026-10-27')
    expect(getLocalDateString('Asia/Tokyo', testDate)).toBe('2026-10-28')
    expect(getLocalDateString('America/New_York', testDate)).toBe('2026-10-27')
  })

  it('determines whether a task deadline is today in the target timezone', () => {
    const referenceNow = new Date('2026-10-27T14:00:00.000Z')

    // Same day in UTC
    const sameDayUtc = '2026-10-27T19:00:00.000Z'
    expect(isTodayInTimezone(sameDayUtc, 'UTC', referenceNow)).toBe(true)

    // Tomorrow in UTC
    const tomorrowUtc = '2026-10-28T10:00:00.000Z'
    expect(isTodayInTimezone(tomorrowUtc, 'UTC', referenceNow)).toBe(false)
  })

  it('accurately identifies overdue tasks past the user local midnight', () => {
    const referenceNow = new Date('2026-10-28T10:00:00.000Z')

    // Deadline was yesterday
    const yesterday = '2026-10-27T15:00:00.000Z'
    expect(isOverdueInTimezone(yesterday, 'UTC', referenceNow)).toBe(true)

    // Deadline is today
    const today = '2026-10-28T18:00:00.000Z'
    expect(isOverdueInTimezone(today, 'UTC', referenceNow)).toBe(false)

    // Deadline is in the future
    const future = '2026-10-30T12:00:00.000Z'
    expect(isOverdueInTimezone(future, 'UTC', referenceNow)).toBe(false)
  })

  it('determines upcoming 7-day deadlines correctly', () => {
    const referenceNow = new Date('2026-10-27T12:00:00.000Z')

    // Today (not upcoming, it is today)
    const today = '2026-10-27T18:00:00.000Z'
    expect(isUpcomingInTimezone(today, 'UTC', 7, referenceNow)).toBe(false)

    // In 3 days (within 7-day window)
    const in3Days = '2026-10-30T12:00:00.000Z'
    expect(isUpcomingInTimezone(in3Days, 'UTC', 7, referenceNow)).toBe(true)

    // In 10 days (outside 7-day window)
    const in10Days = '2026-11-06T12:00:00.000Z'
    expect(isUpcomingInTimezone(in10Days, 'UTC', 7, referenceNow)).toBe(false)

    // Yesterday (overdue, not upcoming)
    const yesterday = '2026-10-26T12:00:00.000Z'
    expect(isUpcomingInTimezone(yesterday, 'UTC', 7, referenceNow)).toBe(false)
  })

  it('handles invalid dates gracefully without throwing errors', () => {
    expect(isTodayInTimezone('invalid-iso', 'UTC')).toBe(false)
    expect(isOverdueInTimezone('invalid-iso', 'UTC')).toBe(false)
    expect(isUpcomingInTimezone('invalid-iso', 'UTC', 7)).toBe(false)
  })
})

