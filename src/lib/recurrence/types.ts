export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly'
export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'

export interface RecurrenceConfig {
  frequency: RecurrenceFrequency
  interval: number // e.g. every 1 day, every 2 weeks
  weekdays?: Weekday[] // For weekly recurrence
  monthDay?: number // For monthly recurrence: 1-31 (auto-clamped on short months)
  endType: 'never' | 'until_date' | 'count'
  untilDate?: string // ISO date string (UTC)
  count?: number // Maximum number of occurrences
}

export interface GeneratedOccurrence {
  occurrenceDate: Date
  occurrenceIndex: number
  scheduledStartIso: string | null
  scheduledEndIso: string | null
  deadlineIso: string | null
}

