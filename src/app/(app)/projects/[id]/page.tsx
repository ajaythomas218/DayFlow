import React from 'react'
import { notFound } from 'next/navigation'
import { getProjectByIdAction } from '@/lib/actions/projects'
import { ProjectDetailClient } from './project-detail-client'

interface ProjectPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const { id } = await params
  const result = await getProjectByIdAction(id)

  if (!result.success || !result.data) {
    notFound()
  }

  return (
    <ProjectDetailClient
      initialProject={result.data.project}
      initialTasks={result.data.tasks}
    />
  )
}
