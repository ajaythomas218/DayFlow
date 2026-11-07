'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Sparkles,
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  AlertTriangle,
  FolderKanban,
  FastForward,
  Plus,
  ArrowRight,
  TrendingUp,
  Target,
  CheckSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreateTaskModal } from '@/components/tasks/create-task-modal'
import { CreateProjectModal } from '@/components/projects/create-project-modal'
import { useToast } from '@/components/ui/toast'
import {
  toggleTaskCompletionAction,
  moveTaskToTomorrowAction,
  batchRescheduleTasksAction,
  TaskWithDetails,
} from '@/lib/actions/tasks'
import { ProjectWithProgress } from '@/lib/actions/projects'
import { isTodayInTimezone, isOverdueInTimezone, isUpcomingInTimezone } from '@/lib/timezone'
import { Task } from '@/types'

interface DashboardClientProps {
  userDisplayName?: string
  userTimezone?: string
  tasks: TaskWithDetails[]
  projects: ProjectWithProgress[]
}

export function DashboardClient({
  userDisplayName,
  userTimezone = 'UTC',
  tasks: initialTasks,
  projects,
}: DashboardClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [tasks, setTasks] = useState<TaskWithDetails[]>(initialTasks)
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false)
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false)

  // Derived task slices based on user timezone
  const overdueTasks = tasks.filter(
    (t) =>
      t.status !== 'completed' &&
      t.status !== 'cancelled' &&
      t.deadline_at &&
      isOverdueInTimezone(t.deadline_at, userTimezone)
  )

  const todayTasks = tasks.filter((t) => {
    if (t.status === 'completed') return false
    const isDueToday = t.deadline_at && isTodayInTimezone(t.deadline_at, userTimezone)
    const isScheduledToday =
      t.scheduled_start_at && isTodayInTimezone(t.scheduled_start_at, userTimezone)
    return isDueToday || isScheduledToday
  })

  const completedToday = tasks.filter(
    (t) =>
      t.status === 'completed' &&
      t.completed_at &&
      isTodayInTimezone(t.completed_at, userTimezone)
  )

  const focusTasks = tasks.filter(
    (t) =>
      t.status !== 'completed' &&
      t.status !== 'cancelled' &&
      (t.priority === 'p1' || t.priority === 'p2')
  )

  const upcomingTasks = tasks.filter(
    (t) =>
      t.status !== 'completed' &&
      t.status !== 'cancelled' &&
      t.deadline_at &&
      isUpcomingInTimezone(t.deadline_at, userTimezone, 7)
  )

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
        message: res.error || 'Failed to update task',
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
        title: 'Error',
        message: res.error || 'Failed to reschedule',
        type: 'error',
      })
    }
  }

  const handleBatchRescheduleOverdue = () => {
    if (overdueTasks.length === 0) return
    const taskIds = overdueTasks.map((t) => t.id)

    startTransition(async () => {
      const res = await batchRescheduleTasksAction({
        taskIds,
        daysForward: 1,
        reason: 'Batch rescheduled overdue to tomorrow',
      })

      if (res.success && res.data) {
        toast({
          title: 'Batch Rescheduled',
          message: `${res.data.successful.length} overdue task(s) moved to tomorrow.`,
          type: 'success',
        })
        router.refresh()
      } else {
        toast({
          title: 'Batch Reschedule Failed',
          message: res.error || 'Could not reschedule tasks',
          type: 'error',
        })
      }
    })
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

  const activeProjects = projects.filter((p) => p.status === 'active')

  return (
    <div className="space-y-8 pb-12">
      {/* Welcome & Horizon Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-[#06B6D4] mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>DayFlow — Daily Horizon</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Welcome back{userDisplayName ? `, ${userDisplayName}` : ''}
          </h1>
          <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
            <span>
              {new Intl.DateTimeFormat('en-US', {
                timeZone: userTimezone,
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              }).format(new Date())}
            </span>
            <span>•</span>
            <span className="font-mono text-xs text-slate-500">{userTimezone}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button onClick={() => setIsCreateTaskOpen(true)} variant="primary" size="sm">
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </Button>
          <Button onClick={() => setIsCreateProjectOpen(true)} variant="secondary" size="sm">
            <FolderKanban className="w-4 h-4 text-[#06B6D4]" />
            <span>New Project</span>
          </Button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex items-center gap-4 p-4 border border-white/10">
          <div className="p-3 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/30 text-[#7C3AED]">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <span className="text-2xl font-extrabold text-white font-mono">
              {todayTasks.length}
            </span>
            <p className="text-xs text-slate-400 font-medium">Due Today</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-4 border border-white/10">
          <div
            className={`p-3 rounded-xl border ${
              overdueTasks.length > 0
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                : 'bg-white/5 border-white/10 text-slate-400'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span
              className={`text-2xl font-extrabold font-mono ${
                overdueTasks.length > 0 ? 'text-rose-400' : 'text-white'
              }`}
            >
              {overdueTasks.length}
            </span>
            <p className="text-xs text-slate-400 font-medium">Overdue Attention</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-4 border border-white/10">
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-2xl font-extrabold text-white font-mono">
              {completedToday.length}
            </span>
            <p className="text-xs text-slate-400 font-medium">Completed Today</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-4 border border-white/10">
          <div className="p-3 rounded-xl bg-[#06B6D4]/15 border border-[#06B6D4]/30 text-[#06B6D4]">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <span className="text-2xl font-extrabold text-white font-mono">
              {activeProjects.length}
            </span>
            <p className="text-xs text-slate-400 font-medium">Active Projects</p>
          </div>
        </Card>
      </div>

      {/* Overdue Attention Panel */}
      {overdueTasks.length > 0 && (
        <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-rose-200">
                  {overdueTasks.length} Overdue Task{overdueTasks.length > 1 ? 's' : ''} Require Attention
                </h3>
                <p className="text-xs text-rose-300/80">
                  Past scheduled deadline. Complete them or move forward safely without losing audit history.
                </p>
              </div>
            </div>

            <Button
              onClick={handleBatchRescheduleOverdue}
              variant="danger"
              size="sm"
              isLoading={isPending}
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Reschedule All to Tomorrow</span>
            </Button>
          </div>

          <div className="space-y-2">
            {overdueTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[#141B2D]/90 border border-rose-500/20 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => handleToggleTask(task.id)}
                    className="text-slate-500 hover:text-emerald-400 shrink-0"
                  >
                    <Circle className="w-4 h-4" />
                  </button>
                  <span className="text-white font-medium truncate">{task.title}</span>
                  {task.project && (
                    <span
                      className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] border border-white/10 truncate max-w-[100px]"
                      style={{ color: task.project.color_hex }}
                    >
                      {task.project.title}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-rose-400 font-mono text-[11px]">
                    Due: {task.deadline_at && new Date(task.deadline_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleMoveToTomorrow(task.id, task.title)}
                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-[11px]"
                  >
                    Move to Tomorrow
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Layout: Today's Horizon + Focus / Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Today's Horizon */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-[#7C3AED]" />
                <h2 className="text-lg font-bold text-white tracking-tight">Today&rsquo;s Horizon</h2>
                <Badge variant="violet">{todayTasks.length}</Badge>
              </div>

              <Link
                href="/tasks"
                className="text-xs text-[#7C3AED] hover:text-[#8B5CF6] font-medium flex items-center gap-1"
              >
                <span>View All Tasks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {todayTasks.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-white/10 rounded-xl space-y-3">
                <CheckSquare className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-sm text-slate-300 font-medium">Nothing on your schedule for today!</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Enjoy your focused headspace or add tasks to keep momentum going.
                </p>
                <Button onClick={() => setIsCreateTaskOpen(true)} size="sm" variant="secondary">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Task for Today</span>
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {todayTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-[#141B2D] border border-white/5 hover:border-white/15 transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => handleToggleTask(task.id)}
                        className="text-slate-500 hover:text-emerald-400 shrink-0"
                        aria-label="Complete task"
                      >
                        <Circle className="w-5 h-5" />
                      </button>
                      <div className="truncate">
                        <span className="text-sm font-medium text-white truncate group-hover:text-[#7C3AED] transition-colors">
                          {task.title}
                        </span>
                        {task.project && (
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                            {task.project.title}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {getPriorityBadge(task.priority)}
                      {task.scheduled_start_at && task.scheduled_end_at ? (
                        <span className="text-[11px] font-mono text-[#06B6D4] bg-[#06B6D4]/10 px-2 py-0.5 rounded border border-[#06B6D4]/20">
                          {new Date(task.scheduled_start_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      ) : task.deadline_at ? (
                        <span className="text-[11px] font-mono text-slate-400">
                          {new Date(task.deadline_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Upcoming 7-Day Horizon */}
          {upcomingTasks.length > 0 && (
            <Card className="p-6 border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-5 h-5 text-[#06B6D4]" />
                  <h2 className="text-base font-bold text-white tracking-tight">Upcoming Deadlines (Next 7 Days)</h2>
                  <Badge variant="cyan">{upcomingTasks.length}</Badge>
                </div>
              </div>

              <div className="space-y-2">
                {upcomingTasks.slice(0, 5).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#141B2D]/60 border border-white/5 text-xs"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <button
                        onClick={() => handleToggleTask(t.id)}
                        className="text-slate-500 hover:text-emerald-400 shrink-0"
                      >
                        <Circle className="w-4 h-4" />
                      </button>
                      <span className="text-slate-200 truncate font-medium">{t.title}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {getPriorityBadge(t.priority)}
                      <span className="text-[11px] font-mono text-slate-400">
                        {t.deadline_at && new Date(t.deadline_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right 1 Col: Focus Priorities & Active Projects */}
        <div className="space-y-6">
          {/* Priority Focus */}
          <Card className="p-5 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white">Focus &amp; Priorities (P1 / P2)</h3>
              </div>
              <Badge variant="danger">{focusTasks.length}</Badge>
            </div>

            {focusTasks.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No high-priority tasks pending. All clear!
              </p>
            ) : (
              <div className="space-y-2">
                {focusTasks.slice(0, 4).map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl bg-[#141B2D] border border-white/5 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-white truncate">{t.title}</span>
                      {getPriorityBadge(t.priority)}
                    </div>
                    {t.deadline_at && (
                      <p className="text-[11px] font-mono text-slate-400">
                        Due: {new Date(t.deadline_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Active Projects Snapshot */}
          <Card className="p-5 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-[#7C3AED]" />
                <h3 className="text-sm font-bold text-white">Active Projects</h3>
              </div>
              <Link
                href="/projects"
                className="text-xs text-[#7C3AED] hover:text-[#8B5CF6] font-medium"
              >
                All
              </Link>
            </div>

            {activeProjects.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                <p>No active projects.</p>
                <button
                  onClick={() => setIsCreateProjectOpen(true)}
                  className="text-[#7C3AED] hover:underline mt-1 font-medium"
                >
                  Create one now
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {activeProjects.slice(0, 4).map((proj) => (
                  <Link
                    key={proj.id}
                    href={`/projects/${proj.id}`}
                    className="block p-3 rounded-xl bg-[#162032] border border-white/5 hover:border-white/15 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: proj.color_hex }}
                        />
                        <span className="font-semibold text-xs text-white truncate group-hover:text-[#7C3AED] transition-colors">
                          {proj.title}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-slate-300">
                        {proj.progress_percentage}%
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${proj.progress_percentage}%`,
                          backgroundColor: proj.color_hex,
                        }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Modals */}
      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
        onSuccess={() => router.refresh()}
        projects={projects}
        availableTasks={tasks}
      />

      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        onSuccess={() => router.refresh()}
      />
    </div>
  )
}

