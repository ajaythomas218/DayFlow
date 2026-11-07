import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCalendarFeedAction } from '@/lib/actions/calendar'
import { getProjectsAction } from '@/lib/actions/projects'
import { getTasksAction } from '@/lib/actions/tasks'
import { getWeekRange } from '@/lib/timezone'
import { CalendarClient } from './calendar-client'

export default async function CalendarPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile for timezone
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single()

  const userTimezone = profile?.timezone || 'UTC'

  // Initial week range feed
  const now = new Date()
  const weekRange = getWeekRange(now, userTimezone, 0)

  const [feedRes, projectsRes, tasksRes] = await Promise.all([
    getCalendarFeedAction(weekRange.startIso, weekRange.endIso),
    getProjectsAction('active'),
    getTasksAction(),
  ])

  const initialFeed = feedRes.success && feedRes.data ? feedRes.data : {
    events: [],
    scheduledTasks: [],
    deadlineTasks: [],
  }

  const projects = projectsRes.success && projectsRes.data ? projectsRes.data : []
  const tasks = tasksRes.success && tasksRes.data ? tasksRes.data : []

  return (
    <CalendarClient
      initialFeed={initialFeed}
      userTimezone={userTimezone}
      projects={projects}
      tasks={tasks}
    />
  )
}
