import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { ReminderItemInput, ReminderChannel } from './types'
import { notificationDispatcher } from './providers'

export const EXPONENTIAL_BACKOFF_MS = [
  60 * 1000, // Attempt 1: 1 min
  5 * 60 * 1000, // Attempt 2: 5 min
  15 * 60 * 1000, // Attempt 3: 15 min
]

/**
 * Computes scheduled delivery timestamp by subtracting offsetMinutes from baseTimeIso.
 */
export function calculateDeliveryTime(baseTimeIso: string, offsetMinutes: number): string {
  const baseMs = new Date(baseTimeIso).getTime()
  return new Date(baseMs - offsetMinutes * 60 * 1000).toISOString()
}

/**
 * Calculates exponential backoff next retry timestamp.
 */
export function getNextRetryTimestamp(attemptCount: number, baseDate: Date = new Date()): string {
  const index = Math.min(attemptCount - 1, EXPONENTIAL_BACKOFF_MS.length - 1)
  const delayMs = EXPONENTIAL_BACKOFF_MS[Math.max(0, index)]
  return new Date(baseDate.getTime() + delayMs).toISOString()
}

/**
 * Synchronizes multiple reminders for a task, creating rules and scheduling deliveries.
 */
export async function syncTaskReminders(
  supabase: SupabaseClient<Database>,
  userId: string,
  taskId: string,
  taskTitle: string,
  reminders: ReminderItemInput[],
  schedule: {
    scheduled_start_at?: string | null
    deadline_at?: string | null
    status?: string
  }
): Promise<void> {
  // If task is completed or cancelled, cancel all pending deliveries
  if (schedule.status === 'completed' || schedule.status === 'cancelled') {
    await cancelPendingDeliveriesForItem(supabase, { taskId })
    return
  }

  // Fetch existing rules for this task
  const { data: existingRules } = await supabase
    .from('reminder_rules')
    .select('*')
    .eq('task_id', taskId)
    .eq('user_id', userId)

  const existingRuleIds = new Set((existingRules || []).map((r) => r.id))
  const keptRuleIds = new Set<string>()

  for (const r of reminders) {
    // Determine the base reference time: start vs deadline
    const baseTimeIso = r.is_relative_to_start
      ? schedule.scheduled_start_at
      : schedule.deadline_at

    // If item has no valid time for this reference, skip scheduling
    if (!baseTimeIso) continue

    const scheduledFor = calculateDeliveryTime(baseTimeIso, r.offset_minutes)

    let ruleId = r.id

    if (ruleId && existingRuleIds.has(ruleId)) {
      // Update existing rule
      await supabase
        .from('reminder_rules')
        .update({
          offset_minutes: r.offset_minutes,
          is_relative_to_start: r.is_relative_to_start,
          channel: r.channel,
          is_active: r.is_active ?? true,
        })
        .eq('id', ruleId)
        .eq('user_id', userId)

      keptRuleIds.add(ruleId)
    } else {
      // Check for duplicate rule
      const { data: existingDup } = await supabase
        .from('reminder_rules')
        .select('id')
        .eq('task_id', taskId)
        .eq('offset_minutes', r.offset_minutes)
        .eq('channel', r.channel)
        .maybeSingle()

      if (existingDup) {
        ruleId = existingDup.id
        keptRuleIds.add(ruleId)
      } else {
        const { data: newRule } = await supabase
          .from('reminder_rules')
          .insert({
            user_id: userId,
            task_id: taskId,
            calendar_event_id: null,
            offset_minutes: r.offset_minutes,
            is_relative_to_start: r.is_relative_to_start,
            channel: r.channel,
            is_active: r.is_active ?? true,
          })
          .select('id')
          .single()

        if (newRule) {
          ruleId = newRule.id
          keptRuleIds.add(ruleId)
        }
      }
    }

    if (!ruleId || r.is_active === false) continue

    // Schedule delivery record with idempotency key
    const idempotencyKey = `task_${taskId}_rule_${ruleId}_${scheduledFor}`
    const offsetLabel = r.offset_minutes === 0 ? 'now' : `in ${r.offset_minutes} minutes`
    const title = `Reminder: ${taskTitle}`
    const body = `Your task "${taskTitle}" is scheduled ${offsetLabel}.`

    // Check if delivery already exists
    const { data: existingDelivery } = await supabase
      .from('reminder_deliveries')
      .select('id, status')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()

    if (!existingDelivery) {
      await supabase.from('reminder_deliveries').insert({
        user_id: userId,
        reminder_rule_id: ruleId,
        task_id: taskId,
        calendar_event_id: null,
        scheduled_for: scheduledFor,
        status: 'scheduled',
        idempotency_key: idempotencyKey,
        title,
        body,
      })
    } else if (existingDelivery.status === 'cancelled') {
      // Re-activate if rescheduled back into an active state
      await supabase
        .from('reminder_deliveries')
        .update({ status: 'scheduled', scheduled_for: scheduledFor })
        .eq('id', existingDelivery.id)
    }
  }

  // Remove deleted rules and their pending deliveries
  for (const oldRuleId of existingRuleIds) {
    if (!keptRuleIds.has(oldRuleId)) {
      await supabase
        .from('reminder_deliveries')
        .delete()
        .eq('reminder_rule_id', oldRuleId)
        .in('status', ['scheduled', 'pending'])

      await supabase
        .from('reminder_rules')
        .delete()
        .eq('id', oldRuleId)
        .eq('user_id', userId)
    }
  }
}

/**
 * Synchronizes multiple reminders for a calendar event.
 */
export async function syncEventReminders(
  supabase: SupabaseClient<Database>,
  userId: string,
  eventId: string,
  eventTitle: string,
  reminders: ReminderItemInput[],
  eventStartIso: string
): Promise<void> {
  const { data: existingRules } = await supabase
    .from('reminder_rules')
    .select('*')
    .eq('calendar_event_id', eventId)
    .eq('user_id', userId)

  const existingRuleIds = new Set((existingRules || []).map((r) => r.id))
  const keptRuleIds = new Set<string>()

  for (const r of reminders) {
    const scheduledFor = calculateDeliveryTime(eventStartIso, r.offset_minutes)

    let ruleId = r.id

    if (ruleId && existingRuleIds.has(ruleId)) {
      await supabase
        .from('reminder_rules')
        .update({
          offset_minutes: r.offset_minutes,
          is_relative_to_start: true,
          channel: r.channel,
          is_active: r.is_active ?? true,
        })
        .eq('id', ruleId)
        .eq('user_id', userId)

      keptRuleIds.add(ruleId)
    } else {
      const { data: existingDup } = await supabase
        .from('reminder_rules')
        .select('id')
        .eq('calendar_event_id', eventId)
        .eq('offset_minutes', r.offset_minutes)
        .eq('channel', r.channel)
        .maybeSingle()

      if (existingDup) {
        ruleId = existingDup.id
        keptRuleIds.add(ruleId)
      } else {
        const { data: newRule } = await supabase
          .from('reminder_rules')
          .insert({
            user_id: userId,
            task_id: null,
            calendar_event_id: eventId,
            offset_minutes: r.offset_minutes,
            is_relative_to_start: true,
            channel: r.channel,
            is_active: r.is_active ?? true,
          })
          .select('id')
          .single()

        if (newRule) {
          ruleId = newRule.id
          keptRuleIds.add(ruleId)
        }
      }
    }

    if (!ruleId || r.is_active === false) continue

    const idempotencyKey = `event_${eventId}_rule_${ruleId}_${scheduledFor}`
    const offsetLabel = r.offset_minutes === 0 ? 'now' : `in ${r.offset_minutes} minutes`
    const title = `Event Reminder: ${eventTitle}`
    const body = `"${eventTitle}" starts ${offsetLabel}.`

    const { data: existingDelivery } = await supabase
      .from('reminder_deliveries')
      .select('id, status')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()

    if (!existingDelivery) {
      await supabase.from('reminder_deliveries').insert({
        user_id: userId,
        reminder_rule_id: ruleId,
        task_id: null,
        calendar_event_id: eventId,
        scheduled_for: scheduledFor,
        status: 'scheduled',
        idempotency_key: idempotencyKey,
        title,
        body,
      })
    } else if (existingDelivery.status === 'cancelled') {
      await supabase
        .from('reminder_deliveries')
        .update({ status: 'scheduled', scheduled_for: scheduledFor })
        .eq('id', existingDelivery.id)
    }
  }

  for (const oldRuleId of existingRuleIds) {
    if (!keptRuleIds.has(oldRuleId)) {
      await supabase
        .from('reminder_deliveries')
        .delete()
        .eq('reminder_rule_id', oldRuleId)
        .in('status', ['scheduled', 'pending'])

      await supabase
        .from('reminder_rules')
        .delete()
        .eq('id', oldRuleId)
        .eq('user_id', userId)
    }
  }
}

/**
 * Cancels pending deliveries for a specific task or calendar event.
 */
export async function cancelPendingDeliveriesForItem(
  supabase: SupabaseClient<Database>,
  target: { taskId?: string; eventId?: string }
): Promise<void> {
  let query = supabase
    .from('reminder_deliveries')
    .update({ status: 'cancelled' })
    .in('status', ['scheduled', 'pending'])

  if (target.taskId) {
    query = query.eq('task_id', target.taskId)
  } else if (target.eventId) {
    query = query.eq('calendar_event_id', target.eventId)
  } else {
    return
  }

  await query
}

/**
 * Recalculates future delivery times when an item's schedule or deadline shifts.
 */
export async function recalculateDeliveriesForScheduleChange(
  supabase: SupabaseClient<Database>,
  target: {
    taskId?: string
    eventId?: string
    newScheduledStart?: string | null
    newDeadline?: string | null
  }
): Promise<void> {
  if (target.taskId) {
    const { data: rules } = await supabase
      .from('reminder_rules')
      .select('*')
      .eq('task_id', target.taskId)
      .eq('is_active', true)

    for (const rule of rules || []) {
      const baseTime = rule.is_relative_to_start
        ? target.newScheduledStart
        : target.newDeadline

      if (!baseTime) {
        // Obsolete because the reference time is now null
        await supabase
          .from('reminder_deliveries')
          .update({ status: 'cancelled' })
          .eq('reminder_rule_id', rule.id)
          .in('status', ['scheduled', 'pending'])
      } else {
        const newScheduledFor = calculateDeliveryTime(baseTime, rule.offset_minutes)
        await supabase
          .from('reminder_deliveries')
          .update({ scheduled_for: newScheduledFor })
          .eq('reminder_rule_id', rule.id)
          .in('status', ['scheduled', 'pending'])
      }
    }
  } else if (target.eventId && target.newScheduledStart) {
    const { data: rules } = await supabase
      .from('reminder_rules')
      .select('*')
      .eq('calendar_event_id', target.eventId)
      .eq('is_active', true)

    for (const rule of rules || []) {
      const newScheduledFor = calculateDeliveryTime(target.newScheduledStart, rule.offset_minutes)
      await supabase
        .from('reminder_deliveries')
        .update({ scheduled_for: newScheduledFor })
        .eq('reminder_rule_id', rule.id)
        .in('status', ['scheduled', 'pending'])
    }
  }
}

/**
 * Processes a single claimed delivery job with atomic outcome recording and retry backoff.
 */
export async function processClaimedDelivery(
  supabase: SupabaseClient<Database>,
  delivery: Database['public']['Tables']['reminder_deliveries']['Row']
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch associated rule to determine channel and parameters
    const { data: rule } = await supabase
      .from('reminder_rules')
      .select('channel')
      .eq('id', delivery.reminder_rule_id)
      .single()

    const channel = (rule?.channel || 'in_app') as ReminderChannel

    const result = await notificationDispatcher.dispatch({
      deliveryId: delivery.id,
      userId: delivery.user_id,
      title: delivery.title || 'DayFlow Reminder',
      body: delivery.body || 'You have an upcoming scheduled item.',
      channel,
      scheduledFor: delivery.scheduled_for,
    })

    if (result.success) {
      await supabase
        .from('reminder_deliveries')
        .update({
          status: 'sent',
          sent_at: result.sentAt || new Date().toISOString(),
          error_message: null,
          next_retry_at: null,
        })
        .eq('id', delivery.id)

      return { success: true }
    } else {
      const nextAttempt = delivery.attempt_count
      const isRetryable = result.isTransient && nextAttempt < delivery.max_attempts
      const nextRetryAt = isRetryable ? getNextRetryTimestamp(nextAttempt) : null

      await supabase
        .from('reminder_deliveries')
        .update({
          status: 'failed',
          error_message: result.errorMessage || 'Delivery failed',
          next_retry_at: nextRetryAt,
        })
        .eq('id', delivery.id)

      return { success: false, error: result.errorMessage }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected processing failure'
    await supabase
      .from('reminder_deliveries')
      .update({
        status: 'failed',
        error_message: msg,
        next_retry_at: getNextRetryTimestamp(delivery.attempt_count),
      })
      .eq('id', delivery.id)

    return { success: false, error: msg }
  }
}
