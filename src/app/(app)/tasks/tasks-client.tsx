'use client'

import React, { useState, useMemo } from 'react'
import {
  CheckSquare,
  Plus,
  Search,
  ArrowUpDown,
  Calendar,
  Clock,
  Circle,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Trash2,
  FastForward,
  CornerDownRight,
  ShieldAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dropdown } from '@/components/ui/dropdown'
import { CreateTaskModal } from '@/components/tasks/create-task-modal'
import { useToast } from '@/components/ui/toast'
import {
  TaskWithDetails,
  toggleTaskCompletionAction,
  deleteTaskAction,
  moveTaskToTomorrowAction,
} from '@/lib/actions/tasks'
import { Project, Task } from '@/types'
import { useRouter } from 'next/navigation'

interface TasksClientProps {
  initialTasks: TaskWithDetails[]
  projects: Project[]
}

const statusOptions = [
  { id: 'all', label: 'All Tasks' },
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
]

const priorityOptions = [
  { id: 'all', label: 'All Priorities' },
  { id: 'p1', label: 'P1 Urgent' },
  { id: 'p2', label: 'P2 High' },
  { id: 'p3', label: 'P3 Medium' },
  { id: 'p4', label: 'P4 Low' },
]

export function TasksClient({ initialTasks, projects }: TasksClientProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [tasks, setTasks] = useState<TaskWithDetails[]>(initialTasks)
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [onlyOverdue, setOnlyOverdue] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'deadline' | 'priority' | 'title' | 'created'>('deadline')

  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({})
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [parentTaskIdForSubtask, setParentTaskIdForSubtask] = useState<string | null>(null)
  const [currentTimestamp] = useState(() => Date.now())

  const toggleExpand = (taskId: string) => {
    setExpandedSubtasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }))
  }

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
        title: 'Update failed',
        message: res.error || 'Could not update task',
        type: 'error',
      })
      router.refresh()
    } else {
      router.refresh()
    }
  }

  const handleMoveToTomorrow = async (taskId: string, title: string) => {
    const res = await moveTaskToTomorrowAction(taskId)
    if (res.success) {
      toast({
        title: 'Task Rescheduled',
        message: `"${title}" was moved to tomorrow.`,
        type: 'success',
      })
      router.refresh()
    } else {
      toast({
        title: 'Reschedule failed',
        message: res.error || 'Failed to reschedule task',
        type: 'error',
      })
    }
  }

  const handleDeleteTask = async (taskId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete task "${title}"?`)) return
    const res = await deleteTaskAction(taskId)
    if (res.success) {
      toast({
        title: 'Task deleted',
        message: `"${title}" was removed.`,
        type: 'success',
      })
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      router.refresh()
    } else {
      toast({
        title: 'Error',
        message: res.error || 'Failed to delete task',
        type: 'error',
      })
    }
  }

  const filteredTasks = useMemo(() => {
    let result = [...tasks]

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter)
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      result = result.filter((t) => t.priority === priorityFilter)
    }

    // Project filter
    if (projectFilter !== 'all') {
      result = result.filter((t) => t.project_id === projectFilter)
    }

    // Overdue filter
    if (onlyOverdue) {
      result = result.filter(
        (t) =>
          t.status !== 'completed' &&
          t.deadline_at &&
          new Date(t.deadline_at).getTime() < currentTimestamp
      )
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q))
      )
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title)
      }
      if (sortBy === 'priority') {
        const priorityWeight = { p1: 1, p2: 2, p3: 3, p4: 4 }
        return priorityWeight[a.priority] - priorityWeight[b.priority]
      }
      if (sortBy === 'created') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      // Default: Deadline (earliest first, nulls last)
      if (!a.deadline_at) return 1
      if (!b.deadline_at) return -1
      return new Date(a.deadline_at).getTime() - new Date(b.deadline_at).getTime()
    })

    return result
  }, [tasks, statusFilter, priorityFilter, projectFilter, onlyOverdue, searchQuery, sortBy, currentTimestamp])

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 text-[#8B7CFF]">
              <CheckSquare className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Tasks
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Capture, sequence, and execute work with subtasks, dependencies, and timeblocks.
          </p>
        </div>

        <Button
          onClick={() => {
            setParentTaskIdForSubtask(null)
            setIsCreateOpen(true)
          }}
          variant="primary"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Pills */}
          {statusOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setStatusFilter(opt.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                statusFilter === opt.id
                  ? 'bg-[#8B7CFF] text-white shadow-md shadow-[#8B7CFF]/20 font-semibold'
                  : 'bg-[#141B2D] text-slate-400 hover:text-white border border-white/5 hover:border-white/10'
              }`}
            >
              {opt.label}
            </button>
          ))}

          {/* Overdue Quick Toggle */}
          <button
            onClick={() => setOnlyOverdue(!onlyOverdue)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
              onlyOverdue
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20 font-semibold'
                : 'bg-[#141B2D] text-slate-400 hover:text-rose-400 border border-white/5 hover:border-rose-500/30'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Overdue Only</span>
          </button>
        </div>

        {/* Secondary Filters row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks by title or notes..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#141B2D] border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-[#8B7CFF]"
            />
          </div>

          {/* Project dropdown filter */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#141B2D] border border-white/10 text-xs text-slate-300 focus:outline-none focus:border-[#8B7CFF] cursor-pointer"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          {/* Priority dropdown filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#141B2D] border border-white/10 text-xs text-slate-300 focus:outline-none focus:border-[#8B7CFF] cursor-pointer"
          >
            {priorityOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          {/* Sort By */}
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#141B2D] border border-white/10 text-xs text-slate-300 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'deadline' | 'priority' | 'title' | 'created')}
              className="bg-transparent text-white focus:outline-none cursor-pointer"
            >
              <option value="deadline" className="bg-[#141B2D]">Deadline</option>
              <option value="priority" className="bg-[#141B2D]">Priority</option>
              <option value="created" className="bg-[#141B2D]">Created</option>
              <option value="title" className="bg-[#141B2D]">Title</option>
            </select>
          </div>
        </div>
      </div>

      {/* Task Rows */}
      {filteredTasks.length === 0 ? (
        <Card className="text-center py-16 px-4 border-dashed border-white/10">
          <div className="w-12 h-12 rounded-2xl bg-[#8B7CFF]/10 border border-[#8B7CFF]/20 flex items-center justify-center mx-auto mb-3 text-[#8B7CFF]">
            <CheckSquare className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No tasks match criteria</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-5">
            {searchQuery
              ? `No tasks matching "${searchQuery}".`
              : 'Add your first task with deadlines, scheduled time blocks, or subtasks.'}
          </p>
          <Button
            onClick={() => {
              setParentTaskIdForSubtask(null)
              setIsCreateOpen(true)
            }}
            size="sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const isCompleted = task.status === 'completed'
            const isOverdue =
              !isCompleted &&
              task.deadline_at &&
              new Date(task.deadline_at).getTime() < currentTimestamp

            const hasSubtasks = (task.subtasks || []).length > 0
            const isExpanded = !!expandedSubtasks[task.id]

            const hasBlockers = (task.blocking_tasks || []).some(
              (b) => b.status !== 'completed'
            )

            return (
              <div
                key={task.id}
                className={`rounded-2xl border transition-all ${
                  isOverdue
                    ? 'bg-[#182238]/90 border-rose-500/30 shadow-lg shadow-rose-500/5'
                    : isCompleted
                    ? 'bg-[#141B2D]/50 border-white/5 opacity-70'
                    : 'bg-[#141B2D] border-white/10 hover:border-white/20'
                }`}
              >
                {/* Main Task Item Row */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Completion Checkbox */}
                    <button
                      onClick={() => handleToggleTask(task.id)}
                      className={`mt-0.5 shrink-0 transition-colors ${
                        isCompleted
                          ? 'text-emerald-400 hover:text-slate-400'
                          : 'text-slate-500 hover:text-emerald-400'
                      }`}
                      aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-semibold truncate ${
                            isCompleted ? 'line-through text-slate-400' : 'text-white'
                          }`}
                        >
                          {task.title}
                        </span>

                        {/* Project Pill */}
                        {task.project && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border border-white/10"
                            style={{
                              backgroundColor: `${task.project.color_hex}15`,
                              color: task.project.color_hex,
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: task.project.color_hex }}
                            />
                            <span className="truncate max-w-[120px]">
                              {task.project.title}
                            </span>
                          </span>
                        )}

                        {/* Blocker Alert Warning */}
                        {hasBlockers && !isCompleted && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400"
                            title="Prerequisite task must be completed first"
                          >
                            <ShieldAlert className="w-3 h-3" />
                            <span>Blocked</span>
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs text-slate-400 line-clamp-1 mt-1">
                          {task.description}
                        </p>
                      )}

                      {/* Timelines and Badges */}
                      <div className="flex items-center gap-3 mt-2 flex-wrap text-xs">
                        {getPriorityBadge(task.priority)}

                        {/* Distinct Deadline Indicator */}
                        {task.deadline_at && (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md border ${
                              isOverdue
                                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 font-bold'
                                : 'bg-white/5 text-slate-400 border-white/10'
                            }`}
                          >
                            <Calendar className="w-3 h-3" />
                            <span>Due: {new Date(task.deadline_at).toLocaleDateString()}</span>
                          </span>
                        )}

                        {/* Distinct Scheduled Time Block */}
                        {task.scheduled_start_at && task.scheduled_end_at && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#22D3EE]/10 border border-[#22D3EE]/25 text-[#38BDF8]">
                            <Clock className="w-3 h-3" />
                            <span>
                              {new Date(task.scheduled_start_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              –{' '}
                              {new Date(task.scheduled_end_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Right */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    {/* Move to Tomorrow */}
                    {!isCompleted && (
                      <button
                        onClick={() => handleMoveToTomorrow(task.id, task.title)}
                        className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs flex items-center gap-1.5 transition-colors"
                        title="Reschedule to tomorrow (preserves audit history)"
                      >
                        <FastForward className="w-3.5 h-3.5 text-[#8B7CFF]" />
                        <span className="hidden sm:inline">Tomorrow</span>
                      </button>
                    )}

                    {/* Subtasks expand toggle */}
                    {hasSubtasks && (
                      <button
                        onClick={() => toggleExpand(task.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1 text-xs"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-[#8B7CFF]" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        <span>{task.subtasks?.length}</span>
                      </button>
                    )}

                    {/* Add Subtask Button */}
                    <button
                      onClick={() => {
                        setParentTaskIdForSubtask(task.id)
                        setIsCreateOpen(true)
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                      title="Add subtask"
                      aria-label="Add subtask"
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    {/* Dropdown for Delete */}
                    <Dropdown
                      trigger={
                        <button
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                          aria-label="Task options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      }
                      items={[
                        {
                          label: 'Delete Task',
                          icon: <Trash2 className="w-3.5 h-3.5" />,
                          variant: 'danger',
                          onClick: () => handleDeleteTask(task.id, task.title),
                        },
                      ]}
                    />
                  </div>
                </div>

                {/* Nested Subtasks List */}
                {hasSubtasks && isExpanded && (
                  <div className="pl-8 pr-4 pb-4 pt-1 border-t border-white/5 space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Subtasks
                    </span>
                    {task.subtasks?.map((sub) => {
                      const isSubDone = sub.status === 'completed'
                      return (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-black/20 border border-white/5 text-xs"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <CornerDownRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <button
                              onClick={() => handleToggleTask(sub.id)}
                              className={`shrink-0 ${
                                isSubDone ? 'text-emerald-400' : 'text-slate-500 hover:text-emerald-400'
                              }`}
                            >
                              {isSubDone ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : (
                                <Circle className="w-4 h-4" />
                              )}
                            </button>
                            <span
                              className={`truncate ${
                                isSubDone ? 'line-through text-slate-500' : 'text-slate-200'
                              }`}
                            >
                              {sub.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {getPriorityBadge(sub.priority)}
                            <button
                              onClick={() => handleDeleteTask(sub.id, sub.title)}
                              className="text-slate-500 hover:text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Add Subtask Modal */}
      <CreateTaskModal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false)
          setParentTaskIdForSubtask(null)
        }}
        defaultParentTaskId={parentTaskIdForSubtask}
        onSuccess={() => router.refresh()}
        projects={projects}
        availableTasks={tasks}
      />
    </div>
  )
}
