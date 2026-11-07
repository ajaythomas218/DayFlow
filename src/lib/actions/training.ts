'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  createCourseSchema,
  updateCourseSchema,
  saveChecklistTemplateSchema,
  createTrainingSessionSchema,
  updateTrainingSessionSchema,
  generateSessionTasksSchema,
} from '@/lib/validations/training'
import {
  ActionResponse,
  TrainingCourse,
  TrainingTemplate,
  TrainingTemplateTask,
  TrainingSession,
  Task,
} from '@/types'

export type TrainingTemplateWithItems = TrainingTemplate & {
  items: TrainingTemplateTask[]
}

export type TrainingCourseWithDetails = TrainingCourse & {
  templates: TrainingTemplateWithItems[]
  sessions: TrainingSession[]
  tasks: Task[]
  progress: {
    totalSessions: number
    completedSessions: number
    totalTasks: number
    completedTasks: number
    estimatedHoursLogged: number
  }
}

export async function getTrainingCoursesAction(): Promise<ActionResponse<TrainingCourse[]>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { data: courses, error } = await supabase
      .from('training_courses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: (courses as TrainingCourse[]) || [] }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch training courses'
    return { success: false, error: msg }
  }
}

export async function getTrainingCourseDetailsAction(
  courseId: string
): Promise<ActionResponse<TrainingCourseWithDetails>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    // 1. Fetch course
    const { data: course, error: courseError } = await supabase
      .from('training_courses')
      .select('*')
      .eq('id', courseId)
      .eq('user_id', user.id)
      .single()

    if (courseError || !course) {
      return { success: false, error: courseError?.message || 'Course not found' }
    }

    // 2. Fetch templates
    const { data: rawTemplates } = await supabase
      .from('training_templates')
      .select('*')
      .eq('course_id', courseId)
      .order('created_at', { ascending: true })

    const templateIds = (rawTemplates || []).map((t) => t.id)

    // 3. Fetch template items
    let templateItems: TrainingTemplateTask[] = []
    if (templateIds.length > 0) {
      const { data: rawItems } = await supabase
        .from('training_template_tasks')
        .select('*')
        .in('template_id', templateIds)
        .order('sort_order', { ascending: true })
      templateItems = (rawItems as TrainingTemplateTask[]) || []
    }

    const templatesWithItems: TrainingTemplateWithItems[] = (rawTemplates || []).map((t) => ({
      ...(t as TrainingTemplate),
      items: templateItems.filter((item) => item.template_id === t.id && !item.is_archived),
    }))

    // 4. Fetch sessions
    const { data: sessions } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('course_id', courseId)
      .order('scheduled_start', { ascending: true })

    // 5. Fetch linked tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('course_id', courseId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    const taskList = (tasks as Task[]) || []
    const sessionList = (sessions as TrainingSession[]) || []

    const completedSessions = sessionList.filter((s) => s.status === 'completed').length
    const completedTasks = taskList.filter((t) => t.status === 'completed').length

    // Calculate logged duration in hours
    const sessionMinutes = sessionList.reduce(
      (sum, s) => sum + (s.actual_duration_minutes || 0),
      0
    )
    const taskMinutes = taskList
      .filter((t) => t.status === 'completed')
      .reduce((sum, t) => sum + (t.estimated_duration_minutes || 0), 0)
    const estimatedHoursLogged = Number(((sessionMinutes + taskMinutes) / 60).toFixed(1))

    return {
      success: true,
      data: {
        ...(course as TrainingCourse),
        templates: templatesWithItems,
        sessions: sessionList,
        tasks: taskList,
        progress: {
          totalSessions: sessionList.length,
          completedSessions,
          totalTasks: taskList.length,
          completedTasks,
          estimatedHoursLogged,
        },
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch course details'
    return { success: false, error: msg }
  }
}

export async function createTrainingCourseAction(
  rawInput: unknown
): Promise<ActionResponse<TrainingCourse>> {
  try {
    const parsed = createCourseSchema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid course input' }
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { data, error } = await supabase
      .from('training_courses')
      .insert({
        ...parsed.data,
        user_id: user.id,
      })
      .select()
      .single()

    if (error || !data) {
      return { success: false, error: error?.message || 'Failed to create training course' }
    }

    revalidatePath('/training')
    return { success: true, data: data as TrainingCourse }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create course'
    return { success: false, error: msg }
  }
}

export async function updateTrainingCourseAction(
  rawInput: unknown
): Promise<ActionResponse<TrainingCourse>> {
  try {
    const parsed = updateCourseSchema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid course update' }
    }

    const { id, ...updateFields } = parsed.data
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { data, error } = await supabase
      .from('training_courses')
      .update(updateFields)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !data) {
      return { success: false, error: error?.message || 'Failed to update course' }
    }

    revalidatePath('/training')
    return { success: true, data: data as TrainingCourse }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update course'
    return { success: false, error: msg }
  }
}

export async function deleteTrainingCourseAction(
  courseId: string
): Promise<ActionResponse<{ deleted: boolean }>> {
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
      .from('training_courses')
      .delete()
      .eq('id', courseId)
      .eq('user_id', user.id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/training')
    return { success: true, data: { deleted: true } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete course'
    return { success: false, error: msg }
  }
}

export async function saveChecklistTemplateAction(
  rawInput: unknown
): Promise<ActionResponse<TrainingTemplateWithItems>> {
  try {
    const parsed = saveChecklistTemplateSchema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid template data' }
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    // Verify course ownership
    const { data: course, error: courseCheckError } = await supabase
      .from('training_courses')
      .select('id')
      .eq('id', parsed.data.course_id)
      .eq('user_id', user.id)
      .single()

    if (courseCheckError || !course) {
      return { success: false, error: 'Unauthorized course access' }
    }

    let templateId = parsed.data.id

    if (templateId) {
      // Update existing template header
      const { error: updateError } = await supabase
        .from('training_templates')
        .update({
          template_name: parsed.data.template_name,
          description: parsed.data.description,
          is_archived: parsed.data.is_archived,
        })
        .eq('id', templateId)
        .eq('course_id', parsed.data.course_id)

      if (updateError) {
        return { success: false, error: updateError.message }
      }
    } else {
      // Insert new template header
      const { data: newTemplate, error: insertError } = await supabase
        .from('training_templates')
        .insert({
          course_id: parsed.data.course_id,
          template_name: parsed.data.template_name,
          description: parsed.data.description,
          is_archived: parsed.data.is_archived,
        })
        .select()
        .single()

      if (insertError || !newTemplate) {
        return { success: false, error: insertError?.message || 'Failed to create template' }
      }
      templateId = newTemplate.id
    }

    // Handle template items without mutating existing task instances
    const incomingItems = parsed.data.items || []

    // Fetch existing items for this template
    const { data: existingItems } = await supabase
      .from('training_template_tasks')
      .select('id')
      .eq('template_id', templateId)

    const existingIds = new Set((existingItems || []).map((i) => i.id))
    const incomingIds = new Set(incomingItems.filter((i) => i.id).map((i) => i.id!))

    // Soft archive items not in incoming payload
    const toArchiveIds = Array.from(existingIds).filter((id) => !incomingIds.has(id))
    if (toArchiveIds.length > 0) {
      await supabase
        .from('training_template_tasks')
        .update({ is_archived: true })
        .in('id', toArchiveIds)
    }

    // Upsert items
    for (const item of incomingItems) {
      if (item.id && existingIds.has(item.id)) {
        await supabase
          .from('training_template_tasks')
          .update({
            task_title: item.task_title,
            estimated_duration_minutes: item.estimated_duration_minutes,
            sort_order: item.sort_order,
            is_mandatory: item.is_mandatory,
            due_offset_days: item.due_offset_days,
            relative_to: item.relative_to,
            is_archived: item.is_archived,
          })
          .eq('id', item.id)
      } else {
        await supabase.from('training_template_tasks').insert({
          template_id: templateId,
          task_title: item.task_title,
          estimated_duration_minutes: item.estimated_duration_minutes,
          sort_order: item.sort_order,
          is_mandatory: item.is_mandatory,
          due_offset_days: item.due_offset_days,
          relative_to: item.relative_to,
          is_archived: item.is_archived || false,
        })
      }
    }

    // Re-fetch template and items
    const { data: updatedTemplate } = await supabase
      .from('training_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    const { data: updatedItems } = await supabase
      .from('training_template_tasks')
      .select('*')
      .eq('template_id', templateId)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })

    revalidatePath('/training')
    return {
      success: true,
      data: {
        ...(updatedTemplate as TrainingTemplate),
        items: (updatedItems as TrainingTemplateTask[]) || [],
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save checklist template'
    return { success: false, error: msg }
  }
}

export async function deleteChecklistTemplateAction(
  templateId: string
): Promise<ActionResponse<{ deleted: boolean }>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { error } = await supabase
      .from('training_templates')
      .delete()
      .eq('id', templateId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/training')
    return { success: true, data: { deleted: true } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete template'
    return { success: false, error: msg }
  }
}

export async function createTrainingSessionAction(
  rawInput: unknown
): Promise<ActionResponse<TrainingSession>> {
  try {
    const parsed = createTrainingSessionSchema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid session data' }
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    const {
      course_id,
      template_id,
      session_title,
      scheduled_start,
      scheduled_end,
      timezone,
      actual_duration_minutes,
      status,
      notes,
      location,
      meeting_url,
      sync_to_calendar,
      generate_tasks,
    } = parsed.data

    let calendarEventId: string | null = null

    // 1. Optionally create Calendar Event
    if (sync_to_calendar) {
      const computedEnd =
        scheduled_end ||
        new Date(new Date(scheduled_start).getTime() + 60 * 60 * 1000).toISOString()

      const { data: calEvent } = await supabase
        .from('calendar_events')
        .insert({
          user_id: user.id,
          title: `[Training] ${session_title}`,
          description: notes || `Training session for course.`,
          event_type: 'appointment',
          start_time: scheduled_start,
          end_time: computedEnd,
          location: location || null,
          meeting_url: meeting_url || null,
          is_all_day: false,
          attendees: [],
        })
        .select('id')
        .single()

      if (calEvent) {
        calendarEventId = calEvent.id
      }
    }

    // 2. Insert Training Session
    const { data: session, error: sessionError } = await supabase
      .from('training_sessions')
      .insert({
        course_id,
        template_id: template_id || null,
        session_title,
        scheduled_start,
        scheduled_end: scheduled_end || null,
        timezone,
        actual_duration_minutes: actual_duration_minutes || null,
        status,
        notes: notes || null,
        location: location || null,
        meeting_url: meeting_url || null,
        calendar_event_id: calendarEventId,
      })
      .select()
      .single()

    if (sessionError || !session) {
      return { success: false, error: sessionError?.message || 'Failed to create session' }
    }

    // 3. Optionally generate canonical task instances if requested and template is present
    if (generate_tasks && template_id) {
      await generateTasksFromSessionTemplateAction({
        session_id: session.id,
        course_id,
        template_id,
      })
    }

    revalidatePath('/training')
    revalidatePath('/calendar')
    return { success: true, data: session as TrainingSession }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create training session'
    return { success: false, error: msg }
  }
}

export async function updateTrainingSessionAction(
  rawInput: unknown
): Promise<ActionResponse<TrainingSession>> {
  try {
    const parsed = updateTrainingSessionSchema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid session update' }
    }

    const { id, ...updateFields } = parsed.data
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data, error } = await supabase
      .from('training_sessions')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single()

    if (error || !data) {
      return { success: false, error: error?.message || 'Failed to update session' }
    }

    // If calendar event is linked, keep times and title in sync
    if (data.calendar_event_id && (updateFields.scheduled_start || updateFields.session_title)) {
      const updates: { title?: string; start_time?: string; end_time?: string } = {}
      if (updateFields.session_title) {
        updates.title = `[Training] ${updateFields.session_title}`
      }
      if (updateFields.scheduled_start) {
        updates.start_time = updateFields.scheduled_start
      }
      if (updateFields.scheduled_end) {
        updates.end_time = updateFields.scheduled_end
      }
      await supabase.from('calendar_events').update(updates).eq('id', data.calendar_event_id)
    }

    revalidatePath('/training')
    revalidatePath('/calendar')
    return { success: true, data: data as TrainingSession }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update session'
    return { success: false, error: msg }
  }
}

export async function deleteTrainingSessionAction(
  sessionId: string
): Promise<ActionResponse<{ deleted: boolean }>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if session has calendar event
    const { data: session } = await supabase
      .from('training_sessions')
      .select('calendar_event_id')
      .eq('id', sessionId)
      .single()

    const { error } = await supabase.from('training_sessions').delete().eq('id', sessionId)

    if (error) {
      return { success: false, error: error.message }
    }

    if (session?.calendar_event_id) {
      await supabase.from('calendar_events').delete().eq('id', session.calendar_event_id)
    }

    revalidatePath('/training')
    revalidatePath('/calendar')
    return { success: true, data: { deleted: true } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete session'
    return { success: false, error: msg }
  }
}

export async function generateTasksFromSessionTemplateAction(
  rawInput: unknown
): Promise<ActionResponse<{ createdCount: number; tasks: Task[] }>> {
  try {
    const parsed = generateSessionTasksSchema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid task generation input' }
    }

    const { session_id, course_id, template_id } = parsed.data
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // 1. Fetch Session
    const { data: session, error: sessionError } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('course_id', course_id)
      .single()

    if (sessionError || !session) {
      return { success: false, error: 'Session not found' }
    }

    // 2. Fetch Template Items (non-archived)
    const { data: templateItems, error: itemsError } = await supabase
      .from('training_template_tasks')
      .select('*')
      .eq('template_id', template_id)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })

    if (itemsError || !templateItems || templateItems.length === 0) {
      return { success: false, error: 'No checklist items found in this template' }
    }

    // 3. Check for existing canonical tasks for this session (IDEMPOTENCY)
    const { data: existingTasks } = await supabase
      .from('tasks')
      .select('checklist_template_task_id')
      .eq('training_session_id', session_id)
      .eq('user_id', user.id)

    const existingTemplateTaskIds = new Set(
      (existingTasks || [])
        .map((t) => t.checklist_template_task_id)
        .filter((id): id is string => Boolean(id))
    )

    const sessionStartTime = new Date(session.scheduled_start).getTime()
    const toInsert = []

    for (const item of templateItems) {
      // Skip if already generated for this session to guarantee idempotency
      if (existingTemplateTaskIds.has(item.id)) {
        continue
      }

      // Calculate scheduled date based on offset days
      const offsetMs = (item.due_offset_days || 0) * 24 * 60 * 60 * 1000
      const calculatedStart = new Date(sessionStartTime + offsetMs).toISOString()
      const durationMs = (item.estimated_duration_minutes || 15) * 60 * 1000
      const calculatedEnd = new Date(sessionStartTime + offsetMs + durationMs).toISOString()

      toInsert.push({
        user_id: user.id,
        course_id: course_id,
        training_session_id: session_id,
        checklist_template_task_id: item.id,
        title: item.task_title,
        description: `Checklist task generated from session: "${session.session_title}"`,
        status: 'todo' as const,
        priority: item.is_mandatory ? ('p2' as const) : ('p3' as const),
        scheduled_start_at: calculatedStart,
        scheduled_end_at: calculatedEnd,
        deadline_at: calculatedEnd,
        is_time_blocked: false,
        estimated_duration_minutes: item.estimated_duration_minutes,
        sort_order: item.sort_order,
      })
    }

    if (toInsert.length === 0) {
      // All tasks were already generated! Return existing without duplicating
      const { data: existing } = await supabase
        .from('tasks')
        .select('*')
        .eq('training_session_id', session_id)
        .eq('user_id', user.id)

      return {
        success: true,
        data: {
          createdCount: 0,
          tasks: (existing as Task[]) || [],
        },
      }
    }

    const { data: createdTasks, error: insertError } = await supabase
      .from('tasks')
      .insert(toInsert)
      .select()

    if (insertError) {
      return { success: false, error: insertError.message }
    }

    revalidatePath('/training')
    revalidatePath('/tasks')
    revalidatePath('/my-day')

    return {
      success: true,
      data: {
        createdCount: createdTasks?.length || 0,
        tasks: (createdTasks as Task[]) || [],
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate session tasks'
    return { success: false, error: msg }
  }
}

