'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  reminderRuleSchema,
  reminderSettingsSchema,
  ReminderRuleInput,
  ReminderSettingsInput,
} from '@/lib/validations/reminders'
import {
  syncTaskReminders,
  syncEventReminders,
} from '@/lib/reminders/scheduler'
import { ReminderDeliveryWithDetails } from '@/lib/reminders/types'
import { ActionResponse, ReminderRule } from '@/types'
import { z } from 'zod'

/**
 * Retrieves the authenticated user's reminder configuration and default preferences.
 */
export async function getUserRemindersSettingsAction(): Promise<
  ActionResponse<ReminderSettingsInput>
> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { data: settings, error } = await supabase
      .from('user_settings')
      .select('task_default_reminders, event_default_reminders, reminders_enabled_by_default')
      .eq('user_id', user.id)
      .single()

    if (error || !settings) {
      return {
        success: true,
        data: {
          task_default_reminders: [
            { offset_minutes: 15, is_relative_to_start: true, channel: 'in_app', is_active: true },
          ],
          event_default_reminders: [
            { offset_minutes: 10, is_relative_to_start: true, channel: 'in_app', is_active: true },
          ],
          reminders_enabled_by_default: true,
        },
      }
    }

    const taskDefaults = Array.isArray(settings.task_default_reminders)
      ? (settings.task_default_reminders as ReminderRuleInput[])
      : [{ offset_minutes: 15, is_relative_to_start: true, channel: 'in_app' as const, is_active: true }]

    const eventDefaults = Array.isArray(settings.event_default_reminders)
      ? (settings.event_default_reminders as ReminderRuleInput[])
      : [{ offset_minutes: 10, is_relative_to_start: true, channel: 'in_app' as const, is_active: true }]

    return {
      success: true,
      data: {
        task_default_reminders: taskDefaults,
        event_default_reminders: eventDefaults,
        reminders_enabled_by_default: settings.reminders_enabled_by_default ?? true,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch reminder settings'
    return { success: false, error: msg }
  }
}

/**
 * Updates default reminder presets and global reminder preferences for the authenticated user.
 */
export async function updateUserRemindersSettingsAction(
  rawInput: unknown
): Promise<ActionResponse<ReminderSettingsInput>> {
  try {
    const parsed = reminderSettingsSchema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid settings data' }
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const updatePayload = {
      task_default_reminders: JSON.parse(JSON.stringify(parsed.data.task_default_reminders)),
      event_default_reminders: JSON.parse(JSON.stringify(parsed.data.event_default_reminders)),
      reminders_enabled_by_default: parsed.data.reminders_enabled_by_default,
    }

    const { error } = await supabase
      .from('user_settings')
      .update(updatePayload)
      .eq('user_id', user.id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/settings')
    return { success: true, data: parsed.data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update reminder settings'
    return { success: false, error: msg }
  }
}

/**
 * Retrieves configured reminder rules for a specific task or calendar event.
 */
export async function getItemRemindersAction(target: {
  taskId?: string
  eventId?: string
}): Promise<ActionResponse<ReminderRule[]>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    let query = supabase
      .from('reminder_rules')
      .select('*')
      .eq('user_id', user.id)
      .order('offset_minutes', { ascending: true })

    if (target.taskId) {
      query = query.eq('task_id', target.taskId)
    } else if (target.eventId) {
      query = query.eq('calendar_event_id', target.eventId)
    } else {
      return { success: false, error: 'Target taskId or eventId is required' }
    }

    const { data: rules, error } = await query
    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: rules as ReminderRule[] }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch item reminders'
    return { success: false, error: msg }
  }
}

/**
 * Saves or updates reminders for a task or calendar event.
 */
export async function saveItemRemindersAction(params: {
  taskId?: string
  eventId?: string
  reminders: ReminderRuleInput[]
}): Promise<ActionResponse<void>> {
  try {
    const parsedReminders = z.array(reminderRuleSchema).safeParse(params.reminders)
    if (!parsedReminders.success) {
      return {
        success: false,
        error: parsedReminders.error.issues[0]?.message || 'Invalid reminder configuration',
      }
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    if (params.taskId) {
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', params.taskId)
        .eq('user_id', user.id)
        .single()

      if (taskError || !task) {
        return { success: false, error: 'Task not found' }
      }

      await syncTaskReminders(
        supabase,
        user.id,
        task.id,
        task.title,
        parsedReminders.data,
        {
          scheduled_start_at: task.scheduled_start_at,
          deadline_at: task.deadline_at,
          status: task.status,
        }
      )
    } else if (params.eventId) {
      const { data: event, error: eventError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('id', params.eventId)
        .eq('user_id', user.id)
        .single()

      if (eventError || !event) {
        return { success: false, error: 'Calendar event not found' }
      }

      await syncEventReminders(
        supabase,
        user.id,
        event.id,
        event.title,
        parsedReminders.data,
        event.start_time
      )
    } else {
      return { success: false, error: 'Either taskId or eventId must be provided' }
    }

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save reminders'
    return { success: false, error: msg }
  }
}

/**
 * Retrieves delivery history for the authenticated user.
 */
export async function getDeliveryHistoryAction(
  limit: number = 30
): Promise<ActionResponse<ReminderDeliveryWithDetails[]>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { data: deliveries, error } = await supabase
      .from('reminder_deliveries')
      .select('*, reminder_rules(*), tasks(id, title, status), calendar_events(id, title)')
      .eq('user_id', user.id)
      .order('scheduled_for', { ascending: false })
      .limit(limit)

    if (error) {
      return { success: false, error: error.message }
    }

    type RawDeliveryRow = ReminderDeliveryWithDetails & {
      reminder_rules?: ReminderRule | null
      tasks?: { id: string; title: string; status: string } | null
      calendar_events?: { id: string; title: string } | null
    }

    const formatted: ReminderDeliveryWithDetails[] = (
      (deliveries as unknown as RawDeliveryRow[]) || []
    ).map((d) => {
      const { reminder_rules: r, tasks: t, calendar_events: e, ...rest } = d
      return {
        ...rest,
        rule: r || null,
        task: t || null,
        event: e || null,
      }
    })

    return { success: true, data: formatted }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch delivery history'
    return { success: false, error: msg }
  }
}

