'use server'

import { createClient } from '@/lib/supabase/server'
import { getReportDateRange, ReportDateRange, localPartsToUtc } from '@/lib/timezone'
import { reportsFilterSchema, ReportsFilterInput } from '@/lib/validations/reports'
import { ActionResponse, Task, Project } from '@/types'

export interface DailyTrendItem {
  date: string
  dayLabel: string
  createdCount: number
  completedCount: number
}

export interface ProjectReportItem {
  id: string
  title: string
  colorHex: string
  totalTasks: number
  completedTasks: number
  completionRate: number
}

export interface PriorityReportItem {
  priority: 'p1' | 'p2' | 'p3' | 'p4'
  label: string
  totalTasks: number
  completedTasks: number
  completionRate: number
}

export interface ReportsData {
  range: ReportDateRange
  tasksSummary: {
    createdInPeriod: number
    completedInPeriod: number
    openTotal: number
    overdueTotal: number
    cancelledInPeriod: number
    netProductivityRatio: number
  }
  dailyTrends: DailyTrendItem[]
  projectBreakdown: ProjectReportItem[]
  priorityBreakdown: PriorityReportItem[]
  calendarWorkload: {
    totalMeetings: number
    meetingMinutes: number
    focusBlocks: number
    focusMinutes: number
    timeBlockedTasks: number
  }
  trainingSummary: {
    sessionsCompleted: number
    hoursLogged: number
    activeCoursesCount: number
  }
  studentReviewsSummary: {
    awaitingReview: number
    inReview: number
    completed: number
    overdueFollowUps: number
  }
  diarySummary: {
    entriesLogged: number
    totalDaysInRange: number
    reflectionCoveragePercent: number
    averageEnergyLevel: number | null
    averageMoodRating: number | null
  }
}

export async function getReportsAction(
  rawFilter?: ReportsFilterInput
): Promise<ActionResponse<ReportsData>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    // 1. Get user profile timezone
    const { data: profile } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', user.id)
      .maybeSingle()

    const timezone = profile?.timezone || 'UTC'

    // 2. Validate filter and resolve date boundaries
    const parsed = reportsFilterSchema.safeParse(rawFilter || { preset: 'this_week' })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid filter' }
    }

    const { preset, start_date, end_date, project_id } = parsed.data
    const range = getReportDateRange(preset, timezone, start_date, end_date)

    // 3. Fetch Tasks (canonical table is source of truth)
    let tasksQuery = supabase
      .from('tasks')
      .select('id, user_id, project_id, title, status, priority, deadline_at, scheduled_start_at, is_time_blocked, created_at, completed_at, updated_at')
      .eq('user_id', user.id)

    if (project_id && project_id !== 'all') {
      tasksQuery = tasksQuery.eq('project_id', project_id)
    }

    const { data: rawTasks, error: tasksError } = await tasksQuery

    if (tasksError) {
      return { success: false, error: tasksError.message }
    }

    const allTasks = (rawTasks as Task[]) || []

    // Distinct metrics:
    // A. Tasks created during period
    const createdInPeriodTasks = allTasks.filter(
      (t) => t.created_at >= range.startIso && t.created_at <= range.endIso
    )

    // B. Tasks completed during period
    const completedInPeriodTasks = allTasks.filter(
      (t) =>
        t.status === 'completed' &&
        t.completed_at &&
        t.completed_at >= range.startIso &&
        t.completed_at <= range.endIso
    )

    // C. Open tasks (currently active)
    const openTasks = allTasks.filter((t) => t.status === 'todo' || t.status === 'in_progress')

    // D. Overdue tasks (open and deadline passed)
    const nowIso = new Date().toISOString()
    const overdueTasks = openTasks.filter(
      (t) => t.deadline_at && t.deadline_at < nowIso
    )

    // E. Cancelled in period
    const cancelledInPeriodTasks = allTasks.filter(
      (t) =>
        t.status === 'cancelled' &&
        t.updated_at >= range.startIso &&
        t.updated_at <= range.endIso
    )

    const netProductivityRatio =
      createdInPeriodTasks.length > 0
        ? Number((completedInPeriodTasks.length / createdInPeriodTasks.length).toFixed(2))
        : completedInPeriodTasks.length > 0
        ? 1
        : 0

    // 4. Daily Trends breakdown across days in range
    const dailyTrends: DailyTrendItem[] = range.dayDates.map((dayDate) => {
      // Day start/end in UTC for this date
      const [y, m, d] = dayDate.split('-').map(Number)
      const dayStart = localPartsToUtc({ year: y, month: m, day: d, hour: 0, minute: 0, second: 0 }, timezone).toISOString()
      const dayEnd = localPartsToUtc({ year: y, month: m, day: d, hour: 23, minute: 59, second: 59 }, timezone).toISOString()

      const createdCount = allTasks.filter(
        (t) => t.created_at >= dayStart && t.created_at <= dayEnd
      ).length

      const completedCount = allTasks.filter(
        (t) =>
          t.status === 'completed' &&
          t.completed_at &&
          t.completed_at >= dayStart &&
          t.completed_at <= dayEnd
      ).length

      // Label (e.g. Mon, Oct 26)
      const dateObj = new Date(`${dayDate}T12:00:00Z`)
      const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })

      return {
        date: dayDate,
        dayLabel,
        createdCount,
        completedCount,
      }
    })

    // 5. Project Breakdown
    const { data: rawProjects } = await supabase
      .from('projects')
      .select('id, title, color_hex')
      .eq('user_id', user.id)

    const projectsList = (rawProjects as Project[]) || []
    const projectMap = new Map<string, Project>()
    for (const p of projectsList) {
      projectMap.set(p.id, p)
    }

    const tasksByProject = new Map<string, Task[]>()
    for (const t of allTasks) {
      const pid = t.project_id || 'no_project'
      const existing = tasksByProject.get(pid) || []
      existing.push(t)
      tasksByProject.set(pid, existing)
    }

    const projectBreakdown: ProjectReportItem[] = []
    for (const [pid, pTasks] of tasksByProject.entries()) {
      const projectMeta = projectMap.get(pid)
      const title = projectMeta ? projectMeta.title : 'Unassigned / Standalone'
      const colorHex = projectMeta ? projectMeta.color_hex : '#64748B'
      const completed = pTasks.filter((t) => t.status === 'completed').length
      const rate = pTasks.length > 0 ? Math.round((completed / pTasks.length) * 100) : 0

      projectBreakdown.push({
        id: pid,
        title,
        colorHex,
        totalTasks: pTasks.length,
        completedTasks: completed,
        completionRate: rate,
      })
    }

    projectBreakdown.sort((a, b) => b.totalTasks - a.totalTasks)

    // 6. Priority Breakdown
    const priorityMeta: Record<'p1' | 'p2' | 'p3' | 'p4', string> = {
      p1: 'P1 - Urgent',
      p2: 'P2 - High',
      p3: 'P3 - Medium',
      p4: 'P4 - Low',
    }

    const priorityBreakdown: PriorityReportItem[] = (['p1', 'p2', 'p3', 'p4'] as const).map((p) => {
      const pTasks = allTasks.filter((t) => t.priority === p)
      const completed = pTasks.filter((t) => t.status === 'completed').length
      const rate = pTasks.length > 0 ? Math.round((completed / pTasks.length) * 100) : 0
      return {
        priority: p,
        label: priorityMeta[p],
        totalTasks: pTasks.length,
        completedTasks: completed,
        completionRate: rate,
      }
    })

    // 7. Calendar Workload (events in range)
    const { data: rawEvents } = await supabase
      .from('calendar_events')
      .select('id, title, event_type, start_time, end_time')
      .eq('user_id', user.id)
      .gte('start_time', range.startIso)
      .lte('start_time', range.endIso)

    const events = rawEvents || []
    let meetingCount = 0
    let meetingMinutes = 0
    let focusCount = 0
    let focusMinutes = 0

    for (const ev of events) {
      const durationMs = new Date(ev.end_time).getTime() - new Date(ev.start_time).getTime()
      const durationMin = Math.max(0, Math.round(durationMs / 60000))

      if (ev.event_type === 'meeting') {
        meetingCount += 1
        meetingMinutes += durationMin
      } else if (ev.event_type === 'focus_block') {
        focusCount += 1
        focusMinutes += durationMin
      }
    }

    const timeBlockedTasksCount = allTasks.filter(
      (t) =>
        t.is_time_blocked &&
        t.scheduled_start_at &&
        t.scheduled_start_at >= range.startIso &&
        t.scheduled_start_at <= range.endIso
    ).length

    // 8. Training Summary
    const { data: rawSessions } = await supabase
      .from('training_sessions')
      .select('id, course_id, status, actual_duration_minutes, scheduled_start')
      .gte('scheduled_start', range.startIso)
      .lte('scheduled_start', range.endIso)

    const sessions = rawSessions || []
    const completedSessions = sessions.filter((s) => s.status === 'completed')
    const loggedMinutes = completedSessions.reduce((sum, s) => sum + (s.actual_duration_minutes || 0), 0)
    const hoursLogged = Number((loggedMinutes / 60).toFixed(1))

    const { count: activeCoursesCount } = await supabase
      .from('training_courses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active')

    // 9. Student Reviews Summary
    const { data: rawReviews } = await supabase
      .from('student_reviews')
      .select('id, status, follow_up_due_at, follow_up_task_id')
      .eq('user_id', user.id)

    const reviews = rawReviews || []
    const awaitingReview = reviews.filter((r) => r.status === 'awaiting_review').length
    const inReview = reviews.filter((r) => r.status === 'in_review').length
    const completedReviews = reviews.filter((r) => r.status === 'completed').length
    const overdueFollowUps = reviews.filter(
      (r) =>
        r.follow_up_due_at &&
        r.follow_up_due_at < nowIso &&
        r.status !== 'completed'
    ).length

    // 10. Daily Diary Summary
    const { data: rawDiary } = await supabase
      .from('diary_entries')
      .select('id, entry_date, energy_level, mood_rating')
      .eq('user_id', user.id)
      .gte('entry_date', range.startDate)
      .lte('entry_date', range.endDate)

    const diaryEntries = rawDiary || []
    const totalDaysInRange = range.dayDates.length || 1
    const reflectionCoveragePercent = Math.min(
      100,
      Math.round((diaryEntries.length / totalDaysInRange) * 100)
    )

    const energies = diaryEntries.map((d) => d.energy_level).filter((n): n is number => n !== null && n !== undefined)
    const moods = diaryEntries.map((d) => d.mood_rating).filter((n): n is number => n !== null && n !== undefined)

    const averageEnergyLevel =
      energies.length > 0 ? Number((energies.reduce((a, b) => a + b, 0) / energies.length).toFixed(1)) : null
    const averageMoodRating =
      moods.length > 0 ? Number((moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1)) : null

    return {
      success: true,
      data: {
        range,
        tasksSummary: {
          createdInPeriod: createdInPeriodTasks.length,
          completedInPeriod: completedInPeriodTasks.length,
          openTotal: openTasks.length,
          overdueTotal: overdueTasks.length,
          cancelledInPeriod: cancelledInPeriodTasks.length,
          netProductivityRatio,
        },
        dailyTrends,
        projectBreakdown,
        priorityBreakdown,
        calendarWorkload: {
          totalMeetings: meetingCount,
          meetingMinutes,
          focusBlocks: focusCount,
          focusMinutes,
          timeBlockedTasks: timeBlockedTasksCount,
        },
        trainingSummary: {
          sessionsCompleted: completedSessions.length,
          hoursLogged,
          activeCoursesCount: activeCoursesCount || 0,
        },
        studentReviewsSummary: {
          awaitingReview,
          inReview,
          completed: completedReviews,
          overdueFollowUps,
        },
        diarySummary: {
          entriesLogged: diaryEntries.length,
          totalDaysInRange,
          reflectionCoveragePercent,
          averageEnergyLevel,
          averageMoodRating,
        },
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate report'
    return { success: false, error: msg }
  }
}
