'use client'

import React, { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input, Textarea, Label, Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { createTaskAction } from '@/lib/actions/tasks'
import { Project, Task } from '@/types'
import { ReminderEditor } from '@/components/reminders/reminder-editor'
import { RecurrenceEditor } from '@/components/reminders/recurrence-editor'
import { ReminderRuleInput } from '@/lib/validations/reminders'

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  defaultProjectId?: string | null
  defaultParentTaskId?: string | null
  projects?: Project[]
  availableTasks?: Task[]
}

export function CreateTaskModal({
  isOpen,
  onClose,
  onSuccess,
  defaultProjectId,
  defaultParentTaskId,
  projects = [],
  availableTasks = [],
}: CreateTaskModalProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [projectId, setProjectId] = useState<string>(defaultProjectId || '')
  const parentTaskId = defaultParentTaskId || ''
  const [hasScheduledTime, setHasScheduledTime] = useState<boolean>(false)
  const [deadlineValue, setDeadlineValue] = useState<string>('')
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>([])
  const [reminders, setReminders] = useState<ReminderRuleInput[]>([
    { offset_minutes: 15, is_relative_to_start: true, channel: 'in_app', is_active: true },
  ])
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(null)
  const [syncWithGoogle, setSyncWithGoogle] = useState<boolean | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    const title = formData.get('title') as string
    const description = (formData.get('description') as string) || null
    const priority = (formData.get('priority') as Task['priority']) || 'p3'
    const status = (formData.get('status') as Task['status']) || 'todo'

    const deadlineRaw = formData.get('deadline_at') as string
    const deadline_at = deadlineRaw ? new Date(deadlineRaw).toISOString() : null

    let scheduled_start_at: string | null = null
    let scheduled_end_at: string | null = null

    if (hasScheduledTime) {
      const startRaw = formData.get('scheduled_start_at') as string
      const endRaw = formData.get('scheduled_end_at') as string
      if (startRaw && endRaw) {
        scheduled_start_at = new Date(startRaw).toISOString()
        scheduled_end_at = new Date(endRaw).toISOString()
      } else if (startRaw || endRaw) {
        setError('Both scheduled start and end times must be provided together.')
        return
      }
    }

    const payload = {
      title,
      description,
      project_id: projectId || null,
      parent_task_id: parentTaskId || null,
      status,
      priority,
      deadline_at,
      scheduled_start_at,
      scheduled_end_at,
      is_time_blocked: hasScheduledTime,
      dependency_ids: selectedDependencies,
      recurrence_rule: recurrenceRule,
      reminders,
      sync_with_google: syncWithGoogle,
    }

    startTransition(async () => {
      const res = await createTaskAction(payload)
      if (res.success) {
        toast({
          title: 'Task created',
          message: `"${title}" has been added.`,
          type: 'success',
        })
        onClose()
        onSuccess?.()
      } else {
        setError(res.error || 'Failed to create task')
      }
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={parentTaskId ? 'Add Subtask' : 'Create New Task'}
      description="Add a task with distinct deadlines, scheduled time blocks, and dependencies"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div>
          <Label htmlFor="task-title">Task Title *</Label>
          <Input
            id="task-title"
            name="title"
            required
            maxLength={200}
            placeholder="e.g. Audit API authentication latency"
          />
        </div>

        <div>
          <Label htmlFor="task-desc">Description</Label>
          <Textarea
            id="task-desc"
            name="description"
            rows={2}
            placeholder="Context, requirements, links or checklists..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="task-priority">Priority</Label>
            <Select id="task-priority" name="priority" defaultValue="p3">
              <option value="p1">P1 — Urgent</option>
              <option value="p2">P2 — High</option>
              <option value="p3">P3 — Medium</option>
              <option value="p4">P4 — Low</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="task-status">Status</Label>
            <Select id="task-status" name="status" defaultValue="todo">
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="task-project">Project</Label>
            <Select
              id="task-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">No Project (Inbox)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Deadline vs Scheduled Time — distinct fields */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Timelines &amp; Horizons
            </span>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 hover:text-white">
              <input
                type="checkbox"
                checked={hasScheduledTime}
                onChange={(e) => setHasScheduledTime(e.target.checked)}
                className="rounded border-white/20 bg-[#141B2D] text-[#8B7CFF] focus:ring-[#8B7CFF]"
              />
              <span>Time-block calendar slot</span>
            </label>
          </div>

          <div>
            <Label htmlFor="task-deadline">Deadline (Due Date &amp; Time)</Label>
            <Input
              id="task-deadline"
              name="deadline_at"
              type="datetime-local"
              value={deadlineValue}
              onChange={(e) => setDeadlineValue(e.target.value)}
            />
          </div>

          {hasScheduledTime && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5 animate-in fade-in">
              <div>
                <Label htmlFor="task-scheduled-start">Scheduled Start</Label>
                <Input
                  id="task-scheduled-start"
                  name="scheduled_start_at"
                  type="datetime-local"
                />
              </div>
              <div>
                <Label htmlFor="task-scheduled-end">Scheduled End</Label>
                <Input
                  id="task-scheduled-end"
                  name="scheduled_end_at"
                  type="datetime-local"
                />
              </div>
            </div>
          )}
        </div>

        {/* Recurrence & Schedules */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
          <RecurrenceEditor
            value={recurrenceRule}
            onChange={setRecurrenceRule}
          />
        </div>

        {/* Reminders Engine */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
          <ReminderEditor
            reminders={reminders}
            onChange={setReminders}
            hasScheduledStart={hasScheduledTime}
            hasDeadline={Boolean(deadlineValue)}
            itemType="task"
          />
        </div>

        {/* Google Calendar Sync Preference */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
          <div>
            <label className="text-xs font-medium text-slate-200">Google Calendar Sync</label>
            <p className="text-[11px] text-slate-400">
              {syncWithGoogle === null
                ? 'Follow default account settings for scheduled tasks'
                : syncWithGoogle
                ? 'Always sync this task to Google Calendar when scheduled'
                : 'Do not sync this task to Google Calendar'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-[#0B0F19] p-1 rounded-lg border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setSyncWithGoogle(null)}
              className={`px-2 py-1 rounded-md transition-colors ${
                syncWithGoogle === null
                  ? 'bg-[#8B7CFF] text-white font-medium'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Auto
            </button>
            <button
              type="button"
              onClick={() => setSyncWithGoogle(true)}
              className={`px-2 py-1 rounded-md transition-colors ${
                syncWithGoogle === true
                  ? 'bg-[#22D3EE] text-slate-950 font-medium'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sync
            </button>
            <button
              type="button"
              onClick={() => setSyncWithGoogle(false)}
              className={`px-2 py-1 rounded-md transition-colors ${
                syncWithGoogle === false
                  ? 'bg-slate-700 text-white font-medium'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Exclude
            </button>
          </div>
        </div>

        {/* Dependencies (Optional Blockers) */}
        {availableTasks.length > 0 && !parentTaskId && (
          <div>
            <Label>Prerequisite Blockers (Blocked By)</Label>
            <Select
              onChange={(e) => {
                const val = e.target.value
                if (val && !selectedDependencies.includes(val)) {
                  setSelectedDependencies([...selectedDependencies, val])
                }
              }}
              value=""
            >
              <option value="">Select a task that must finish first...</option>
              {availableTasks
                .filter((t) => !selectedDependencies.includes(t.id))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.status})
                  </option>
                ))}
            </Select>

            {selectedDependencies.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedDependencies.map((depId) => {
                  const t = availableTasks.find((item) => item.id === depId)
                  return (
                    <span
                      key={depId}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 text-[#9E91FF]"
                    >
                      <span className="truncate max-w-[180px]">{t?.title || 'Task'}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedDependencies(selectedDependencies.filter((id) => id !== depId))}
                        className="text-slate-400 hover:text-white"
                      >
                        ×
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isPending}>
            {parentTaskId ? 'Add Subtask' : 'Create Task'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
