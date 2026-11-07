import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { getStudentReviewsAction } from '@/lib/actions/student-reviews'
import { getTrainingCoursesAction } from '@/lib/actions/training'
import { StudentReviewsClient } from './student-reviews-client'

export default async function StudentReviewsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch initial student reviews
  const reviewsRes = await getStudentReviewsAction()
  const reviews = reviewsRes.data || []

  // Fetch courses for selection in the form
  const coursesRes = await getTrainingCoursesAction()
  const courses = coursesRes.data || []

  // Check if user has an active risk reminder rule
  let reminderConfig = {
    enabled: false,
    schedule: 'Weekly at 09:00',
  }

  if (user) {
    const { data: rule } = await supabase
      .from('reminder_rules')
      .select('is_active')
      .eq('user_id', user.id)
      .is('task_id', null)
      .is('calendar_event_id', null)
      .maybeSingle()

    if (rule?.is_active) {
      reminderConfig = {
        enabled: true,
        schedule: 'Weekly at 09:00',
      }
    }
  }

  return (
    <StudentReviewsClient
      initialReviews={reviews}
      courses={courses}
      initialReminderConfig={reminderConfig}
    />
  )
}
