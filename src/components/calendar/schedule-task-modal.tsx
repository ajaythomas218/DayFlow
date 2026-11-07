'use client'

import React, { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input, Label, Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { scheduleTaskTimeblockAction } from '@/lib/actions/calendar'
import { Task } from '@/types'

interface ScheduleTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  tasks: Task[]
  defaultStartTime?: string | null
  defaultEndTime?: string | null
}

export function ScheduleTaskModal({
  isOpen,
  onClose,
  onSuccess,
  tasks = [],
  defaultStartTime,
  defaultEndTime,
}: ScheduleTaskModalProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')

  // Format default start/end for datetime-local input
  const formatInputDateTime = (isoString?: string | null) => {
    if (!isoString) return ''
    try {
      const d = new Date(isoString)
      if (isNaN(d.getTime())) return ''
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    } catch {
      return ''
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    const taskId = selectedTaskId || (formData.get('task_id') as string)
    if (!taskId) {
      setError('Please select a task to schedule.')
      return
    }

    const startRaw = formData.get('scheduled_start_at') as string
    const endRaw = formData.get('scheduled_end_at') as string

    if (!startRaw || !endRaw) {
      setError('Both scheduled start and end times are required.')
      return
    }

    const scheduledStart = new Date(startRaw).toISOString()
    const scheduledEnd = new Date(endRaw).toISOString()

    if (new Date(scheduledEnd).getTime() <= new Date(scheduledStart).getTime()) {
      setError('Scheduled end time must be after scheduled start time.')
      return
    }

    startTransition(async () => {
      const res = await scheduleTaskTimeblockAction({
        taskId,
        scheduledStart,
        scheduledEnd,
        isTimeBlocked: true,
      })

      if (res.success) {
        toast({
          title: 'Task time block scheduled',
          message: 'The task has been placed onto your calendar horizon.',
          type: 'success',
        })
        onClose()
        onSuccess?.()
      } else {
        setError(res.error || 'Failed to schedule task timeblock')
      }
    })
  }

  // Filter tasks to show incomplete tasks first
  const activeTasks = tasks.filter((t) => t.status !== 'completed')

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Time-Block a Task"
      description="Allocate dedicated calendar focus time for an existing task without altering its deadline"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div>
          <Label htmlFor="schedule-task-id">Select Task *</Label>
          <Select
            id="schedule-task-id"
            name="task_id"
            required
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
          >
            <option value="">Select a task to schedule...</option>
            {activeTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.priority.toUpperCase()})
                {t.deadline_at ? ` — Due: ${new Date(t.deadline_at).toLocaleDateString()}` : ''}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5">
          <div>
            <Label htmlFor="timeblock-start">Scheduled Start *</Label>
            <Input
              id="timeblock-start"
              name="scheduled_start_at"
              type="datetime-local"
              required
              defaultValue={formatInputDateTime(defaultStartTime)}
            />
          </div>

          <div>
            <Label htmlFor="timeblock-end">Scheduled End *</Label>
            <Input
              id="timeblock-end"
              name="scheduled_end_at"
              type="datetime-local"
              required
              defaultValue={formatInputDateTime(defaultEndTime)}
            />
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Time-blocking sets a scheduled focus slot on your calendar. Any existing task deadline is preserved untouched in audit history.
        </p>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isPending}>
            Confirm Time Block
          </Button>
        </div>
      </form>
    </Modal>
  )
}

