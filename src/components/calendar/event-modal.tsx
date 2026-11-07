'use client'

import React, { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input, Textarea, Label, Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import {
  createCalendarEventAction,
  updateCalendarEventAction,
  deleteCalendarEventAction,
  CalendarEventWithDetails,
} from '@/lib/actions/calendar'
import { Project, Task } from '@/types'
import { CalendarEventType } from '@/lib/validations/calendar'
import { ReminderEditor } from '@/components/reminders/reminder-editor'
import { RecurrenceEditor } from '@/components/reminders/recurrence-editor'
import { ReminderRuleInput } from '@/lib/validations/reminders'
import { Trash2, Users, Video, MapPin } from 'lucide-react'

interface EventModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  initialEvent?: CalendarEventWithDetails | null
  defaultStartTime?: string | null
  defaultEndTime?: string | null
  projects?: Project[]
  tasks?: Task[]
}

function EventModalForm({
  onClose,
  onSuccess,
  initialEvent,
  defaultStartTime,
  defaultEndTime,
  projects = [],
  tasks = [],
}: Omit<EventModalProps, 'isOpen'>) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [isAllDay, setIsAllDay] = useState(initialEvent?.is_all_day || false)
  const [attendeeEmail, setAttendeeEmail] = useState('')
  const [attendeesList, setAttendeesList] = useState<Array<{ email: string; name?: string }>>(() => {
    if (initialEvent && Array.isArray(initialEvent.attendees)) {
      return initialEvent.attendees as Array<{ email: string; name?: string }>
    }
    return []
  })
  const [projectId, setProjectId] = useState<string>(initialEvent?.project_id || '')
  const [taskId, setTaskId] = useState<string>(initialEvent?.task_id || '')
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(initialEvent?.recurrence_rule || null)
  const [reminders, setReminders] = useState<ReminderRuleInput[]>([
    { offset_minutes: 10, is_relative_to_start: true, channel: 'in_app', is_active: true },
  ])
  const [syncWithGoogle, setSyncWithGoogle] = useState<boolean | null>(initialEvent?.sync_with_google ?? null)

  const isEditing = !!initialEvent

  const handleAddAttendee = () => {
    const trimmed = attendeeEmail.trim()
    if (!trimmed) return
    if (!trimmed.includes('@')) {
      setError('Please provide a valid email address for the attendee')
      return
    }
    if (attendeesList.some((a) => a.email.toLowerCase() === trimmed.toLowerCase())) {
      setError('Attendee email already added')
      return
    }

    setAttendeesList([...attendeesList, { email: trimmed }])
    setAttendeeEmail('')
    setError(null)
  }

  const handleRemoveAttendee = (email: string) => {
    setAttendeesList(attendeesList.filter((a) => a.email !== email))
  }

  // Format default start/end for datetime-local input (YYYY-MM-DDTHH:mm)
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

    const title = formData.get('title') as string
    const description = (formData.get('description') as string) || null
    const event_type = (formData.get('event_type') as CalendarEventType) || 'meeting'
    const location = (formData.get('location') as string) || null
    const meeting_url = (formData.get('meeting_url') as string) || null

    const startRaw = formData.get('start_time') as string
    const endRaw = formData.get('end_time') as string

    if (!startRaw || !endRaw) {
      setError('Start time and end time are required.')
      return
    }

    const start_time = new Date(startRaw).toISOString()
    const end_time = new Date(endRaw).toISOString()

    if (new Date(end_time).getTime() <= new Date(start_time).getTime()) {
      setError('End time must be strictly after start time.')
      return
    }

    startTransition(async () => {
      if (isEditing && initialEvent) {
        const payload = {
          id: initialEvent.id,
          title,
          description,
          event_type,
          start_time,
          end_time,
          is_all_day: isAllDay,
          location,
          meeting_url,
          attendees: attendeesList,
          recurrence_rule: recurrenceRule,
          reminders,
          project_id: projectId || null,
          task_id: taskId || null,
          sync_with_google: syncWithGoogle,
        }

        const res = await updateCalendarEventAction(payload)
        if (res.success) {
          toast({
            title: 'Event updated',
            message: `"${title}" has been updated.`,
            type: 'success',
          })
          onClose()
          onSuccess?.()
        } else {
          setError(res.error || 'Failed to update event')
        }
      } else {
        const payload = {
          title,
          description,
          event_type,
          start_time,
          end_time,
          is_all_day: isAllDay,
          location,
          meeting_url,
          attendees: attendeesList,
          recurrence_rule: recurrenceRule,
          reminders,
          project_id: projectId || null,
          task_id: taskId || null,
          sync_with_google: syncWithGoogle,
        }

        const res = await createCalendarEventAction(payload)
        if (res.success) {
          toast({
            title: 'Event scheduled',
            message: `"${title}" has been added to your calendar.`,
            type: 'success',
          })
          onClose()
          onSuccess?.()
        } else {
          setError(res.error || 'Failed to create event')
        }
      }
    })
  }

  const handleDelete = () => {
    if (!initialEvent) return
    if (!confirm(`Are you sure you want to delete event "${initialEvent.title}"?`)) return

    startTransition(async () => {
      const res = await deleteCalendarEventAction(initialEvent.id)
      if (res.success) {
        toast({
          title: 'Event deleted',
          type: 'success',
        })
        onClose()
        onSuccess?.()
      } else {
        setError(res.error || 'Failed to delete event')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
          {error}
        </div>
      )}

      <div>
        <Label htmlFor="event-title">Event Title *</Label>
        <Input
          id="event-title"
          name="title"
          required
          maxLength={200}
          defaultValue={initialEvent?.title || ''}
          placeholder="e.g. Weekly Engineering Sync"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="event-type">Event Type</Label>
          <Select
            id="event-type"
            name="event_type"
            defaultValue={initialEvent?.event_type || 'meeting'}
          >
            <option value="meeting">Meeting</option>
            <option value="appointment">Appointment</option>
            <option value="focus_block">Focus Block</option>
            <option value="reminder_block">Reminder Block</option>
            <option value="external">External</option>
          </Select>
        </div>

        <div className="flex items-center gap-2 pt-6">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="rounded border-white/20 bg-[#141B2D] text-[#8B7CFF] focus:ring-[#8B7CFF]"
            />
            <span>All-Day Event</span>
          </label>
        </div>
      </div>

      {/* Timestamps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5">
        <div>
          <Label htmlFor="event-start">Start Time *</Label>
          <Input
            id="event-start"
            name="start_time"
            type="datetime-local"
            required
            defaultValue={
              initialEvent?.start_time
                ? formatInputDateTime(initialEvent.start_time)
                : formatInputDateTime(defaultStartTime)
            }
          />
        </div>

        <div>
          <Label htmlFor="event-end">End Time *</Label>
          <Input
            id="event-end"
            name="end_time"
            type="datetime-local"
            required
            defaultValue={
              initialEvent?.end_time
                ? formatInputDateTime(initialEvent.end_time)
                : formatInputDateTime(defaultEndTime)
            }
          />
        </div>
      </div>

      {/* Description / Notes / Agenda */}
      <div>
        <Label htmlFor="event-desc">Description &amp; Agenda</Label>
        <Textarea
          id="event-desc"
          name="description"
          rows={2}
          defaultValue={initialEvent?.description || ''}
          placeholder="Meeting agenda, discussion points, or preparation links..."
        />
      </div>

      {/* Location & Meeting URL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="event-loc">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span>Location</span>
            </span>
          </Label>
          <Input
            id="event-loc"
            name="location"
            defaultValue={initialEvent?.location || ''}
            placeholder="e.g. Conference Room B / Remote"
          />
        </div>

        <div>
          <Label htmlFor="event-url">
            <span className="flex items-center gap-1.5">
              <Video className="w-3 h-3 text-[#22D3EE]" />
              <span>Meeting Video URL</span>
            </span>
          </Label>
          <Input
            id="event-url"
            name="meeting_url"
            type="url"
            defaultValue={initialEvent?.meeting_url || ''}
            placeholder="https://meet.google.com/abc-defg-hij"
          />
        </div>
      </div>

      {/* Attendees */}
      <div>
        <Label>
          <span className="flex items-center gap-1.5">
            <Users className="w-3 h-3 text-[#8B7CFF]" />
            <span>Attendees / Participants</span>
          </span>
        </Label>
        <div className="flex items-center gap-2 mt-1">
          <Input
            value={attendeeEmail}
            onChange={(e) => setAttendeeEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddAttendee()
              }
            }}
          />
          <Button type="button" variant="secondary" size="sm" onClick={handleAddAttendee}>
            Add
          </Button>
        </div>

        {attendeesList.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2.5">
            {attendeesList.map((att) => (
              <span
                key={att.email}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 text-[#9E91FF]"
              >
                <span>{att.email}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttendee(att.email)}
                  className="text-slate-400 hover:text-white"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Linked Project & Task */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
        <div>
          <Label htmlFor="event-project">Linked Project (Optional)</Label>
          <Select
            id="event-project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">No Project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="event-task">Linked Task (Optional)</Label>
          <Select
            id="event-task"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
          >
            <option value="">No Linked Task</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.status})
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Recurrence Editor */}
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
        <RecurrenceEditor
          value={recurrenceRule}
          onChange={setRecurrenceRule}
        />
      </div>

      {/* Reminder Editor */}
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
        <ReminderEditor
          reminders={reminders}
          onChange={setReminders}
          hasScheduledStart={true}
          itemType="event"
        />
      </div>

      {/* Google Calendar Sync Preference */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
        <div>
          <label className="text-xs font-medium text-slate-200">Sync with Google Calendar</label>
          <p className="text-[11px] text-slate-400">
            {syncWithGoogle === null
              ? 'Default (follows account settings)'
              : syncWithGoogle
              ? 'Always sync this event to Google Calendar'
              : 'Do not sync this event to Google Calendar'}
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

      {/* Buttons / Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        {isEditing ? (
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={handleDelete}
            isLoading={isPending}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Event</span>
          </Button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isPending}>
            {isEditing ? 'Save Changes' : 'Create Event'}
          </Button>
        </div>
      </div>
    </form>
  )
}

export function EventModal(props: EventModalProps) {
  if (!props.isOpen) return null

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title={props.initialEvent ? 'Edit Calendar Event' : 'Schedule New Event'}
      description="Create meetings, appointments, focus blocks, and link projects or tasks"
      maxWidth="lg"
    >
      <EventModalForm key={props.initialEvent?.id || 'new-event'} {...props} />
    </Modal>
  )
}

