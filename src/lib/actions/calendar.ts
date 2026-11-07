'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  createCalendarEventSchema,
  updateCalendarEventSchema,
} from '@/lib/validations/calendar'
import {
  syncEventReminders,
  cancelPendingDeliveriesForItem,
  recalculateDeliveriesForScheduleChange,
} from '@/lib/reminders/scheduler'
import { ReminderItemInput } from '@/lib/reminders/types'
import { ActionResponse, CalendarEvent, Task, Updates } from '@/types'

export type CalendarEventWithDetails = CalendarEvent & {
  project?: {
    id: string
    title: string
    color_hex: string
  } | null
  task?: {
    id: string
    title: string
    status: string
  } | null
}

export interface CalendarFeed {
  events: CalendarEventWithDetails[]
  scheduledTasks: Array<Task & { project?: { id: string; title: string; color_hex: string } | null }>
  deadlineTasks: Array<Task & { project?: { id: string; title: string; color_hex: string } | null }>
}

/**
 * Fetches calendar events, scheduled task timeblocks, and deadline indicators
 * within the requested ISO date range for the authenticated user.
 */
export async function getCalendarFeedAction(
  startIso: string,
  endIso: string
): Promise<ActionResponse<CalendarFeed>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    // 1. Fetch Calendar Events overlapping with the window:
    // Event start_time <= window_end AND end_time >= window_start
    const { data: rawEvents, error: eventsError } = await supabase
      .from('calendar_events')
      .select('*, projects(id, title, color_hex), tasks(id, title, status)')
      .eq('user_id', user.id)
      .lte('start_time', endIso)
      .gte('end_time', startIso)
      .order('start_time', { ascending: true })

    if (eventsError) {
      return { success: false, error: eventsError.message }
    }

    // 2. Fetch Tasks with Scheduled Timeblocks overlapping with the window
    const { data: rawScheduledTasks, error: scheduledTasksError } = await supabase
      .from('tasks')
      .select('*, projects(id, title, color_hex)')
      .eq('user_id', user.id)
      .not('scheduled_start_at', 'is', null)
      .not('scheduled_end_at', 'is', null)
      .lte('scheduled_start_at', endIso)
      .gte('scheduled_end_at', startIso)
      .order('scheduled_start_at', { ascending: true })

    if (scheduledTasksError) {
      return { success: false, error: scheduledTasksError.message }
    }

    // 3. Fetch Tasks with Deadlines falling within the window
    const { data: rawDeadlineTasks, error: deadlineTasksError } = await supabase
      .from('tasks')
      .select('*, projects(id, title, color_hex)')
      .eq('user_id', user.id)
      .not('deadline_at', 'is', null)
      .gte('deadline_at', startIso)
      .lte('deadline_at', endIso)
      .order('deadline_at', { ascending: true })

    if (deadlineTasksError) {
      return { success: false, error: deadlineTasksError.message }
    }

    type EventRow = CalendarEvent & {
      projects?: { id: string; title: string; color_hex: string } | null
      tasks?: { id: string; title: string; status: string } | null
    }

    const events: CalendarEventWithDetails[] = ((rawEvents as unknown as EventRow[]) || []).map((e) => {
      const { projects: proj, tasks: linkedTask, ...ev } = e
      return {
        ...ev,
        project: proj || null,
        task: linkedTask || null,
      }
    })

    type TaskRow = Task & {
      projects?: { id: string; title: string; color_hex: string } | null
    }

    const scheduledTasks = ((rawScheduledTasks as unknown as TaskRow[]) || []).map((t) => {
      const { projects: proj, ...task } = t
      return {
        ...task,
        project: proj || null,
      }
    })

    const deadlineTasks = ((rawDeadlineTasks as unknown as TaskRow[]) || []).map((t) => {
      const { projects: proj, ...task } = t
      return {
        ...task,
        project: proj || null,
      }
    })

    return {
      success: true,
      data: {
        events,
        scheduledTasks,
        deadlineTasks,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch calendar feed'
    return { success: false, error: msg }
  }
}

/**
 * Creates a calendar event with server validation and ownership check.
 */
export async function createCalendarEventAction(
  rawInput: unknown
): Promise<ActionResponse<CalendarEvent>> {
  try {
    const parsed = createCalendarEventSchema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid calendar event data' }
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { attendees, meeting_url, reminders, ...eventFields } = parsed.data

    const insertPayload = {
      ...eventFields,
      user_id: user.id,
      meeting_url: meeting_url || null,
      attendees: attendees ? JSON.parse(JSON.stringify(attendees)) : [],
    }

    const { data: createdEvent, error } = await supabase
      .from('calendar_events')
      .insert(insertPayload)
      .select()
      .single()

    if (error || !createdEvent) {
      return { success: false, error: error?.message || 'Failed to create calendar event' }
    }

    // Sync reminders if provided or apply defaults
    let effectiveReminders: ReminderItemInput[] = (reminders as ReminderItemInput[]) || []
    if (!reminders) {
      const { data: settings } = await supabase
        .from('user_settings')
        .select('event_default_reminders, reminders_enabled_by_default')
        .eq('user_id', user.id)
        .maybeSingle()

      if (settings?.reminders_enabled_by_default && Array.isArray(settings.event_default_reminders)) {
        effectiveReminders = settings.event_default_reminders as unknown as ReminderItemInput[]
      }
    }

    if (effectiveReminders.length > 0) {
      await syncEventReminders(
        supabase,
        user.id,
        createdEvent.id,
        createdEvent.title,
        effectiveReminders,
        createdEvent.start_time
      )
    }

    revalidatePath('/calendar')
    revalidatePath('/dashboard')

    return { success: true, data: createdEvent as CalendarEvent }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create calendar event'
    return { success: false, error: msg }
  }
}

/**
 * Updates an existing calendar event owned by the authenticated user.
 */
export async function updateCalendarEventAction(
  rawInput: unknown
): Promise<ActionResponse<CalendarEvent>> {
  try {
    const parsed = updateCalendarEventSchema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid calendar event update' }
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { id, attendees, meeting_url, reminders, ...updateFields } = parsed.data

    const updatePayload: Updates<'calendar_events'> = {
      ...updateFields,
    }

    if (meeting_url !== undefined) {
      updatePayload.meeting_url = meeting_url || null
    }

    if (attendees !== undefined) {
      updatePayload.attendees = JSON.parse(JSON.stringify(attendees))
    }

    const { data: updatedEvent, error } = await supabase
      .from('calendar_events')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !updatedEvent) {
      return { success: false, error: error?.message || 'Failed to update calendar event' }
    }

    if (updateFields.start_time !== undefined) {
      await recalculateDeliveriesForScheduleChange(supabase, {
        eventId: id,
        newScheduledStart: updatedEvent.start_time,
      })
    }

    if (reminders !== undefined) {
      await syncEventReminders(
        supabase,
        user.id,
        updatedEvent.id,
        updatedEvent.title,
        reminders as ReminderItemInput[],
        updatedEvent.start_time
      )
    }

    revalidatePath('/calendar')
    revalidatePath('/dashboard')

    return { success: true, data: updatedEvent as CalendarEvent }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update calendar event'
    return { success: false, error: msg }
  }
}

/**
 * Deletes a calendar event owned by the authenticated user.
 */
export async function deleteCalendarEventAction(eventId: string): Promise<ActionResponse<void>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    await cancelPendingDeliveriesForItem(supabase, { eventId })

    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', eventId)
      .eq('user_id', user.id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/calendar')
    revalidatePath('/dashboard')

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete calendar event'
    return { success: false, error: msg }
  }
}

/**
 * Schedules or reschedules an existing task timeblock.
 * Preserves deadlines without changing or overwriting deadline_at.
 */
export async function scheduleTaskTimeblockAction(opts: {
  taskId: string
  scheduledStart: string
  scheduledEnd: string
  isTimeBlocked?: boolean
}): Promise<ActionResponse<Task>> {
  try {
    if (new Date(opts.scheduledEnd).getTime() <= new Date(opts.scheduledStart).getTime()) {
      return { success: false, error: 'Scheduled end time must be after scheduled start time' }
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    // Fetch existing task to preserve deadline and audit
    const { data: existingTask, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', opts.taskId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingTask) {
      return { success: false, error: 'Task not found' }
    }

    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update({
        scheduled_start_at: opts.scheduledStart,
        scheduled_end_at: opts.scheduledEnd,
        is_time_blocked: opts.isTimeBlocked ?? true,
      })
      .eq('id', opts.taskId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError || !updatedTask) {
      return { success: false, error: updateError?.message || 'Failed to schedule task' }
    }

    // Insert reschedule history audit log
    await supabase.from('task_reschedule_history').insert({
      user_id: user.id,
      task_id: opts.taskId,
      previous_scheduled_start: existingTask.scheduled_start_at,
      new_scheduled_start: opts.scheduledStart,
      previous_deadline: existingTask.deadline_at,
      new_deadline: existingTask.deadline_at, // Preserved exactly
      reason: 'Scheduled calendar time block',
    })

    revalidatePath('/calendar')
    revalidatePath('/tasks')
    revalidatePath('/dashboard')

    return { success: true, data: updatedTask as Task }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to schedule task timeblock'
    return { success: false, error: msg }
  }
}

