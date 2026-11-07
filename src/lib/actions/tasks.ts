'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  createTaskSchema,
  updateTaskSchema,
  rescheduleTaskSchema,
  batchRescheduleSchema,
} from '@/lib/validations/tasks'
import { wouldCreateDependencyCycle } from '@/lib/dependencies'
import { shiftLocalCalendarDay, localPartsToUtc, getLocalParts } from '@/lib/timezone'
import {
  syncTaskReminders,
  cancelPendingDeliveriesForItem,
  recalculateDeliveriesForScheduleChange,
} from '@/lib/reminders/scheduler'
import { parseRecurrenceRule, calculateNextOccurrence } from '@/lib/recurrence'
import { ReminderItemInput } from '@/lib/reminders/types'
import { ActionResponse, Task, Updates } from '@/types'

export type TaskWithDetails = Task & {
  project?: {
    id: string
    title: string
    color_hex: string
  } | null
  subtasks?: Task[]
  blocking_tasks?: Array<{ id: string; title: string; status: string }>
  dependent_tasks?: Array<{ id: string; title: string; status: string }>
}

export async function getTasksAction(options?: {
  projectId?: string
  status?: string
  priority?: string
  search?: string
}): Promise<ActionResponse<TaskWithDetails[]>> {
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
      .from('tasks')
      .select('*, projects(id, title, color_hex)')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (options?.projectId && options.projectId !== 'all') {
      query = query.eq('project_id', options.projectId)
    }

    if (options?.status && options.status !== 'all') {
      // @ts-expect-error Supabase typed query
      query = query.eq('status', options.status)
    }

    if (options?.priority && options.priority !== 'all') {
      // @ts-expect-error Supabase typed query
      query = query.eq('priority', options.priority)
    }

    if (options?.search && options.search.trim()) {
      query = query.ilike('title', `%${options.search.trim()}%`)
    }

    const { data: rawTasks, error } = await query

    if (error) {
      return { success: false, error: error.message }
    }

    // Fetch all user task dependencies to map blockers
    const { data: depsData } = await supabase
      .from('task_dependencies')
      .select('blocking_task_id, dependent_task_id')
      .eq('user_id', user.id)

    const dependencies = depsData || []

    type TaskQueryRow = Task & { projects?: { id: string; title: string; color_hex: string } | null }

    const tasksMap = new Map<string, TaskWithDetails>()
    for (const raw of (rawTasks as unknown as TaskQueryRow[]) || []) {
      const { projects: proj, ...task } = raw
      tasksMap.set(task.id, {
        ...task,
        project: proj || null,
        subtasks: [],
        blocking_tasks: [],
        dependent_tasks: [],
      })
    }

    // Populate dependencies details
    for (const dep of dependencies) {
      const dependent = tasksMap.get(dep.dependent_task_id)
      const blocker = tasksMap.get(dep.blocking_task_id)
      if (dependent && blocker) {
        dependent.blocking_tasks = dependent.blocking_tasks || []
        dependent.blocking_tasks.push({
          id: blocker.id,
          title: blocker.title,
          status: blocker.status,
        })
        blocker.dependent_tasks = blocker.dependent_tasks || []
        blocker.dependent_tasks.push({
          id: dependent.id,
          title: dependent.title,
          status: dependent.status,
        })
      }
    }

    // Organize subtasks hierarchy
    const rootTasks: TaskWithDetails[] = []
    for (const task of tasksMap.values()) {
      if (task.parent_task_id && tasksMap.has(task.parent_task_id)) {
        const parent = tasksMap.get(task.parent_task_id)!
        parent.subtasks = parent.subtasks || []
        parent.subtasks.push(task)
      } else {
        rootTasks.push(task)
      }
    }

    return { success: true, data: rootTasks }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch tasks'
    return { success: false, error: msg }
  }
}

export async function createTaskAction(rawInput: unknown): Promise<ActionResponse<Task>> {
  try {
    const parsed = createTaskSchema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid task data' }
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { dependency_ids, reminders, ...taskFields } = parsed.data

    const insertPayload = {
      ...taskFields,
      user_id: user.id,
      deadline_at: taskFields.deadline_at || null,
      scheduled_start_at: taskFields.scheduled_start_at || null,
      scheduled_end_at: taskFields.scheduled_end_at || null,
      project_id: taskFields.project_id || null,
      parent_task_id: taskFields.parent_task_id || null,
    }

    const { data: createdTask, error: insertError } = await supabase
      .from('tasks')
      .insert(insertPayload)
      .select()
      .single()

    if (insertError || !createdTask) {
      return { success: false, error: insertError?.message || 'Failed to create task' }
    }

    // Sync reminders if provided or apply defaults
    let effectiveReminders: ReminderItemInput[] = (reminders as ReminderItemInput[]) || []
    if (!reminders) {
      const { data: settings } = await supabase
        .from('user_settings')
        .select('task_default_reminders, reminders_enabled_by_default')
        .eq('user_id', user.id)
        .maybeSingle()

      if (settings?.reminders_enabled_by_default && Array.isArray(settings.task_default_reminders)) {
        effectiveReminders = settings.task_default_reminders as unknown as ReminderItemInput[]
      }
    }

    if (effectiveReminders.length > 0) {
      await syncTaskReminders(
        supabase,
        user.id,
        createdTask.id,
        createdTask.title,
        effectiveReminders,
        {
          scheduled_start_at: createdTask.scheduled_start_at,
          deadline_at: createdTask.deadline_at,
          status: createdTask.status,
        }
      )
    }

    // Handle initial dependencies if provided
    if (dependency_ids && dependency_ids.length > 0) {
      // Validate no cycles
      const { data: existingDeps } = await supabase
        .from('task_dependencies')
        .select('blocking_task_id, dependent_task_id')
        .eq('user_id', user.id)

      const depsList = existingDeps || []

      for (const blockerId of dependency_ids) {
        if (!wouldCreateDependencyCycle(depsList, blockerId, createdTask.id)) {
          await supabase.from('task_dependencies').insert({
            user_id: user.id,
            blocking_task_id: blockerId,
            dependent_task_id: createdTask.id,
          })
          depsList.push({ blocking_task_id: blockerId, dependent_task_id: createdTask.id })
        }
      }
    }

    revalidatePath('/tasks')
    revalidatePath('/dashboard')
    if (taskFields.project_id) {
      revalidatePath(`/projects/${taskFields.project_id}`)
    }

    return { success: true, data: createdTask as Task }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create task'
    return { success: false, error: msg }
  }
}

export async function updateTaskAction(rawInput: unknown): Promise<ActionResponse<Task>> {
  try {
    const parsed = updateTaskSchema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid task update data' }
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { id, dependency_ids, reminders, ...updateFields } = parsed.data

    // Parent task cycle check (a task cannot be its own parent)
    if (updateFields.parent_task_id && updateFields.parent_task_id === id) {
      return { success: false, error: 'A task cannot be its own parent.' }
    }

    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update(updateFields)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError || !updatedTask) {
      return { success: false, error: updateError?.message || 'Failed to update task' }
    }

    // Schedule change recalculation & status cancellation
    if (updateFields.status === 'completed' || updateFields.status === 'cancelled') {
      await cancelPendingDeliveriesForItem(supabase, { taskId: id })
    } else if (
      updateFields.scheduled_start_at !== undefined ||
      updateFields.deadline_at !== undefined
    ) {
      await recalculateDeliveriesForScheduleChange(supabase, {
        taskId: id,
        newScheduledStart: updatedTask.scheduled_start_at,
        newDeadline: updatedTask.deadline_at,
      })
    }

    if (reminders !== undefined) {
      await syncTaskReminders(
        supabase,
        user.id,
        updatedTask.id,
        updatedTask.title,
        reminders as ReminderItemInput[],
        {
          scheduled_start_at: updatedTask.scheduled_start_at,
          deadline_at: updatedTask.deadline_at,
          status: updatedTask.status,
        }
      )
    }

    // If dependency_ids passed, update dependencies
    if (dependency_ids !== undefined) {
      // Remove existing blockers for this task
      await supabase
        .from('task_dependencies')
        .delete()
        .eq('dependent_task_id', id)
        .eq('user_id', user.id)

      if (dependency_ids.length > 0) {
        const { data: existingDeps } = await supabase
          .from('task_dependencies')
          .select('blocking_task_id, dependent_task_id')
          .eq('user_id', user.id)

        const depsList = existingDeps || []

        for (const blockerId of dependency_ids) {
          if (!wouldCreateDependencyCycle(depsList, blockerId, id)) {
            await supabase.from('task_dependencies').insert({
              user_id: user.id,
              blocking_task_id: blockerId,
              dependent_task_id: id,
            })
            depsList.push({ blocking_task_id: blockerId, dependent_task_id: id })
          }
        }
      }
    }

    revalidatePath('/tasks')
    revalidatePath('/dashboard')
    if (updatedTask.project_id) {
      revalidatePath(`/projects/${updatedTask.project_id}`)
    }

    return { success: true, data: updatedTask as Task }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update task'
    return { success: false, error: msg }
  }
}

export async function toggleTaskCompletionAction(taskId: string): Promise<ActionResponse<Task>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    // Fetch current task status
    const { data: currentTask, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !currentTask) {
      return { success: false, error: fetchError?.message || 'Task not found' }
    }

    const isCurrentlyCompleted = currentTask.status === 'completed'
    const newStatus = isCurrentlyCompleted ? 'todo' : 'completed'
    const newCompletedAt = isCurrentlyCompleted ? null : new Date().toISOString()

    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update({
        status: newStatus,
        completed_at: newCompletedAt,
      })
      .eq('id', taskId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError || !updatedTask) {
      return { success: false, error: updateError?.message || 'Failed to toggle task' }
    }

    if (newStatus === 'completed') {
      // Cancel pending deliveries for completed task
      await cancelPendingDeliveriesForItem(supabase, { taskId })

      // If recurring, generate the next occurrence
      if (currentTask.recurrence_rule) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('timezone')
          .eq('id', user.id)
          .single()

        const userTimezone = profile?.timezone || 'UTC'
        const recurrenceConfig = parseRecurrenceRule(currentTask.recurrence_rule)

        if (recurrenceConfig) {
          const baseDate = currentTask.scheduled_start_at
            ? new Date(currentTask.scheduled_start_at)
            : currentTask.deadline_at
            ? new Date(currentTask.deadline_at)
            : new Date()

          const nextDate = calculateNextOccurrence(baseDate, recurrenceConfig, userTimezone)

          if (nextDate) {
            let nextStart: string | null = null
            let nextEnd: string | null = null
            let nextDeadline: string | null = null

            if (currentTask.scheduled_start_at && currentTask.scheduled_end_at) {
              const durationMs =
                new Date(currentTask.scheduled_end_at).getTime() -
                new Date(currentTask.scheduled_start_at).getTime()
              nextStart = nextDate.toISOString()
              nextEnd = new Date(nextDate.getTime() + durationMs).toISOString()
            }

            if (currentTask.deadline_at) {
              nextDeadline = nextDate.toISOString()
            }

            // Create next occurrence
            const { data: nextTask } = await supabase
              .from('tasks')
              .insert({
                user_id: user.id,
                project_id: currentTask.project_id,
                parent_task_id: currentTask.parent_task_id,
                title: currentTask.title,
                description: currentTask.description,
                status: 'todo',
                priority: currentTask.priority,
                deadline_at: nextDeadline,
                scheduled_start_at: nextStart,
                scheduled_end_at: nextEnd,
                is_time_blocked: currentTask.is_time_blocked,
                recurrence_rule: currentTask.recurrence_rule,
                recurrence_parent_id: currentTask.recurrence_parent_id || currentTask.id,
                estimated_duration_minutes: currentTask.estimated_duration_minutes,
              })
              .select()
              .single()

            // Copy active reminder rules to next occurrence
            if (nextTask) {
              const { data: existingRules } = await supabase
                .from('reminder_rules')
                .select('*')
                .eq('task_id', currentTask.id)
                .eq('is_active', true)

              if (existingRules && existingRules.length > 0) {
                const rulesToCopy: ReminderItemInput[] = existingRules.map((r) => ({
                  offset_minutes: r.offset_minutes,
                  is_relative_to_start: r.is_relative_to_start,
                  channel: r.channel as ReminderItemInput['channel'],
                  is_active: r.is_active,
                }))

                await syncTaskReminders(
                  supabase,
                  user.id,
                  nextTask.id,
                  nextTask.title,
                  rulesToCopy,
                  {
                    scheduled_start_at: nextTask.scheduled_start_at,
                    deadline_at: nextTask.deadline_at,
                    status: 'todo',
                  }
                )
              }
            }
          }
        }
      }
    }

    revalidatePath('/tasks')
    revalidatePath('/dashboard')
    if (updatedTask.project_id) {
      revalidatePath(`/projects/${updatedTask.project_id}`)
    }

    return { success: true, data: updatedTask as Task }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to toggle task'
    return { success: false, error: msg }
  }
}

export async function deleteTaskAction(taskId: string): Promise<ActionResponse<void>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { data: taskData } = await supabase
      .from('tasks')
      .select('project_id')
      .eq('id', taskId)
      .eq('user_id', user.id)
      .single()

    await cancelPendingDeliveriesForItem(supabase, { taskId })

    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', user.id)

    if (deleteError) {
      return { success: false, error: deleteError.message }
    }

    revalidatePath('/tasks')
    revalidatePath('/dashboard')
    if (taskData?.project_id) {
      revalidatePath(`/projects/${taskData.project_id}`)
    }

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete task'
    return { success: false, error: msg }
  }
}

/**
 * Reschedule a single task to a new deadline or new scheduled start/end.
 * Preserves the original dates by writing an audit record into task_reschedule_history.
 * Does NOT duplicate the task record.
 */
export async function rescheduleTaskAction(rawInput: unknown): Promise<ActionResponse<Task>> {
  try {
    const parsed = rescheduleTaskSchema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid reschedule input' }
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { taskId, newDeadline, newScheduledStart, newScheduledEnd, reason } = parsed.data

    // Fetch existing task
    const { data: existingTask, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingTask) {
      return { success: false, error: fetchError?.message || 'Task not found' }
    }

    // Build update object
    const updatePayload: Updates<'tasks'> = {}
    if (newDeadline !== undefined) {
      updatePayload.deadline_at = newDeadline
    }
    if (newScheduledStart !== undefined) {
      updatePayload.scheduled_start_at = newScheduledStart
    }
    if (newScheduledEnd !== undefined) {
      updatePayload.scheduled_end_at = newScheduledEnd
    }

    // Update existing task record
    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update(updatePayload)
      .eq('id', taskId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError || !updatedTask) {
      return { success: false, error: updateError?.message || 'Failed to reschedule task' }
    }

    // Audit log insertion into task_reschedule_history
    await supabase.from('task_reschedule_history').insert({
      user_id: user.id,
      task_id: taskId,
      previous_scheduled_start: existingTask.scheduled_start_at,
      new_scheduled_start: updatedTask.scheduled_start_at,
      previous_deadline: existingTask.deadline_at,
      new_deadline: updatedTask.deadline_at,
      reason: reason || 'Task rescheduled',
    })

    revalidatePath('/tasks')
    revalidatePath('/dashboard')

    return { success: true, data: updatedTask as Task }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to reschedule task'
    return { success: false, error: msg }
  }
}

/**
 * Move a task's deadline and/or scheduled times forward by 1 day (Tomorrow).
 */
export async function moveTaskToTomorrowAction(taskId: string): Promise<ActionResponse<Task>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', user.id)
      .single()

    const timezone = profile?.timezone || 'UTC'

    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !task) {
      return { success: false, error: 'Task not found' }
    }

    let newDeadline = task.deadline_at
    if (task.deadline_at) {
      newDeadline = shiftLocalCalendarDay(task.deadline_at, timezone, 1)
    } else {
      // If no deadline, set deadline to tomorrow at 23:59:59 in the user local timezone
      const localNow = getLocalParts(timezone, new Date())
      const shifted = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day + 1))
      const targetUtc = localPartsToUtc(
        {
          year: shifted.getUTCFullYear(),
          month: shifted.getUTCMonth() + 1,
          day: shifted.getUTCDate(),
          hour: 23,
          minute: 59,
          second: 59,
        },
        timezone
      )
      newDeadline = targetUtc.toISOString()
    }

    let newStart = task.scheduled_start_at
    let newEnd = task.scheduled_end_at
    if (task.scheduled_start_at && task.scheduled_end_at) {
      newStart = shiftLocalCalendarDay(task.scheduled_start_at, timezone, 1)
      newEnd = shiftLocalCalendarDay(task.scheduled_end_at, timezone, 1)
    }

    return await rescheduleTaskAction({
      taskId,
      newDeadline,
      newScheduledStart: newStart,
      newScheduledEnd: newEnd,
      reason: 'Moved to tomorrow (calendar day shift)',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to move task to tomorrow'
    return { success: false, error: msg }
  }
}

/**
 * Batch reschedule multiple overdue or pending tasks.
 * Performs safe server-side updates with individual audit log entries,
 * reporting successful and failed task IDs accurately.
 */
export async function batchRescheduleTasksAction(
  rawInput: unknown
): Promise<ActionResponse<{ successful: string[]; failed: string[] }>> {
  try {
    const parsed = batchRescheduleSchema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid batch parameters' }
    }

    const { taskIds, daysForward, reason } = parsed.data

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', user.id)
      .single()

    const timezone = profile?.timezone || 'UTC'

    const successful: string[] = []
    const failed: string[] = []

    for (const id of taskIds) {
      try {
        const { data: task } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .single()

        if (!task) {
          failed.push(id)
          continue
        }

        const newDeadline = task.deadline_at
          ? shiftLocalCalendarDay(task.deadline_at, timezone, daysForward)
          : null
        const newStart = task.scheduled_start_at
          ? shiftLocalCalendarDay(task.scheduled_start_at, timezone, daysForward)
          : null
        const newEnd = task.scheduled_end_at
          ? shiftLocalCalendarDay(task.scheduled_end_at, timezone, daysForward)
          : null

        const res = await rescheduleTaskAction({
          taskId: id,
          newDeadline,
          newScheduledStart: newStart,
          newScheduledEnd: newEnd,
          reason,
        })

        if (res.success) {
          successful.push(id)
        } else {
          failed.push(id)
        }
      } catch {
        failed.push(id)
      }
    }

    revalidatePath('/tasks')
    revalidatePath('/dashboard')
    revalidatePath('/calendar')

    return {
      success: true,
      data: { successful, failed },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Batch reschedule failed'
    return { success: false, error: msg }
  }
}
