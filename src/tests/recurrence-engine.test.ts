import { describe, it, expect } from 'vitest'
import {
  parseRecurrenceRule,
  serializeRecurrenceRule,
  calculateNextOccurrence,
  generateOccurrencesWithinHorizon,
  getDaysInMonth,
  RecurrenceConfig,
} from '@/lib/recurrence'
import { getLocalParts } from '@/lib/timezone'

describe('Recurrence Engine & Scheduling', () => {
  it('serializes and parses RFC 5545 RRULE strings correctly', () => {
    const config: RecurrenceConfig = {
      frequency: 'weekly',
      interval: 2,
      weekdays: ['MO', 'WE', 'FR'],
      endType: 'count',
      count: 10,
    }

    const rrule = serializeRecurrenceRule(config)
    expect(rrule).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;COUNT=10')

    const parsed = parseRecurrenceRule(rrule)
    expect(parsed).not.toBeNull()
    expect(parsed?.frequency).toBe('weekly')
    expect(parsed?.interval).toBe(2)
    expect(parsed?.weekdays).toEqual(['MO', 'WE', 'FR'])
    expect(parsed?.endType).toBe('count')
    expect(parsed?.count).toBe(10)
  })

  it('calculates next daily occurrence accurately', () => {
    const config: RecurrenceConfig = {
      frequency: 'daily',
      interval: 1,
      endType: 'never',
    }

    const start = new Date('2026-10-27T09:00:00.000Z')
    const next = calculateNextOccurrence(start, config, 'UTC')

    expect(next).not.toBeNull()
    expect(next?.toISOString()).toBe('2026-10-28T09:00:00.000Z')
  })

  it('calculates next weekly occurrences matching specified weekdays', () => {
    // 2026-10-26 is a Monday (MO)
    const monday = new Date('2026-10-26T10:00:00.000Z')
    const config: RecurrenceConfig = {
      frequency: 'weekly',
      interval: 1,
      weekdays: ['MO', 'WE', 'FR'],
      endType: 'never',
    }

    // Next after Monday should be Wednesday Oct 28
    const wednesday = calculateNextOccurrence(monday, config, 'UTC')
    expect(wednesday?.toISOString()).toBe('2026-10-28T10:00:00.000Z')

    // Next after Wednesday should be Friday Oct 30
    const friday = calculateNextOccurrence(wednesday!, config, 'UTC')
    expect(friday?.toISOString()).toBe('2026-10-30T10:00:00.000Z')

    // Next after Friday should wrap to next Monday Nov 2
    const nextMonday = calculateNextOccurrence(friday!, config, 'UTC')
    expect(nextMonday?.toISOString()).toBe('2026-11-02T10:00:00.000Z')
  })

  it('safely clamps month-end dates on shorter months (Month-End Semantics)', () => {
    // January 31, 2026 (non-leap year, Feb 2026 has 28 days)
    const jan31 = new Date('2026-01-31T14:00:00.000Z')
    const config: RecurrenceConfig = {
      frequency: 'monthly',
      interval: 1,
      monthDay: 31,
      endType: 'never',
    }

    // Next month should clamp from 31 to Feb 28!
    const febNext = calculateNextOccurrence(jan31, config, 'UTC')
    expect(febNext?.toISOString()).toBe('2026-02-28T14:00:00.000Z')

    // March 31 -> April should clamp to April 30!
    const march31 = new Date('2026-03-31T14:00:00.000Z')
    const aprilNext = calculateNextOccurrence(march31, config, 'UTC')
    expect(aprilNext?.toISOString()).toBe('2026-04-30T14:00:00.000Z')
  })

  it('correctly reports days in month including leap years', () => {
    expect(getDaysInMonth(2026, 2)).toBe(28) // Non-leap year
    expect(getDaysInMonth(2028, 2)).toBe(29) // Leap year
    expect(getDaysInMonth(2026, 4)).toBe(30) // April
    expect(getDaysInMonth(2026, 12)).toBe(31) // December
  })

  it('preserves local wall-clock time across DST transitions for recurring items', () => {
    // In America/New_York, DST ends on Sunday, Nov 1, 2026 (clocks fall back 1 hour from EDT to EST).
    // Saturday Oct 31, 2026 at 15:00 EDT is 19:00 UTC.
    // Daily recurrence on Sunday Nov 1 MUST occur at 15:00 EST (20:00 UTC), not 14:00 EST.
    const saturday = new Date('2026-10-31T19:00:00.000Z')
    const config: RecurrenceConfig = {
      frequency: 'daily',
      interval: 1,
      endType: 'never',
    }

    const nextSunday = calculateNextOccurrence(saturday, config, 'America/New_York')
    expect(nextSunday?.toISOString()).toBe('2026-11-01T20:00:00.000Z')

    const localParts = getLocalParts('America/New_York', nextSunday!)
    expect(localParts.hour).toBe(15) // Still 15:00 local!
    expect(localParts.minute).toBe(0)
  })

  it('generates bounded occurrences within a defined horizon without unbounded growth', () => {
    const config: RecurrenceConfig = {
      frequency: 'weekly',
      interval: 1,
      weekdays: ['MO', 'TH'],
      endType: 'never',
    }

    const initialDate = new Date('2026-10-01T09:00:00.000Z')
    const horizonEndDate = new Date('2026-10-31T23:59:59.000Z') // 1 month horizon

    const occurrences = generateOccurrencesWithinHorizon({
      initialDate,
      config,
      horizonEndDate,
      timezone: 'UTC',
      maxLimit: 50,
    })

    // October has ~9-10 occurrences of Monday & Thursday
    expect(occurrences.length).toBeGreaterThan(5)
    expect(occurrences.length).toBeLessThan(12)

    // All occurrences must be within horizon
    for (const occ of occurrences) {
      expect(occ.getTime()).toBeLessThanOrEqual(horizonEndDate.getTime())
      expect(occ.getTime()).toBeGreaterThan(initialDate.getTime())
    }
  })

  it('stops generating occurrences when count limit is reached', () => {
    const config: RecurrenceConfig = {
      frequency: 'daily',
      interval: 1,
      endType: 'count',
      count: 3,
    }

    const initialDate = new Date('2026-10-01T09:00:00.000Z')
    const farHorizon = new Date('2027-10-01T09:00:00.000Z')

    const occurrences = generateOccurrencesWithinHorizon({
      initialDate,
      config,
      horizonEndDate: farHorizon,
      timezone: 'UTC',
    })

    expect(occurrences).toHaveLength(3)
  })
})

