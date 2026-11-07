import React from 'react'
import { getTasksAction } from '@/lib/actions/tasks'
import { getProjectsAction } from '@/lib/actions/projects'
import { TasksClient } from './tasks-client'

export default async function TasksPage() {
  const [tasksRes, projectsRes] = await Promise.all([
    getTasksAction(),
    getProjectsAction('all'),
  ])

  const tasks = tasksRes.success ? tasksRes.data || [] : []
  const projects = projectsRes.success ? projectsRes.data || [] : []

  return <TasksClient initialTasks={tasks} projects={projects} />
}
