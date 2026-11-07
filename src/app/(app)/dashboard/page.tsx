import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTasksAction } from '@/lib/actions/tasks'
import { getProjectsAction } from '@/lib/actions/projects'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [profileRes, tasksRes, projectsRes] = await Promise.all([
    supabase.from('profiles').select('display_name, timezone').eq('id', user.id).single(),
    getTasksAction(),
    getProjectsAction('all'),
  ])

  const profile = profileRes.data
  const tasks = tasksRes.success ? tasksRes.data || [] : []
  const projects = projectsRes.success ? projectsRes.data || [] : []

  return (
    <DashboardClient
      userDisplayName={profile?.display_name || user.user_metadata?.full_name}
      userTimezone={profile?.timezone || 'UTC'}
      tasks={tasks}
      projects={projects}
    />
  )
}
