'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getWeekBoundaries, WeekBoundaries } from '@/lib/timezone'
import { saveWeeklyReviewSchema } from '@/lib/validations/weekly-review'
import { ActionResponse, WeeklyReview, Task, Project, DiaryEntry } from '@/types'

export interface WeeklyReviewComputedData {
  week: WeekBoundaries
  savedReview: WeeklyReview | null
  tasks: {
    completedThisWeek: Task[]
    createdThisWeekCount: number
    remainingOpenCount: number
    overdueCount: number
  }
  projects: {
    progressed: Array<{ id: string; title: string; colorHex: string; completedCount: number }>
    stalled: Array<{ id: string; title: string; colorHex: string; openCount: number }>
  }
  calendar: {
    totalMeetings: number
    meetingMinutes: number
    focusBlocks: number
    focusMinutes: number
  }
  training: {
    sessionsCompleted: number
    hoursLogged: number
  }
  studentReviews: {
    awaitingReviewCount: number
    overdueFollowUpsCount: number
  }
  diaryHighlights: {
    entriesCount: number
    wins: string[]
    challenges: string[]
    lessonsLearned: string[]
    intentions: string[]
  }
}

export async function getWeeklyReviewDataAction(
  requestedWeekStart?: string
): Promise<ActionResponse<WeeklyReviewComputedData>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    // 1. Resolve user timezone
    const { data: profile } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', user.id)
      .maybeSingle()

    const timezone = profile?.timezone || 'UTC'

    // 2. Resolve week boundaries
    let referenceDate = new Date()
    if (requestedWeekStart) {
      referenceDate = new Date(`${requestedWeekStart}T12:00:00Z`)
    }
    const week = getWeekBoundaries(referenceDate, timezone, 1)

    // 3. Fetch any existing saved user reflection for this week
    const { data: savedReview } = await supabase
      .from('weekly_reviews')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start_date', week.weekStartDate)
      .maybeSingle()

    // 4. Tasks analytics from canonical tasks table
    const { data: rawTasks } = await supabase
      .from('tasks')
      .select('id, user_id, project_id, title, status, priority, deadline_at, created_at, completed_at, updated_at')
      .eq('user_id', user.id)

    const allTasks = (rawTasks as Task[]) || []

    const completedThisWeek = allTasks.filter(
      (t) =>
        t.status === 'completed' &&
        t.completed_at &&
        t.completed_at >= week.startIso &&
        t.completed_at <= week.endIso
    )

    const createdThisWeekCount = allTasks.filter(
      (t) => t.created_at >= week.startIso && t.created_at <= week.endIso
    ).length

    const openTasks = allTasks.filter((t) => t.status === 'todo' || t.status === 'in_progress')
    const overdueCount = openTasks.filter(
      (t) => t.deadline_at && t.deadline_at < new Date().toISOString()
    ).length

    // 5. Projects progressed vs stalled
    const { data: rawProjects } = await supabase
      .from('projects')
      .select('id, title, color_hex')
      .eq('user_id', user.id)

    const projectsList = (rawProjects as Project[]) || []
    const progressedProjects: WeeklyReviewComputedData['projects']['progressed'] = []
    const stalledProjects: WeeklyReviewComputedData['projects']['stalled'] = []

    for (const proj of projectsList) {
      const projTasks = allTasks.filter((t) => t.project_id === proj.id)
      const projCompletedThisWeek = projTasks.filter(
        (t) =>
          t.status === 'completed' &&
          t.completed_at &&
          t.completed_at >= week.startIso &&
          t.completed_at <= week.endIso
      ).length

      const projOpen = projTasks.filter((t) => t.status === 'todo' || t.status === 'in_progress').length

      if (projCompletedThisWeek > 0) {
        progressedProjects.push({
          id: proj.id,
          title: proj.title,
          colorHex: proj.color_hex,
          completedCount: projCompletedThisWeek,
        })
      } else if (projOpen > 0) {
        stalledProjects.push({
          id: proj.id,
          title: proj.title,
          colorHex: proj.color_hex,
          openCount: projOpen,
        })
      }
    }

    // 6. Calendar Workload
    const { data: rawEvents } = await supabase
      .from('calendar_events')
      .select('id, event_type, start_time, end_time')
      .eq('user_id', user.id)
      .gte('start_time', week.startIso)
      .lte('start_time', week.endIso)

    const events = rawEvents || []
    let totalMeetings = 0
    let meetingMinutes = 0
    let focusBlocks = 0
    let focusMinutes = 0

    for (const ev of events) {
      const dur = Math.max(
        0,
        Math.round((new Date(ev.end_time).getTime() - new Date(ev.start_time).getTime()) / 60000)
      )
      if (ev.event_type === 'meeting') {
        totalMeetings += 1
        meetingMinutes += dur
      } else if (ev.event_type === 'focus_block') {
        focusBlocks += 1
        focusMinutes += dur
      }
    }

    // 7. Training Sessions
    const { data: rawSessions } = await supabase
      .from('training_sessions')
      .select('id, status, actual_duration_minutes, scheduled_start')
      .gte('scheduled_start', week.startIso)
      .lte('scheduled_start', week.endIso)

    const sessions = (rawSessions || []).filter((s) => s.status === 'completed')
    const trainingMinutes = sessions.reduce((sum, s) => sum + (s.actual_duration_minutes || 0), 0)

    // 8. Student Reviews
    const { data: rawReviews } = await supabase
      .from('student_reviews')
      .select('id, status, follow_up_due_at')
      .eq('user_id', user.id)

    const reviews = rawReviews || []
    const awaitingReviewCount = reviews.filter((r) => r.status === 'awaiting_review').length
    const nowIso = new Date().toISOString()
    const overdueFollowUpsCount = reviews.filter(
      (r) => r.follow_up_due_at && r.follow_up_due_at < nowIso && r.status !== 'completed'
    ).length

    // 9. Diary Highlights from this week's entries
    const { data: rawDiary } = await supabase
      .from('diary_entries')
      .select('entry_date, morning_intentions, wins, challenges, lessons_learned')
      .eq('user_id', user.id)
      .gte('entry_date', week.weekStartDate)
      .lte('entry_date', week.weekEndDate)
      .order('entry_date', { ascending: true })

    const diaryEntries = (rawDiary as DiaryEntry[]) || []
    const diaryWins: string[] = []
    const diaryChallenges: string[] = []
    const diaryLessons: string[] = []
    const diaryIntentions: string[] = []

    for (const d of diaryEntries) {
      if (d.wins && d.wins.trim()) diaryWins.push(`${d.entry_date}: ${d.wins.trim()}`)
      if (d.challenges && d.challenges.trim()) diaryChallenges.push(`${d.entry_date}: ${d.challenges.trim()}`)
      if (d.lessons_learned && d.lessons_learned.trim())
        diaryLessons.push(`${d.entry_date}: ${d.lessons_learned.trim()}`)
      if (d.morning_intentions && d.morning_intentions.trim())
        diaryIntentions.push(`${d.entry_date}: ${d.morning_intentions.trim()}`)
    }

    return {
      success: true,
      data: {
        week,
        savedReview: savedReview ? (savedReview as WeeklyReview) : null,
        tasks: {
          completedThisWeek,
          createdThisWeekCount,
          remainingOpenCount: openTasks.length,
          overdueCount,
        },
        projects: {
          progressed: progressedProjects,
          stalled: stalledProjects,
        },
        calendar: {
          totalMeetings,
          meetingMinutes,
          focusBlocks,
          focusMinutes,
        },
        training: {
          sessionsCompleted: sessions.length,
          hoursLogged: Number((trainingMinutes / 60).toFixed(1)),
        },
        studentReviews: {
          awaitingReviewCount,
          overdueFollowUpsCount,
        },
        diaryHighlights: {
          entriesCount: diaryEntries.length,
          wins: diaryWins,
          challenges: diaryChallenges,
          lessonsLearned: diaryLessons,
          intentions: diaryIntentions,
        },
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch weekly review'
    return { success: false, error: msg }
  }
}

export async function saveWeeklyReviewAction(
  rawInput: unknown
): Promise<ActionResponse<WeeklyReview>> {
  try {
    const parsed = saveWeeklyReviewSchema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid review data' }
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { week_start_date, reflection_content, wins, challenges, lessons_learned, next_week_priorities } =
      parsed.data

    // Upsert into weekly_reviews on unique constraint (user_id, week_start_date)
    const { data: saved, error: upsertError } = await supabase
      .from('weekly_reviews')
      .upsert(
        {
          user_id: user.id,
          week_start_date,
          reflection_content: reflection_content || null,
          wins: wins || null,
          challenges: challenges || null,
          lessons_learned: lessons_learned || null,
          next_week_priorities: next_week_priorities || null,
        },
        {
          onConflict: 'user_id,week_start_date',
        }
      )
      .select()
      .single()

    if (upsertError || !saved) {
      return { success: false, error: upsertError?.message || 'Failed to save weekly review' }
    }

    revalidatePath('/weekly-review')
    revalidatePath('/reports')
    return { success: true, data: saved as WeeklyReview }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save weekly review'
    return { success: false, error: msg }
  }
}
