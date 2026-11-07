import { getLocalParts, localPartsToUtc, LocalTimeParts } from '@/lib/timezone'
import { RecurrenceConfig, RecurrenceFrequency, Weekday } from './types'

export * from './types'

const WEEKDAY_INDEX: Record<Weekday, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
}

const INDEX_TO_WEEKDAY: Record<number, Weekday> = {
  0: 'SU',
  1: 'MO',
  2: 'TU',
  3: 'WE',
  4: 'TH',
  5: 'FR',
  6: 'SA',
}

/**
 * Serializes a typed RecurrenceConfig into standard RFC 5545 RRULE format.
 */
export function serializeRecurrenceRule(config: RecurrenceConfig): string {
  const parts: string[] = []

  parts.push(`FREQ=${config.frequency.toUpperCase()}`)

  if (config.interval > 1) {
    parts.push(`INTERVAL=${Math.max(1, Math.floor(config.interval))}`)
  }

  if (config.frequency === 'weekly' && config.weekdays && config.weekdays.length > 0) {
    parts.push(`BYDAY=${config.weekdays.join(',')}`)
  }

  if (config.frequency === 'monthly' && config.monthDay) {
    parts.push(`BYMONTHDAY=${config.monthDay}`)
  }

  if (config.endType === 'until_date' && config.untilDate) {
    const d = new Date(config.untilDate)
    if (!isNaN(d.getTime())) {
      // Format as YYYYMMDDTHHMMSSZ for standard RFC 5545
      const untilStr = d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
      parts.push(`UNTIL=${untilStr}`)
    }
  } else if (config.endType === 'count' && config.count && config.count > 0) {
    parts.push(`COUNT=${config.count}`)
  }

  return parts.join(';')
}

/**
 * Parses an RFC 5545 RRULE string or custom rule format into a typed RecurrenceConfig.
 */
export function parseRecurrenceRule(rule: string | null | undefined): RecurrenceConfig | null {
  if (!rule || !rule.trim()) return null

  try {
    const segments = rule.trim().split(';')
    const map = new Map<string, string>()

    for (const segment of segments) {
      const [key, val] = segment.split('=')
      if (key && val) {
        map.set(key.trim().toUpperCase(), val.trim())
      }
    }

    const freqRaw = map.get('FREQ')?.toLowerCase()
    if (!freqRaw || !['daily', 'weekly', 'monthly'].includes(freqRaw)) {
      return null
    }

    const frequency = freqRaw as RecurrenceFrequency
    const interval = map.has('INTERVAL') ? Math.max(1, parseInt(map.get('INTERVAL')!, 10) || 1) : 1

    let weekdays: Weekday[] | undefined
    if (map.has('BYDAY')) {
      const rawDays = map.get('BYDAY')!.split(',')
      weekdays = rawDays
        .map((d) => d.trim().toUpperCase() as Weekday)
        .filter((d) => d in WEEKDAY_INDEX)
    }

    let monthDay: number | undefined
    if (map.has('BYMONTHDAY')) {
      const parsedDay = parseInt(map.get('BYMONTHDAY')!, 10)
      if (parsedDay >= 1 && parsedDay <= 31) {
        monthDay = parsedDay
      }
    }

    let endType: RecurrenceConfig['endType'] = 'never'
    let untilDate: string | undefined
    let count: number | undefined

    if (map.has('UNTIL')) {
      const rawUntil = map.get('UNTIL')!
      // Handle standard compact YYYYMMDDTHHMMSSZ or standard ISO
      if (rawUntil.length === 16 && rawUntil.endsWith('Z')) {
        const year = rawUntil.slice(0, 4)
        const month = rawUntil.slice(4, 6)
        const day = rawUntil.slice(6, 8)
        const hour = rawUntil.slice(9, 11)
        const min = rawUntil.slice(11, 13)
        const sec = rawUntil.slice(13, 15)
        untilDate = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`).toISOString()
      } else {
        const d = new Date(rawUntil)
        if (!isNaN(d.getTime())) {
          untilDate = d.toISOString()
        }
      }
      if (untilDate) endType = 'until_date'
    } else if (map.has('COUNT')) {
      count = parseInt(map.get('COUNT')!, 10)
      if (count && count > 0) endType = 'count'
    }

    return {
      frequency,
      interval,
      weekdays,
      monthDay,
      endType,
      untilDate,
      count,
    }
  } catch {
    return null
  }
}

/**
 * Returns the maximum number of days in a given year and month (1-12).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Calculates the next occurrence after `currentDate` in the specified timezone.
 * Preserves the exact local wall-clock time across Daylight Saving Time (DST) boundaries.
 */
export function calculateNextOccurrence(
  currentDate: Date,
  config: RecurrenceConfig,
  timezone: string
): Date | null {
  const parts = getLocalParts(timezone, currentDate)

  if (config.frequency === 'daily') {
    // Add interval days in local calendar math
    const nextLocalUtc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + config.interval))
    const nextParts: LocalTimeParts = {
      year: nextLocalUtc.getUTCFullYear(),
      month: nextLocalUtc.getUTCMonth() + 1,
      day: nextLocalUtc.getUTCDate(),
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second,
    }
    const nextDate = localPartsToUtc(nextParts, timezone)
    if (isPastEndCondition(nextDate, config)) return null
    return nextDate
  }

  if (config.frequency === 'weekly') {
    const selectedWeekdays =
      config.weekdays && config.weekdays.length > 0 ? config.weekdays : [INDEX_TO_WEEKDAY[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()]]

    const currentDayOfWeek = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()

    // Find the next day in the current week (if any)
    const sortedTargetDays = Array.from(new Set(selectedWeekdays.map((w) => WEEKDAY_INDEX[w]))).sort((a, b) => a - b)

    const nextDayThisWeek = sortedTargetDays.find((d) => d > currentDayOfWeek)

    let daysToAdd = 0
    if (nextDayThisWeek !== undefined) {
      daysToAdd = nextDayThisWeek - currentDayOfWeek
    } else {
      // Wrap to next interval week: days until end of week + (interval - 1)*7 + first selected day
      const firstDayOfNextWeek = sortedTargetDays[0]
      daysToAdd = 7 - currentDayOfWeek + (config.interval - 1) * 7 + firstDayOfNextWeek
    }

    const nextLocalUtc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + daysToAdd))
    const nextParts: LocalTimeParts = {
      year: nextLocalUtc.getUTCFullYear(),
      month: nextLocalUtc.getUTCMonth() + 1,
      day: nextLocalUtc.getUTCDate(),
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second,
    }

    const nextDate = localPartsToUtc(nextParts, timezone)
    if (isPastEndCondition(nextDate, config)) return null
    return nextDate
  }

  if (config.frequency === 'monthly') {
    // Determine target day of month: either explicitly configured or derived from original date
    const targetMonthDay = config.monthDay || parts.day

    // Advance by interval months
    const targetMonthRaw = parts.month + config.interval
    const targetYear = parts.year + Math.floor((targetMonthRaw - 1) / 12)
    const targetMonth = ((targetMonthRaw - 1) % 12) + 1

    // Clamping behavior: if month has fewer days than targetMonthDay (e.g. Feb 31 -> Feb 28/29), clamp to end of month
    const maxDays = getDaysInMonth(targetYear, targetMonth)
    const clampedDay = Math.min(targetMonthDay, maxDays)

    const nextParts: LocalTimeParts = {
      year: targetYear,
      month: targetMonth,
      day: clampedDay,
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second,
    }

    const nextDate = localPartsToUtc(nextParts, timezone)
    if (isPastEndCondition(nextDate, config)) return null
    return nextDate
  }

  return null
}

function isPastEndCondition(date: Date, config: RecurrenceConfig): boolean {
  if (config.endType === 'until_date' && config.untilDate) {
    const until = new Date(config.untilDate)
    if (!isNaN(until.getTime()) && date.getTime() > until.getTime()) {
      return true
    }
  }
  return false
}

/**
 * Generates bounded occurrences within a defined date horizon (e.g. next 30 days).
 * Safeguarded with a strict upper limit (default maxLimit = 50) to prevent infinite loops.
 */
export function generateOccurrencesWithinHorizon(params: {
  initialDate: Date
  config: RecurrenceConfig
  horizonEndDate: Date
  timezone: string
  maxLimit?: number
}): Date[] {
  const occurrences: Date[] = []
  const maxLimit = params.maxLimit || 50
  let current = params.initialDate
  let count = 0

  while (count < maxLimit) {
    const next = calculateNextOccurrence(current, params.config, params.timezone)
    if (!next) break

    if (next.getTime() > params.horizonEndDate.getTime()) {
      break
    }

    occurrences.push(next)
    current = next
    count++

    if (params.config.endType === 'count' && params.config.count && count >= params.config.count) {
      break
    }
  }

  return occurrences
}

