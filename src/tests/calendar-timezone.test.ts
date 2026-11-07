import { describe, it, expect } from 'vitest'
import {
  getLocalParts,
  localPartsToUtc,
  shiftLocalCalendarDay,
  getDayRange,
  getWeekRange,
  getMonthRange,
  getMinutesFromStartOfDay,
  formatTimeInTimezone,
} from '@/lib/timezone'

describe('Timezone & DST Utilities', () => {
  it('extracts local parts and reconstructs UTC timestamp correctly', () => {
    // 2026-10-28 15:30:00 in Tokyo (+9) is 2026-10-28 06:30:00 UTC
    const utcDate = new Date('2026-10-28T06:30:00.000Z')
    const parts = getLocalParts('Asia/Tokyo', utcDate)

    expect(parts.year).toBe(2026)
    expect(parts.month).toBe(10)
    expect(parts.day).toBe(28)
    expect(parts.hour).toBe(15)
    expect(parts.minute).toBe(30)

    const reconstructed = localPartsToUtc(parts, 'Asia/Tokyo')
    expect(reconstructed.toISOString()).toBe('2026-10-28T06:30:00.000Z')
  })

  it('preserves local clock time across US Fall-Back DST transition when shifting days', () => {
    // In America/New_York, DST ends on Sunday, Nov 1, 2026 at 2:00 AM (clocks fall back to 1:00 AM).
    // Saturday, Oct 31, 2026 14:00 EDT is 18:00 UTC (EDT = UTC-4).
    // A naive +24h addition would result in Sunday, Nov 1, 2026 18:00 UTC,
    // which in EST (UTC-5) is 13:00 (1:00 PM) - an unintended 1-hour clock shift!
    // shiftLocalCalendarDay MUST yield Sunday, Nov 1, 2026 14:00 EST (19:00 UTC).
    const saturdayEdt = '2026-10-31T18:00:00.000Z'
    const shifted = shiftLocalCalendarDay(saturdayEdt, 'America/New_York', 1)
    
    // Shifted time should be 19:00 UTC, which equals 14:00 EST in New York!
    expect(shifted).toBe('2026-11-01T19:00:00.000Z')

    // Verify local representation in New York is still 14:00
    const localShiftedParts = getLocalParts('America/New_York', new Date(shifted))
    expect(localShiftedParts.year).toBe(2026)
    expect(localShiftedParts.month).toBe(11)
    expect(localShiftedParts.day).toBe(1)
    expect(localShiftedParts.hour).toBe(14)
    expect(localShiftedParts.minute).toBe(0)
  })

  it('preserves local clock time across US Spring-Forward DST transition when shifting days', () => {
    // In America/New_York, DST starts on Sunday, Mar 8, 2026 at 2:00 AM (clocks jump to 3:00 AM).
    // Saturday, Mar 7, 2026 10:00 EST is 15:00 UTC (EST = UTC-5).
    // A naive +24h addition would give Sunday, Mar 8 15:00 UTC,
    // which in EDT (UTC-4) is 11:00 AM - another unintended 1-hour clock drift!
    // shiftLocalCalendarDay MUST yield Sunday, Mar 8 10:00 EDT (14:00 UTC).
    const saturdayEst = '2026-03-07T15:00:00.000Z'
    const shifted = shiftLocalCalendarDay(saturdayEst, 'America/New_York', 1)

    expect(shifted).toBe('2026-03-08T14:00:00.000Z')

    const localShiftedParts = getLocalParts('America/New_York', new Date(shifted))
    expect(localShiftedParts.year).toBe(2026)
    expect(localShiftedParts.month).toBe(3)
    expect(localShiftedParts.day).toBe(8)
    expect(localShiftedParts.hour).toBe(10)
    expect(localShiftedParts.minute).toBe(0)
  })

  it('computes correct day range boundaries in local timezone', () => {
    // 2026-10-28 in Asia/Tokyo (+9):
    // Start of day is 2026-10-27 15:00:00 UTC
    // End of day is 2026-10-28 14:59:59.000 UTC
    const ref = new Date('2026-10-28T05:00:00.000Z')
    const range = getDayRange(ref, 'Asia/Tokyo')

    expect(range.startIso).toBe('2026-10-27T15:00:00.000Z')
    expect(range.endIso).toBe('2026-10-28T14:59:59.000Z')
  })

  it('computes week range with Monday as start of week', () => {
    // Wednesday Oct 28, 2026 in UTC:
    // Monday is Oct 26, 2026 00:00:00 UTC
    // Sunday is Nov 1, 2026 23:59:59.000 UTC
    const ref = new Date('2026-10-28T12:00:00.000Z')
    const range = getWeekRange(ref, 'UTC', 1)

    expect(range.startIso).toBe('2026-10-26T00:00:00.000Z')
    expect(range.endIso).toBe('2026-11-01T23:59:59.000Z')
  })

  it('computes month range including calendar grid padding weeks', () => {
    // October 2026 in UTC:
    // Oct 1 is Thursday. Monday of that week is Sep 28.
    // Oct 31 is Saturday. End of 6-week grid is Nov 8.
    const ref = new Date('2026-10-15T12:00:00.000Z')
    const range = getMonthRange(ref, 'UTC', 1)

    expect(range.startIso).toBe('2026-09-28T00:00:00.000Z')
    expect(range.endIso).toBe('2026-11-08T23:59:59.000Z')
  })

  it('computes minutes from start of day in target timezone', () => {
    // 2026-10-28T14:45:00.000Z in UTC -> 14 * 60 + 45 = 885
    const utcIso = '2026-10-28T14:45:00.000Z'
    expect(getMinutesFromStartOfDay(utcIso, 'UTC')).toBe(885)

    // In America/New_York (EDT, UTC-4), 14:45 UTC is 10:45 EDT -> 10 * 60 + 45 = 645
    expect(getMinutesFromStartOfDay(utcIso, 'America/New_York')).toBe(645)
  })

  it('formats time string nicely according to target timezone', () => {
    const utcIso = '2026-10-28T14:05:00.000Z'
    expect(formatTimeInTimezone(utcIso, 'UTC', false)).toBe('14:05')
    expect(formatTimeInTimezone(utcIso, 'America/New_York', false)).toBe('10:05')
    expect(formatTimeInTimezone(utcIso, 'Asia/Tokyo', false)).toBe('23:05')
  })
})

