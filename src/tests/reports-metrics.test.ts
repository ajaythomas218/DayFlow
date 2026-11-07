import { describe, it, expect } from 'vitest'
import { reportsFilterSchema } from '@/lib/validations/reports'
import { getReportDateRange } from '@/lib/timezone'

describe('Productivity Reports & Workload Analytics Architecture', () => {
  it('validates standard presets: this_week, last_week, this_month, last_month', () => {
    const presets = ['this_week', 'last_week', 'this_month', 'last_month'] as const
    for (const p of presets) {
      const res = reportsFilterSchema.safeParse({ preset: p })
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.project_id).toBe('all')
      }
    }
  })

  it('validates custom range when start_date <= end_date', () => {
    const validCustom = {
      preset: 'custom' as const,
      start_date: '2026-10-01',
      end_date: '2026-10-25',
    }
    const res = reportsFilterSchema.safeParse(validCustom)
    expect(res.success).toBe(true)
  })

  it('rejects custom range when start_date > end_date or missing', () => {
    const invalidCustom = {
      preset: 'custom' as const,
      start_date: '2026-10-25',
      end_date: '2026-10-01',
    }
    const res = reportsFilterSchema.safeParse(invalidCustom)
    expect(res.success).toBe(false)

    const missingCustom = {
      preset: 'custom' as const,
      start_date: '2026-10-01',
    }
    const resMissing = reportsFilterSchema.safeParse(missingCustom)
    expect(resMissing.success).toBe(false)
  })

  it('derives timezone-aware date boundaries for this_week and last_week', () => {
    const mockRef = new Date('2026-10-28T12:00:00Z') // Wednesday
    const nyWeek = getReportDateRange('this_week', 'America/New_York', undefined, undefined, mockRef)

    expect(nyWeek.startDate).toBe('2026-10-26') // Monday
    expect(nyWeek.endDate).toBe('2026-11-01') // Sunday
    expect(nyWeek.dayDates.length).toBe(7)
    expect(nyWeek.dayDates[0]).toBe('2026-10-26')
    expect(nyWeek.dayDates[6]).toBe('2026-11-01')

    const lastWeek = getReportDateRange('last_week', 'America/New_York', undefined, undefined, mockRef)
    expect(lastWeek.startDate).toBe('2026-10-19')
    expect(lastWeek.endDate).toBe('2026-10-25')
    expect(lastWeek.dayDates.length).toBe(7)
  })

  it('derives timezone-aware date boundaries for this_month and last_month', () => {
    const mockRef = new Date('2026-10-28T12:00:00Z')
    const thisMonth = getReportDateRange('this_month', 'UTC', undefined, undefined, mockRef)
    expect(thisMonth.startDate).toBe('2026-10-01')
    expect(thisMonth.endDate).toBe('2026-10-31')
    expect(thisMonth.dayDates.length).toBe(31)

    const lastMonth = getReportDateRange('last_month', 'UTC', undefined, undefined, mockRef)
    expect(lastMonth.startDate).toBe('2026-09-01')
    expect(lastMonth.endDate).toBe('2026-09-30')
    expect(lastMonth.dayDates.length).toBe(30)
  })

  it('clearly distinguishes tasks created in period from tasks completed in period', () => {
    const range = {
      startIso: '2026-10-26T00:00:00.000Z',
      endIso: '2026-11-01T23:59:59.999Z',
    }

    const tasks = [
      // Task A: Created in previous period, completed in this period
      {
        id: 't-1',
        title: 'Task A',
        created_at: '2026-10-15T10:00:00.000Z',
        completed_at: '2026-10-27T14:00:00.000Z',
        status: 'completed',
      },
      // Task B: Created in this period, not completed
      {
        id: 't-2',
        title: 'Task B',
        created_at: '2026-10-28T09:00:00.000Z',
        completed_at: null,
        status: 'todo',
      },
      // Task C: Created in this period, completed in this period
      {
        id: 't-3',
        title: 'Task C',
        created_at: '2026-10-27T08:00:00.000Z',
        completed_at: '2026-10-27T16:00:00.000Z',
        status: 'completed',
      },
      // Task D: Cancelled in this period
      {
        id: 't-4',
        title: 'Task D',
        created_at: '2026-10-20T00:00:00.000Z',
        completed_at: null,
        status: 'cancelled',
      },
    ]

    const createdInPeriod = tasks.filter(
      (t) => t.created_at >= range.startIso && t.created_at <= range.endIso
    )
    const completedInPeriod = tasks.filter(
      (t) =>
        t.status === 'completed' &&
        t.completed_at &&
        t.completed_at >= range.startIso &&
        t.completed_at <= range.endIso
    )

    // Task B and Task C were created in period
    expect(createdInPeriod.length).toBe(2)
    expect(createdInPeriod.map((t) => t.id)).toEqual(['t-2', 't-3'])

    // Task A and Task C were completed in period
    expect(completedInPeriod.length).toBe(2)
    expect(completedInPeriod.map((t) => t.id)).toEqual(['t-1', 't-3'])

    // Net productivity ratio: 2 completed / 2 created = 1.0x
    const ratio = Number((completedInPeriod.length / createdInPeriod.length).toFixed(2))
    expect(ratio).toBe(1.0)
  })

  it('counts overdue tasks strictly based on open status and deadline expiration', () => {
    const nowIso = '2026-10-28T12:00:00.000Z'
    const tasks = [
      { id: '1', status: 'todo', deadline_at: '2026-10-20T00:00:00.000Z' }, // Overdue
      { id: '2', status: 'in_progress', deadline_at: '2026-10-27T23:59:59.000Z' }, // Overdue
      { id: '3', status: 'completed', deadline_at: '2026-10-20T00:00:00.000Z' }, // Completed (NOT overdue)
      { id: '4', status: 'todo', deadline_at: '2026-11-05T00:00:00.000Z' }, // Future (NOT overdue)
      { id: '5', status: 'todo', deadline_at: null }, // No deadline (NOT overdue)
    ]

    const openTasks = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress')
    const overdueTasks = openTasks.filter((t) => t.deadline_at && t.deadline_at < nowIso)

    expect(openTasks.length).toBe(4)
    expect(overdueTasks.length).toBe(2)
    expect(overdueTasks.map((t) => t.id)).toEqual(['1', '2'])
  })
})
