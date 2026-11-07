/**
 * Timezone Date Horizon & Calendar Positioning Utilities
 * Safely computes calendar boundaries, positioning, and local day shifts
 * for any IANA timezone without naïve UTC assumptions.
 */

export interface DayHorizon {
  startOfDay: Date
  endOfDay: Date
  dateString: string // YYYY-MM-DD in the target timezone
}

export interface LocalTimeParts {
  year: number
  month: number // 1-12
  day: number // 1-31
  hour: number // 0-23
  minute: number // 0-59
  second: number // 0-59
}

/**
 * Returns the current date in YYYY-MM-DD formatted according to the given IANA timezone.
 */
export function getLocalDateString(timezone: string, date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return formatter.format(date)
  } catch {
    return date.toISOString().split('T')[0]
  }
}

/**
 * Extracts the local wall-clock parts for a given date in the target timezone.
 */
export function getLocalParts(timezone: string, date: Date): LocalTimeParts {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    const parts = formatter.formatToParts(date)
    const map: Record<string, string> = {}
    for (const p of parts) {
      if (p.type !== 'literal') {
        map[p.type] = p.value
      }
    }

    return {
      year: parseInt(map.year, 10),
      month: parseInt(map.month, 10),
      day: parseInt(map.day, 10),
      hour: parseInt(map.hour, 10) === 24 ? 0 : parseInt(map.hour, 10),
      minute: parseInt(map.minute, 10),
      second: parseInt(map.second, 10),
    }
  } catch {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
    }
  }
}

/**
 * Converts a set of local wall-clock parts in a target timezone into an exact UTC Date.
 * Uses an iterative offset correction method that safely handles DST transitions.
 */
export function localPartsToUtc(parts: LocalTimeParts, timezone: string): Date {
  const targetUtcEstimate = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )

  let date = new Date(targetUtcEstimate)

  // Iterative offset correction (converges in 1-2 iterations)
  for (let i = 0; i < 3; i++) {
    const rendered = getLocalParts(timezone, date)
    const renderedUtc = Date.UTC(
      rendered.year,
      rendered.month - 1,
      rendered.day,
      rendered.hour,
      rendered.minute,
      rendered.second
    )

    const diff = targetUtcEstimate - renderedUtc
    if (diff === 0) break
    date = new Date(date.getTime() + diff)
  }

  return date
}

/**
 * Shifts an ISO timestamp forward by `daysForward` local calendar days in the specified timezone.
 * Unlike adding 86,400,000 ms, this preserves the exact local wall-clock time across
 * Daylight Saving Time (DST) transitions.
 */
export function shiftLocalCalendarDay(
  isoDateString: string,
  timezone: string,
  daysForward: number = 1
): string {
  try {
    const sourceDate = new Date(isoDateString)
    if (isNaN(sourceDate.getTime())) return isoDateString

    const parts = getLocalParts(timezone, sourceDate)

    // Add daysForward using Date calendar arithmetic
    const shiftedLocal = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + daysForward))

    const newParts: LocalTimeParts = {
      year: shiftedLocal.getUTCFullYear(),
      month: shiftedLocal.getUTCMonth() + 1,
      day: shiftedLocal.getUTCDate(),
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second,
    }

    const utcDate = localPartsToUtc(newParts, timezone)
    return utcDate.toISOString()
  } catch {
    // Safe fallback
    return new Date(new Date(isoDateString).getTime() + daysForward * 86400000).toISOString()
  }
}

/**
 * Determines whether an ISO datetime falls on "Today" in the user's timezone.
 */
export function isTodayInTimezone(isoDateString: string, timezone: string, now: Date = new Date()): boolean {
  try {
    const targetDate = new Date(isoDateString)
    if (isNaN(targetDate.getTime())) return false

    const targetDay = getLocalDateString(timezone, targetDate)
    const today = getLocalDateString(timezone, now)

    return targetDay === today
  } catch {
    return false
  }
}

/**
 * Determines whether an ISO datetime is strictly before "Today" in the user's timezone (Overdue).
 */
export function isOverdueInTimezone(isoDateString: string, timezone: string, now: Date = new Date()): boolean {
  try {
    const targetDate = new Date(isoDateString)
    if (isNaN(targetDate.getTime())) return false

    const targetDay = getLocalDateString(timezone, targetDate)
    const today = getLocalDateString(timezone, now)

    return targetDay < today
  } catch {
    return false
  }
}

/**
 * Determines whether an ISO datetime is within the upcoming horizon (between tomorrow and +7 days).
 */
export function isUpcomingInTimezone(
  isoDateString: string,
  timezone: string,
  daysForward: number = 7,
  now: Date = new Date()
): boolean {
  try {
    const targetDate = new Date(isoDateString)
    if (isNaN(targetDate.getTime())) return false

    const targetDay = getLocalDateString(timezone, targetDate)
    const today = getLocalDateString(timezone, now)

    const futureDate = new Date(now.getTime() + daysForward * 24 * 60 * 60 * 1000)
    const futureLimit = getLocalDateString(timezone, futureDate)

    return targetDay > today && targetDay <= futureLimit
  } catch {
    return false
  }
}

/**
 * Computes the day range (00:00:00 to 23:59:59.999 local time) for a given date.
 */
export function getDayRange(date: Date, timezone: string): { startIso: string; endIso: string } {
  const parts = getLocalParts(timezone, date)
  const start = localPartsToUtc({ ...parts, hour: 0, minute: 0, second: 0 }, timezone)
  const end = localPartsToUtc({ ...parts, hour: 23, minute: 59, second: 59 }, timezone)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

/**
 * Computes the day range for a YYYY-MM-DD date string in the target timezone.
 */
export function getDayRangeForDateString(dateString: string, timezone: string): { startIso: string; endIso: string } {
  const [year, month, day] = dateString.split('-').map(Number)
  const start = localPartsToUtc({ year, month, day, hour: 0, minute: 0, second: 0 }, timezone)
  const end = localPartsToUtc({ year, month, day, hour: 23, minute: 59, second: 59 }, timezone)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

/**
 * Computes the 7-day week range containing the specified date.
 * weekStartsOn: 0 = Sunday, 1 = Monday.
 */
export function getWeekRange(
  date: Date,
  timezone: string,
  weekStartsOn: 0 | 1 = 0
): { startIso: string; endIso: string; days: Date[] } {
  const parts = getLocalParts(timezone, date)
  const localDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  const dayOfWeek = localDate.getUTCDay() // 0 = Sun, 1 = Mon ... 6 = Sat

  let diff = dayOfWeek - weekStartsOn
  if (diff < 0) diff += 7

  const startDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - diff))
  const days: Date[] = []

  for (let i = 0; i < 7; i++) {
    const current = new Date(startDay.getTime() + i * 86400000)
    days.push(current)
  }

  const startParts = getLocalParts(timezone, days[0])
  const endParts = getLocalParts(timezone, days[6])

  const start = localPartsToUtc({ ...startParts, hour: 0, minute: 0, second: 0 }, timezone)
  const end = localPartsToUtc({ ...endParts, hour: 23, minute: 59, second: 59 }, timezone)

  return { startIso: start.toISOString(), endIso: end.toISOString(), days }
}

/**
 * Computes the calendar month grid range (including leading and trailing days to fill 7-col weeks).
 */
export function getMonthRange(
  date: Date,
  timezone: string,
  weekStartsOn: 0 | 1 = 0
): { startIso: string; endIso: string; days: Date[]; currentMonth: number; currentYear: number } {
  const parts = getLocalParts(timezone, date)
  const firstOfMonth = new Date(Date.UTC(parts.year, parts.month - 1, 1))
  const firstDayOfWeek = firstOfMonth.getUTCDay()

  let leadingDiff = firstDayOfWeek - weekStartsOn
  if (leadingDiff < 0) leadingDiff += 7

  const gridStart = new Date(firstOfMonth.getTime() - leadingDiff * 86400000)

  // 42 days grid (6 weeks) guarantees complete coverage
  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    days.push(new Date(gridStart.getTime() + i * 86400000))
  }

  const startParts = getLocalParts(timezone, days[0])
  const endParts = getLocalParts(timezone, days[days.length - 1])

  const start = localPartsToUtc({ ...startParts, hour: 0, minute: 0, second: 0 }, timezone)
  const end = localPartsToUtc({ ...endParts, hour: 23, minute: 59, second: 59 }, timezone)

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    days,
    currentMonth: parts.month,
    currentYear: parts.year,
  }
}

/**
 * Returns the minute of the day (0 - 1440) for a given timestamp in the specified timezone.
 * Used for vertical positioning on Day and Week timelines.
 */
export function getMinutesFromStartOfDay(isoDateString: string, timezone: string): number {
  try {
    const date = new Date(isoDateString)
    if (isNaN(date.getTime())) return 0
    const parts = getLocalParts(timezone, date)
    return parts.hour * 60 + parts.minute
  } catch {
    return 0
  }
}

/**
 * Formats a timestamp into a clean local time string (e.g. "9:00 AM" or "14:30").
 */
export function formatTimeInTimezone(
  isoDateString: string,
  timezone: string,
  hour12: boolean = true
): string {
  try {
    const date = new Date(isoDateString)
    if (isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12,
    }).format(date)
  } catch {
    return ''
  }
}

export interface WeekBoundaries {
  weekStartDate: string // YYYY-MM-DD (Monday)
  weekEndDate: string // YYYY-MM-DD (Sunday)
  startIso: string // UTC ISO at 00:00:00 local time
  endIso: string // UTC ISO at 23:59:59 local time
  label: string
}

/**
 * Returns explicit week boundaries (Monday to Sunday) for any reference date in the specified timezone.
 */
export function getWeekBoundaries(
  referenceDate: Date = new Date(),
  timezone: string = 'UTC',
  weekStartsOn: 0 | 1 = 1
): WeekBoundaries {
  const parts = getLocalParts(timezone, referenceDate)
  const localDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  const dayOfWeek = localDate.getUTCDay() // 0 = Sun, 1 = Mon ... 6 = Sat

  let diff = dayOfWeek - weekStartsOn
  if (diff < 0) diff += 7

  const startDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - diff, 12, 0, 0))
  const endDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - diff + 6, 12, 0, 0))

  const weekStartDate = startDay.toISOString().split('T')[0]
  const weekEndDate = endDay.toISOString().split('T')[0]

  const startRange = getDayRangeForDateString(weekStartDate, timezone)
  const endRange = getDayRangeForDateString(weekEndDate, timezone)

  const label = `${weekStartDate} – ${weekEndDate}`

  return {
    weekStartDate,
    weekEndDate,
    startIso: startRange.startIso,
    endIso: endRange.endIso,
    label,
  }
}

export interface ReportDateRange {
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  startIso: string
  endIso: string
  label: string
  dayDates: string[]
}

/**
 * Computes timezone-aware date boundaries for Report presets (this_week, last_week, this_month, last_month, custom).
 */
export function getReportDateRange(
  preset: 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom',
  timezone: string = 'UTC',
  customStart?: string,
  customEnd?: string,
  now: Date = new Date()
): ReportDateRange {
  if (preset === 'custom' && customStart && customEnd) {
    const sRange = getDayRangeForDateString(customStart, timezone)
    const eRange = getDayRangeForDateString(customEnd, timezone)

    // Generate list of days
    const dayDates: string[] = []
    let cursor = new Date(`${customStart}T00:00:00Z`)
    const limit = new Date(`${customEnd}T00:00:00Z`)
    while (cursor <= limit && dayDates.length <= 90) {
      dayDates.push(cursor.toISOString().split('T')[0])
      cursor = new Date(cursor.getTime() + 86400000)
    }

    return {
      startDate: customStart,
      endDate: customEnd,
      startIso: sRange.startIso,
      endIso: eRange.endIso,
      label: `${customStart} to ${customEnd}`,
      dayDates,
    }
  }

  if (preset === 'last_week') {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)
    const wb = getWeekBoundaries(sevenDaysAgo, timezone, 1)
    const dayDates: string[] = []
    let cursor = new Date(`${wb.weekStartDate}T00:00:00Z`)
    for (let i = 0; i < 7; i++) {
      dayDates.push(cursor.toISOString().split('T')[0])
      cursor = new Date(cursor.getTime() + 86400000)
    }
    return {
      startDate: wb.weekStartDate,
      endDate: wb.weekEndDate,
      startIso: wb.startIso,
      endIso: wb.endIso,
      label: `Last Week (${wb.label})`,
      dayDates,
    }
  }

  if (preset === 'this_month') {
    const parts = getLocalParts(timezone, now)
    const startDate = `${parts.year}-${String(parts.month).padStart(2, '0')}-01`
    const lastDayNum = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate()
    const endDate = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`
    const sRange = getDayRangeForDateString(startDate, timezone)
    const eRange = getDayRangeForDateString(endDate, timezone)

    const dayDates: string[] = []
    let cursor = new Date(`${startDate}T00:00:00Z`)
    const limit = new Date(`${endDate}T00:00:00Z`)
    while (cursor <= limit) {
      dayDates.push(cursor.toISOString().split('T')[0])
      cursor = new Date(cursor.getTime() + 86400000)
    }

    return {
      startDate,
      endDate,
      startIso: sRange.startIso,
      endIso: eRange.endIso,
      label: `This Month (${startDate} to ${endDate})`,
      dayDates,
    }
  }

  if (preset === 'last_month') {
    const parts = getLocalParts(timezone, now)
    let prevMonth = parts.month - 1
    let prevYear = parts.year
    if (prevMonth < 1) {
      prevMonth = 12
      prevYear -= 1
    }
    const startDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
    const lastDayNum = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate()
    const endDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`
    const sRange = getDayRangeForDateString(startDate, timezone)
    const eRange = getDayRangeForDateString(endDate, timezone)

    const dayDates: string[] = []
    let cursor = new Date(`${startDate}T00:00:00Z`)
    const limit = new Date(`${endDate}T00:00:00Z`)
    while (cursor <= limit) {
      dayDates.push(cursor.toISOString().split('T')[0])
      cursor = new Date(cursor.getTime() + 86400000)
    }

    return {
      startDate,
      endDate,
      startIso: sRange.startIso,
      endIso: eRange.endIso,
      label: `Last Month (${startDate} to ${endDate})`,
      dayDates,
    }
  }

  // Default: this_week (Monday - Sunday)
  const wb = getWeekBoundaries(now, timezone, 1)
  const dayDates: string[] = []
  let cursor = new Date(`${wb.weekStartDate}T00:00:00Z`)
  for (let i = 0; i < 7; i++) {
    dayDates.push(cursor.toISOString().split('T')[0])
    cursor = new Date(cursor.getTime() + 86400000)
  }

  return {
    startDate: wb.weekStartDate,
    endDate: wb.weekEndDate,
    startIso: wb.startIso,
    endIso: wb.endIso,
    label: `This Week (${wb.label})`,
    dayDates,
  }
}
