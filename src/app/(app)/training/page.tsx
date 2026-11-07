import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { getTrainingCoursesAction, getTrainingCourseDetailsAction, TrainingCourseWithDetails } from '@/lib/actions/training'
import { TrainingClient } from './training-client'

export default async function TrainingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let userTimezone = 'UTC'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.timezone) {
      userTimezone = profile.timezone
    }
  }

  // Fetch all courses
  const coursesRes = await getTrainingCoursesAction()
  const coursesList = coursesRes.data || []

  // Fetch full details for each course to have templates and sessions ready
  const coursesWithDetails: TrainingCourseWithDetails[] = []
  for (const course of coursesList) {
    const detailsRes = await getTrainingCourseDetailsAction(course.id)
    if (detailsRes.success && detailsRes.data) {
      coursesWithDetails.push(detailsRes.data)
    } else {
      coursesWithDetails.push({
        ...course,
        templates: [],
        sessions: [],
        tasks: [],
        progress: {
          totalSessions: 0,
          completedSessions: 0,
          totalTasks: 0,
          completedTasks: 0,
          estimatedHoursLogged: 0,
        },
      })
    }
  }

  return (
    <TrainingClient
      initialCourses={coursesWithDetails}
      userTimezone={userTimezone}
    />
  )
}
