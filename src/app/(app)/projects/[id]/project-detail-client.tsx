'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Edit2,
  Trash2,
  Archive,
  MoreVertical,
  CheckSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dropdown } from '@/components/ui/dropdown'
import { Modal } from '@/components/ui/modal'
import { Input, Textarea, Label, Select } from '@/components/ui/input'
import { CreateTaskModal } from '@/components/tasks/create-task-modal'
import { useToast } from '@/components/ui/toast'
import {
  ProjectWithProgress,
  updateProjectAction,
  archiveProjectAction,
  deleteProjectAction,
} from '@/lib/actions/projects'
import { toggleTaskCompletionAction } from '@/lib/actions/tasks'
import { Task } from '@/types'

interface ProjectDetailClientProps {
  initialProject: ProjectWithProgress
  initialTasks: Task[]
}

const colorPresets = [
  '#8B7CFF',
  '#22D3EE',
  '#34D399',
  '#FBBF24',
  '#F87171',
  '#A78BFA',
  '#38BDF8',
  '#EC4899',
]

export function ProjectDetailClient({ initialProject, initialTasks }: ProjectDetailClientProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [project, setProject] = useState<ProjectWithProgress>(initialProject)
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
  const [selectedColor, setSelectedColor] = useState(project.color_hex)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled')
  const completedTasks = tasks.filter((t) => t.status === 'completed')

  const handleToggleTask = async (taskId: string) => {
    // Optimistic toggle
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const isDone = t.status === 'completed'
          return {
            ...t,
            status: isDone ? 'todo' : 'completed',
            completed_at: isDone ? null : new Date().toISOString(),
          }
        }
        return t
      })
    )

    const res = await toggleTaskCompletionAction(taskId)
    if (!res.success) {
      toast({
        title: 'Error',
        message: res.error || 'Failed to update task state',
        type: 'error',
      })
      // Revert from server refresh
      router.refresh()
    } else {
      router.refresh()
    }
  }

  const handleUpdateProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsUpdating(true)
    setError(null)
    const formData = new FormData(e.currentTarget)

    const payload = {
      id: project.id,
      title: formData.get('title') as string,
      description: (formData.get('description') as string) || null,
      color_hex: selectedColor,
      status: (formData.get('status') as ProjectWithProgress['status']) || 'active',
      target_completion_date: (formData.get('target_completion_date') as string) || null,
    }

    const res = await updateProjectAction(payload)
    setIsUpdating(false)

    if (res.success && res.data) {
      toast({
        title: 'Project updated',
        type: 'success',
      })
      setProject((prev) => ({
        ...prev,
        ...res.data,
      }))
      setIsEditOpen(false)
      router.refresh()
    } else {
      setError(res.error || 'Failed to update project')
    }
  }

  const handleArchive = async () => {
    const res = await archiveProjectAction(project.id)
    if (res.success) {
      toast({
        title: 'Project archived',
        type: 'info',
      })
      router.push('/projects')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project? Associated tasks will remain in Inbox.')) {
      return
    }
    const res = await deleteProjectAction(project.id)
    if (res.success) {
      toast({
        title: 'Project deleted',
        type: 'success',
      })
      router.push('/projects')
    }
  }

  const getPriorityBadge = (priority: Task['priority']) => {
    switch (priority) {
      case 'p1':
        return <Badge variant="danger">P1 Urgent</Badge>
      case 'p2':
        return <Badge variant="warning">P2 High</Badge>
      case 'p3':
        return <Badge variant="violet">P3 Medium</Badge>
      case 'p4':
        return <Badge variant="neutral">P4 Low</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation Back */}
      <div className="flex items-center justify-between">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Projects</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button onClick={() => setIsEditOpen(true)} variant="secondary" size="sm">
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </Button>

          <Dropdown
            trigger={
              <button
                className="p-1.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="More options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            }
            items={[
              {
                label: project.status === 'archived' ? 'Reactivate' : 'Archive Project',
                icon: <Archive className="w-3.5 h-3.5" />,
                onClick: handleArchive,
              },
              {
                label: 'Delete Project',
                icon: <Trash2 className="w-3.5 h-3.5" />,
                variant: 'danger',
                onClick: handleDelete,
              },
            ]}
          />
        </div>
      </div>

      {/* Project Banner Card */}
      <Card className="relative overflow-hidden border border-white/10 p-6">
        <div
          aria-hidden="true"
          className="absolute top-0 left-0 right-0 h-2"
          style={{ backgroundColor: project.color_hex }}
        />

        <div className="pt-2 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0"
                style={{ backgroundColor: project.color_hex }}
              />
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {project.title}
              </h1>
              <Badge variant="violet" className="capitalize">
                {project.status.replace('_', ' ')}
              </Badge>
            </div>

            {project.description && (
              <p className="text-sm text-slate-300 leading-relaxed pt-1">
                {project.description}
              </p>
            )}

            {project.target_completion_date && (
              <div className="flex items-center gap-2 text-xs text-slate-400 pt-2 font-mono">
                <Calendar className="w-4 h-4 text-[#8B7CFF]" />
                <span>Target completion: {project.target_completion_date}</span>
              </div>
            )}
          </div>

          {/* Derived Progress Ring / Bar */}
          <div className="flex flex-col items-start md:items-end justify-center p-4 rounded-xl bg-white/[0.02] border border-white/5 min-w-[180px]">
            <span className="text-xs text-slate-400 font-medium">Derived Progress</span>
            <span className="text-3xl font-extrabold text-white font-mono mt-0.5">
              {project.progress_percentage}%
            </span>
            <span className="text-[11px] text-slate-400 mt-1">
              {project.completed_tasks} / {project.total_tasks} tasks finished
            </span>
            <div className="w-full h-1.5 rounded-full bg-white/10 mt-2.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${project.progress_percentage}%`,
                  backgroundColor: project.color_hex,
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Tasks Section Header */}
      <div className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-[#8B7CFF]" />
          <h2 className="text-lg font-bold text-white tracking-tight">Project Tasks</h2>
          <span className="text-xs text-slate-400 font-mono">({tasks.length})</span>
        </div>

        <Button onClick={() => setIsAddTaskOpen(true)} size="sm">
          <Plus className="w-4 h-4" />
          <span>Add Task</span>
        </Button>
      </div>

      {/* Task List */}
      <div className="space-y-6">
        {/* Active Tasks Group */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
            To Do &amp; In Progress ({activeTasks.length})
          </h3>

          {activeTasks.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-white/10 text-center text-xs text-slate-400">
              No active tasks in this project. Click &ldquo;Add Task&rdquo; to schedule new deliverables.
            </div>
          ) : (
            activeTasks.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-[#141B2D] border border-white/5 hover:border-white/15 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => handleToggleTask(t.id)}
                    className="text-slate-500 hover:text-emerald-400 transition-colors shrink-0"
                    aria-label="Mark task complete"
                  >
                    <Circle className="w-5 h-5" />
                  </button>
                  <div className="truncate">
                    <span className="text-sm font-medium text-white truncate group-hover:text-[#8B7CFF] transition-colors">
                      {t.title}
                    </span>
                    {t.description && (
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{t.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 ml-3">
                  {getPriorityBadge(t.priority)}
                  {t.deadline_at && (
                    <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{new Date(t.deadline_at).toLocaleDateString()}</span>
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Completed Tasks Group */}
        {completedTasks.length > 0 && (
          <div className="space-y-2 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
              Completed Tasks ({completedTasks.length})
            </h3>
            {completedTasks.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-[#141B2D]/60 border border-white/5 opacity-75 hover:opacity-100 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => handleToggleTask(t.id)}
                    className="text-emerald-400 hover:text-slate-400 transition-colors shrink-0"
                    aria-label="Reopen task"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-medium text-slate-400 line-through truncate">
                    {t.title}
                  </span>
                </div>

                <div className="text-[11px] font-mono text-slate-500 shrink-0">
                  {t.completed_at && new Date(t.completed_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Project Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Project"
        description="Update project details, target deadlines, and status"
      >
        <form onSubmit={handleUpdateProject} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="edit-title">Project Title *</Label>
            <Input
              id="edit-title"
              name="title"
              required
              defaultValue={project.title}
              maxLength={120}
            />
          </div>

          <div>
            <Label htmlFor="edit-desc">Description</Label>
            <Textarea
              id="edit-desc"
              name="description"
              rows={3}
              defaultValue={project.description || ''}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-status">Status</Label>
              <Select id="edit-status" name="status" defaultValue={project.status}>
                <option value="active">Active</option>
                <option value="backlog">Backlog</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-target">Target Completion Date</Label>
              <Input
                id="edit-target"
                name="target_completion_date"
                type="date"
                defaultValue={project.target_completion_date || ''}
              />
            </div>
          </div>

          <div>
            <Label>Accent Color</Label>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {colorPresets.map((hex) => {
                const isSelected = selectedColor.toLowerCase() === hex.toLowerCase()
                return (
                  <button
                    type="button"
                    key={hex}
                    onClick={() => setSelectedColor(hex)}
                    className={`w-7 h-7 rounded-full transition-transform border-2 ${
                      isSelected ? 'scale-110 border-white ring-2 ring-[#8B7CFF]' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isUpdating}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Task Modal for this project */}
      <CreateTaskModal
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        defaultProjectId={project.id}
        onSuccess={() => router.refresh()}
        projects={[project]}
      />
    </div>
  )
}
