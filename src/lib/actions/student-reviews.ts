'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  createStudentReviewSchema,
  updateStudentReviewSchema,
  createReviewFollowUpTaskSchema,
  configureExternalRiskReminderSchema,
} from '@/lib/validations/student-reviews'
import { ActionResponse, StudentReview, Task, TrainingCourse } from '@/types'

export type StudentReviewWithDetails = StudentReview & {
  course?: Pick<TrainingCourse, 'id' | 'title'> | null
  follow_up_task?: Pick<Task, 'id' | 'title' | 'status' | 'deadline_at'> | null
}

export async function getStudentReviewsAction(options?: {
  status?: StudentReview['status'] | 'all'
  courseId?: string
  search?: string
}): Promise<ActionResponse<StudentReviewWithDetails[]>> {
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
      .from('student_reviews')
      .select('*, training_courses(id, title), tasks:follow_up_task_id(id, title, status, deadline_at)')
      .eq('user_id', user.id)
      .order('submission_date', { ascending: false })

    if (options?.status && options.status !== 'all') {
      query = query.eq('status', options.status)
    }

    if (options?.courseId && options.courseId !== 'all') {
      query = query.eq('course_id', options.courseId)
    }

    const { data: rawReviews, error } = await query

    if (error) {
      return { success: false, error: error.message }
    }

    type RawReviewQueryRow = StudentReview & {
      training_courses?: { id: string; title: string } | null
      tasks?: { id: string; title: string; status: string; deadline_at: string | null } | null
    }

    let reviews: StudentReviewWithDetails[] = ((rawReviews as unknown as RawReviewQueryRow[]) || []).map(
      (r) => {
        const { training_courses: course, tasks: task, ...review } = r
        return {
          ...review,
          course: course || null,
          follow_up_task: (task as Pick<Task, 'id' | 'title' | 'status' | 'deadline_at'>) || null,
        }
      }
    )

    if (options?.search && options.search.trim()) {
      const q = options.search.trim().toLowerCase()
      reviews = reviews.filter(
        (r) =>
          r.student_identifier.toLowerCase().includes(q) ||
          r.assignment_title.toLowerCase().includes(q) ||
          (r.feedback_notes && r.feedback_notes.toLowerCase().includes(q))
      )
    }

    return { success: true, data: reviews }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch student reviews'
    return { success: false, error: msg }
  }
}

export async function createStudentReviewAction(
  rawInput: unknown
): Promise<ActionResponse<StudentReview>> {
  try {
    const parsed = createStudentReviewSchema.safeParse(rawInput)
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

    const { data, error } = await supabase
      .from('student_reviews')
      .insert({
        ...parsed.data,
        user_id: user.id,
      })
      .select()
      .single()

    if (error || !data) {
      return { success: false, error: error?.message || 'Failed to create student review' }
    }

    revalidatePath('/student-reviews')
    return { success: true, data: data as StudentReview }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create student review'
    return { success: false, error: msg }
  }
}

export async function updateStudentReviewAction(
  rawInput: unknown
): Promise<ActionResponse<StudentReview>> {
  try {
    const parsed = updateStudentReviewSchema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid review update' }
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

    // Auto-set reviewed_at when moving to feedback_ready or completed if not already set
    const finalUpdates = { ...updateFields }
    if (
      (updateFields.status === 'feedback_ready' || updateFields.status === 'completed') &&
      !updateFields.reviewed_at
    ) {
      finalUpdates.reviewed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('student_reviews')
      .update(finalUpdates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !data) {
      return { success: false, error: error?.message || 'Failed to update student review' }
    }

    revalidatePath('/student-reviews')
    return { success: true, data: data as StudentReview }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update student review'
    return { success: false, error: msg }
  }
}

export async function deleteStudentReviewAction(
  reviewId: string
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
      .from('student_reviews')
      .delete()
      .eq('id', reviewId)
      .eq('user_id', user.id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/student-reviews')
    return { success: true, data: { deleted: true } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete student review'
    return { success: false, error: msg }
  }
}

export async function createReviewFollowUpTaskAction(
  rawInput: unknown
): Promise<ActionResponse<{ task: Task; review: StudentReview }>> {
  try {
    const parsed = createReviewFollowUpTaskSchema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid follow-up task input' }
    }

    const { review_id, title, deadline_at, priority, description } = parsed.data
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // 1. Fetch Review to verify ownership and grab course_id / student_identifier
    const { data: review, error: reviewError } = await supabase
      .from('student_reviews')
      .select('*')
      .eq('id', review_id)
      .eq('user_id', user.id)
      .single()

    if (reviewError || !review) {
      return { success: false, error: 'Student review not found' }
    }

    // 2. Insert canonical Task
    const taskDescription = [
      description || '',
      `Follow-up for student review: ${review.student_identifier} (${review.assignment_title})`,
    ]
      .filter(Boolean)
      .join('\n\n')

    const { data: createdTask, error: taskError } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        course_id: review.course_id,
        title,
        description: taskDescription,
        status: 'todo',
        priority,
        deadline_at: deadline_at || null,
        scheduled_start_at: deadline_at || null,
        sort_order: 0,
      })
      .select()
      .single()

    if (taskError || !createdTask) {
      return { success: false, error: taskError?.message || 'Failed to create follow-up task' }
    }

    // 3. Update Review linking follow_up_task_id and setting status to 'needs_follow_up'
    const nextStatus =
      review.status === 'completed' ? review.status : 'needs_follow_up'

    const { data: updatedReview, error: updateError } = await supabase
      .from('student_reviews')
      .update({
        follow_up_task_id: createdTask.id,
        follow_up_due_at: deadline_at || null,
        status: nextStatus,
      })
      .eq('id', review_id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError || !updatedReview) {
      return { success: false, error: updateError?.message || 'Failed to link follow-up task to review' }
    }

    revalidatePath('/student-reviews')
    revalidatePath('/tasks')
    revalidatePath('/my-day')

    return {
      success: true,
      data: {
        task: createdTask as Task,
        review: updatedReview as StudentReview,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create review follow-up task'
    return { success: false, error: msg }
  }
}

export async function configureExternalRiskTrackerReminderAction(
  rawInput: unknown
): Promise<ActionResponse<{ enabled: boolean; schedule: string }>> {
  try {
    const parsed = configureExternalRiskReminderSchema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid reminder configuration' }
    }

    const { frequency, time_of_day, enabled } = parsed.data
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Map frequency to user-friendly label and check rule
    const scheduleLabel = `${frequency.toUpperCase()} at ${time_of_day}`

    // If disabling, update any existing reminder_rules with offset 0 and channel 'in_app' for this prompt
    if (!enabled) {
      await supabase
        .from('reminder_rules')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .is('task_id', null)
        .is('calendar_event_id', null)

      return {
        success: true,
        data: { enabled: false, schedule: scheduleLabel },
      }
    }

    // Look for existing rule or create
    const { data: existingRule } = await supabase
      .from('reminder_rules')
      .select('id')
      .eq('user_id', user.id)
      .is('task_id', null)
      .is('calendar_event_id', null)
      .maybeSingle()

    if (existingRule) {
      await supabase
        .from('reminder_rules')
        .update({
          is_active: true,
          channel: 'in_app',
        })
        .eq('id', existingRule.id)
    } else {
      await supabase.from('reminder_rules').insert({
        user_id: user.id,
        task_id: null,
        calendar_event_id: null,
        offset_minutes: 0,
        is_relative_to_start: true,
        channel: 'in_app',
        is_active: true,
      })
    }

    revalidatePath('/student-reviews')
    return {
      success: true,
      data: { enabled: true, schedule: scheduleLabel },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to configure risk tracker reminder'
    return { success: false, error: msg }
  }
}
