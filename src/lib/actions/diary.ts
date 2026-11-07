'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { saveDiaryEntrySchema, toggleFocusTaskSchema } from '@/lib/validations/diary'
import { getDayRangeForDateString, getLocalDateString } from '@/lib/timezone'
import { ActionResponse, CalendarEvent, DiaryEntry, DiaryTaskLink, Task } from '@/types'
import { TaskWithDetails } from '@/lib/actions/tasks'

export interface DiaryDayData {
  entry: DiaryEntry | null
  entryDate: string
  focusTaskIds: string[]
  focusTaskLinks: DiaryTaskLink[]
  focusTasks: TaskWithDetails[]
  scheduledTasks: TaskWithDetails[]
  dueTasks: TaskWithDetails[]
  overdueTasks: TaskWithDetails[]
  completedTasks: TaskWithDetails[]
  availableTasks: TaskWithDetails[]
  calendarEvents: CalendarEvent[]
}

/**
 * Retrieves all diary content, canonical tasks, and calendar events
 * for the specified local date in the user's timezone.
 */
export async function getDiaryDayDataAction(
  dateString?: string,
  userTimezone: string = 'UTC'
): Promise<ActionResponse<DiaryDayData>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    // Default to today in user's timezone if not specified
    const targetDate = dateString || getLocalDateString(userTimezone)
    const { startIso, endIso } = getDayRangeForDateString(targetDate, userTimezone)

    // 1. Fetch or query diary entry
    const { data: entry } = await supabase
      .from('diary_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('entry_date', targetDate)
      .maybeSingle()

    // 2. Fetch diary task links if entry exists
    let focusTaskLinks: DiaryTaskLink[] = []
    let focusTaskIds: string[] = []

    if (entry) {
      const { data: links } = await supabase
        .from('diary_task_links')
        .select('*')
        .eq('diary_entry_id', entry.id)
        .order('sort_order', { ascending: true })

      focusTaskLinks = links || []
      focusTaskIds = focusTaskLinks.filter((l) => l.is_focus_task).map((l) => l.task_id)
    }

    // 3. Fetch user's canonical tasks with project relations
    const { data: rawTasks } = await supabase
      .from('tasks')
      .select('*, projects(id, title, color_hex)')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    type TaskQueryRow = Task & { projects?: { id: string; title: string; color_hex: string } | null }

    const allTasks: TaskWithDetails[] = ((rawTasks as unknown as TaskQueryRow[]) || []).map((t) => {
      const { projects: proj, ...task } = t
      return {
        ...task,
        project: proj || null,
      }
    })

    const tasksMap = new Map<string, TaskWithDetails>(allTasks.map((t) => [t.id, t]))

    // Classify canonical tasks without mutating or duplicating records
    const focusTasks: TaskWithDetails[] = focusTaskIds
      .map((id) => tasksMap.get(id))
      .filter((t): t is TaskWithDetails => Boolean(t))

    const scheduledTasks = allTasks.filter((t) => {
      if (!t.scheduled_start_at) return false
      return t.scheduled_start_at >= startIso && t.scheduled_start_at <= endIso
    })

    const dueTasks = allTasks.filter((t) => {
      if (!t.deadline_at) return false
      return t.deadline_at >= startIso && t.deadline_at <= endIso
    })

    const overdueTasks = allTasks.filter((t) => {
      if (t.status === 'completed' || t.status === 'cancelled') return false
      if (!t.deadline_at) return false
      return t.deadline_at < startIso
    })

    const completedTasks = allTasks.filter((t) => {
      if (t.status !== 'completed' || !t.completed_at) return false
      return t.completed_at >= startIso && t.completed_at <= endIso
    })

    // 4. Fetch calendar events falling on this local day
    const { data: events } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .lte('start_time', endIso)
      .gte('end_time', startIso)
      .order('start_time', { ascending: true })

    return {
      success: true,
      data: {
        entry: entry || null,
        entryDate: targetDate,
        focusTaskIds,
        focusTaskLinks,
        focusTasks,
        scheduledTasks,
        dueTasks,
        overdueTasks,
        completedTasks,
        availableTasks: allTasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled'),
        calendarEvents: events || [],
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch daily diary data'
    return { success: false, error: msg }
  }
}

/**
 * Saves (upserts) the daily diary record for the authenticated user and local date.
 * Guarantees that saving journal notes does not modify task records or schedules.
 */
export async function saveDiaryEntryAction(rawInput: unknown): Promise<ActionResponse<DiaryEntry>> {
  try {
    const parsed = saveDiaryEntrySchema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid diary entry data' }
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { entry_date, ...fields } = parsed.data

    const { data: savedEntry, error } = await supabase
      .from('diary_entries')
      .upsert(
        {
          user_id: user.id,
          entry_date,
          ...fields,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,entry_date' }
      )
      .select()
      .single()

    if (error || !savedEntry) {
      return { success: false, error: error?.message || 'Failed to save diary entry' }
    }

    revalidatePath('/diary')
    revalidatePath('/dashboard')

    return { success: true, data: savedEntry as DiaryEntry }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save diary entry'
    return { success: false, error: msg }
  }
}

/**
 * Adds or removes a canonical task from the daily diary focus list.
 * Safely maintains unique mapping in diary_task_links without duplicating tasks.
 */
export async function toggleDiaryFocusTaskAction(
  rawInput: unknown
): Promise<ActionResponse<{ is_focus_task: boolean }>> {
  try {
    const parsed = toggleFocusTaskSchema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid focus task request' }
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { entry_date, task_id, is_focus_task, reflection_note } = parsed.data

    // 1. Ensure diary entry exists for this user and date
    let { data: diaryEntry } = await supabase
      .from('diary_entries')
      .select('id')
      .eq('user_id', user.id)
      .eq('entry_date', entry_date)
      .maybeSingle()

    if (!diaryEntry) {
      const { data: newEntry, error: createError } = await supabase
        .from('diary_entries')
        .insert({
          user_id: user.id,
          entry_date,
        })
        .select('id')
        .single()

      if (createError || !newEntry) {
        return { success: false, error: 'Failed to initialize diary entry for task linking' }
      }
      diaryEntry = newEntry
    }

    // 2. Add or remove link in diary_task_links
    if (is_focus_task) {
      const { error: upsertError } = await supabase.from('diary_task_links').upsert(
        {
          diary_entry_id: diaryEntry.id,
          task_id,
          is_focus_task: true,
          reflection_note: reflection_note || null,
        },
        { onConflict: 'diary_entry_id,task_id' }
      )

      if (upsertError) {
        return { success: false, error: upsertError.message }
      }
    } else {
      await supabase
        .from('diary_task_links')
        .delete()
        .eq('diary_entry_id', diaryEntry.id)
        .eq('task_id', task_id)
    }

    revalidatePath('/diary')
    revalidatePath('/dashboard')

    return { success: true, data: { is_focus_task } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update focus task'
    return { success: false, error: msg }
  }
}

/**
 * Updates an optional retrospective/reflection note on a linked task in today's diary.
 */
export async function updateTaskReflectionNoteAction(
  diaryEntryId: string,
  taskId: string,
  reflectionNote: string | null
): Promise<ActionResponse<boolean>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { error } = await supabase
      .from('diary_task_links')
      .update({
        reflection_note: reflectionNote ? reflectionNote.trim() : null,
      })
      .eq('diary_entry_id', diaryEntryId)
      .eq('task_id', taskId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/diary')
    return { success: true, data: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save reflection note'
    return { success: false, error: msg }
  }
}

