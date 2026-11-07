import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/shell/app-shell'
import { Project, Task } from '@/types'

export const instant = false

export default async function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile for display name and timezone
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email, timezone')
    .eq('id', user.id)
    .single()

  // Fetch active projects for quick selector
  const { data: projectsData } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .neq('status', 'archived')
    .order('title', { ascending: true })

  // Fetch incomplete tasks for dependency selector
  const { data: tasksData } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .neq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(50)

  const projects = (projectsData || []) as Project[]
  const tasks = (tasksData || []) as Task[]

  return (
    <AppShell
      userDisplayName={profile?.display_name || user.user_metadata?.full_name}
      userEmail={user.email}
      projects={projects}
      tasks={tasks}
    >
      {children}
    </AppShell>
  )
}
