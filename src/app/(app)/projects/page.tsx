import React from 'react'
import { getProjectsAction } from '@/lib/actions/projects'
import { ProjectsClient } from './projects-client'

export default async function ProjectsPage() {
  const result = await getProjectsAction()
  const projects = result.success ? result.data || [] : []

  return <ProjectsClient initialProjects={projects} />
}
