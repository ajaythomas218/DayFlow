'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  FolderKanban,
  Plus,
  Search,
  ArrowUpDown,
  Calendar,
  MoreVertical,
  Archive,
  Trash2,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dropdown } from '@/components/ui/dropdown'
import { CreateProjectModal } from '@/components/projects/create-project-modal'
import { useToast } from '@/components/ui/toast'
import { archiveProjectAction, deleteProjectAction, ProjectWithProgress } from '@/lib/actions/projects'
import { useRouter } from 'next/navigation'

interface ProjectsClientProps {
  initialProjects: ProjectWithProgress[]
}

const statusFilters = [
  { id: 'all', label: 'All Projects' },
  { id: 'active', label: 'Active' },
  { id: 'backlog', label: 'Backlog' },
  { id: 'on_hold', label: 'On Hold' },
  { id: 'completed', label: 'Completed' },
  { id: 'archived', label: 'Archived' },
]

export function ProjectsClient({ initialProjects }: ProjectsClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [projects, setProjects] = useState<ProjectWithProgress[]>(initialProjects)
  const [activeFilter, setActiveFilter] = useState('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'progress' | 'title'>('date')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [currentTimestamp] = useState(() => Date.now())

  const filteredProjects = useMemo(() => {
    let result = [...projects]

    // Status filter
    if (activeFilter !== 'all') {
      result = result.filter((p) => p.status === activeFilter)
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      )
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'progress') {
        return b.progress_percentage - a.progress_percentage
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title)
      }
      // Default: Target date (nearest first, nulls last)
      if (!a.target_completion_date) return 1
      if (!b.target_completion_date) return -1
      return new Date(a.target_completion_date).getTime() - new Date(b.target_completion_date).getTime()
    })

    return result
  }, [projects, activeFilter, searchQuery, sortBy])

  const handleArchive = async (id: string, title: string) => {
    const res = await archiveProjectAction(id)
    if (res.success) {
      toast({
        title: 'Project archived',
        message: `"${title}" has been moved to archive.`,
        type: 'info',
      })
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: 'archived' } : p))
      )
      router.refresh()
    } else {
      toast({
        title: 'Action failed',
        message: res.error || 'Failed to archive project',
        type: 'error',
      })
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete project "${title}"?`)) {
      return
    }
    const res = await deleteProjectAction(id)
    if (res.success) {
      toast({
        title: 'Project deleted',
        message: `"${title}" was removed.`,
        type: 'success',
      })
      setProjects((prev) => prev.filter((p) => p.id !== id))
      router.refresh()
    } else {
      toast({
        title: 'Action failed',
        message: res.error || 'Failed to delete project',
        type: 'error',
      })
    }
  }

  const getStatusBadge = (status: ProjectWithProgress['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="violet">Active</Badge>
      case 'completed':
        return <Badge variant="success">Completed</Badge>
      case 'on_hold':
        return <Badge variant="warning">On Hold</Badge>
      case 'backlog':
        return <Badge variant="cyan">Backlog</Badge>
      case 'archived':
        return <Badge variant="neutral">Archived</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 text-[#8B7CFF]">
              <FolderKanban className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Projects
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Organize workloads, monitor milestone completions, and drive outcomes.
          </p>
        </div>

        <Button onClick={() => setIsCreateOpen(true)} variant="primary">
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </Button>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pt-2">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
          {statusFilters.map((tab) => {
            const isSelected = activeFilter === tab.id
            const count =
              tab.id === 'all'
                ? projects.length
                : projects.filter((p) => p.status === tab.id).length
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                  isSelected
                    ? 'bg-[#8B7CFF] text-white shadow-md shadow-[#8B7CFF]/20 font-semibold'
                    : 'bg-[#141B2D] text-slate-400 hover:text-white border border-white/5 hover:border-white/10'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#141B2D] border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-[#8B7CFF]"
            />
          </div>

          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#141B2D] border border-white/10 text-xs text-slate-300">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'progress' | 'title')}
              className="bg-transparent text-white focus:outline-none cursor-pointer"
            >
              <option value="date" className="bg-[#141B2D]">Target Date</option>
              <option value="progress" className="bg-[#141B2D]">Progress</option>
              <option value="title" className="bg-[#141B2D]">Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <Card className="text-center py-16 px-4 border-dashed border-white/10">
          <div className="w-12 h-12 rounded-2xl bg-[#8B7CFF]/10 border border-[#8B7CFF]/20 flex items-center justify-center mx-auto mb-3 text-[#8B7CFF]">
            <FolderKanban className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No projects found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-5">
            {searchQuery
              ? `No projects matching "${searchQuery}". Try adjusting your search term.`
              : activeFilter !== 'all'
              ? `You don't have any projects with "${activeFilter}" status.`
              : 'Create your first project to organize related tasks and track target dates.'}
          </p>
          <Button onClick={() => setIsCreateOpen(true)} size="sm">
            <Plus className="w-4 h-4" />
            <span>Create Project</span>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => {
            const hasTarget = !!project.target_completion_date
            const isOverdue =
              hasTarget &&
              new Date(project.target_completion_date!).getTime() < currentTimestamp &&
              project.status !== 'completed'

            return (
              <Card
                key={project.id}
                className="flex flex-col justify-between group hover:border-[#8B7CFF]/40 transition-all relative overflow-hidden"
              >
                {/* Accent Color Strip */}
                <div
                  aria-hidden="true"
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: project.color_hex }}
                />

                <div className="pt-2">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-bold text-white text-base hover:text-[#8B7CFF] transition-colors line-clamp-1 group-hover:underline"
                    >
                      {project.title}
                    </Link>

                    <Dropdown
                      trigger={
                        <button
                          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                          aria-label="Project actions"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      }
                      items={[
                        {
                          label: 'View Project Details',
                          icon: <ExternalLink className="w-3.5 h-3.5" />,
                          onClick: () => router.push(`/projects/${project.id}`),
                        },
                        {
                          label: project.status === 'archived' ? 'Reactivate' : 'Archive Project',
                          icon: <Archive className="w-3.5 h-3.5" />,
                          onClick: () => handleArchive(project.id, project.title),
                        },
                        {
                          label: 'Delete Project',
                          icon: <Trash2 className="w-3.5 h-3.5" />,
                          variant: 'danger',
                          onClick: () => handleDelete(project.id, project.title),
                        },
                      ]}
                    />
                  </div>

                  {project.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
                      {project.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mb-4">
                    {getStatusBadge(project.status)}
                    {hasTarget && (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md border ${
                          isOverdue
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-white/5 text-slate-400 border-white/10'
                        }`}
                      >
                        <Calendar className="w-3 h-3" />
                        <span>{project.target_completion_date}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Section */}
                <div className="pt-4 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Progress</span>
                    <span className="text-white font-mono font-bold">
                      {project.progress_percentage}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${project.progress_percentage}%`,
                        backgroundColor: project.color_hex,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>
                      {project.completed_tasks} of {project.total_tasks} tasks complete
                    </span>
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-[#8B7CFF] hover:text-[#9E91FF] font-medium flex items-center gap-1"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <CreateProjectModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => router.refresh()}
      />
    </div>
  )
}
