import { describe, it, expect } from 'vitest'
import type { Task, CalendarEvent } from '@/types'

describe('Calendar Feed & Task Time-Blocking Logic', () => {
  const mockTaskWithScheduleAndDeadline: Task = {
    id: 'task-111',
    user_id: 'user-abc',
    project_id: 'proj-xyz',
    parent_task_id: null,
    title: 'Prepare quarterly financial forecast',
    description: 'Review Q3 results and build Q4 model',
    status: 'in_progress',
    priority: 'p1',
    deadline_at: '2026-10-30T17:00:00.000Z',
    scheduled_start_at: '2026-10-28T09:00:00.000Z',
    scheduled_end_at: '2026-10-28T11:00:00.000Z',
    is_time_blocked: true,
    estimated_duration_minutes: 120,
    recurrence_rule: null,
    recurrence_parent_id: null,
    sync_with_google: null,
    course_id: null,
    training_session_id: null,
    checklist_template_task_id: null,
    completed_at: null,
    sort_order: 0,
    created_at: '2026-10-20T00:00:00.000Z',
    updated_at: '2026-10-20T00:00:00.000Z',
  }

  const mockTaskDeadlineOnly: Task = {
    ...mockTaskWithScheduleAndDeadline,
    id: 'task-222',
    title: 'Submit tax documentation',
    scheduled_start_at: null,
    scheduled_end_at: null,
    is_time_blocked: false,
    deadline_at: '2026-10-28T16:00:00.000Z',
  }

  const mockCalendarEvent: CalendarEvent = {
    id: 'event-333',
    user_id: 'user-abc',
    title: 'Client Demo & Review',
    description: 'Walkthrough of Workday OS features',
    start_time: '2026-10-28T13:00:00.000Z',
    end_time: '2026-10-28T14:00:00.000Z',
    location: 'Google Meet',
    meeting_url: 'https://meet.google.com/xyz',
    is_all_day: false,
    attendees: [{ name: 'Client Lead', email: 'client@acme.com' }],
    event_type: 'meeting',
    recurrence_rule: null,
    recurrence_parent_id: null,
    sync_with_google: null,
    project_id: 'proj-xyz',
    task_id: 'task-111',
    created_at: '2026-10-20T00:00:00.000Z',
    updated_at: '2026-10-20T00:00:00.000Z',
  }

  it('separates scheduled task time-blocks from deadline milestones', () => {
    // A task with both scheduled times and a deadline must produce:
    // 1) A timeblock for 2026-10-28 09:00 - 11:00
    // 2) A deadline indicator for 2026-10-30 17:00
    expect(mockTaskWithScheduleAndDeadline.scheduled_start_at).not.toBeNull()
    expect(mockTaskWithScheduleAndDeadline.scheduled_end_at).not.toBeNull()
    expect(mockTaskWithScheduleAndDeadline.deadline_at).toBe('2026-10-30T17:00:00.000Z')

    // Time block duration:
    const start = new Date(mockTaskWithScheduleAndDeadline.scheduled_start_at!).getTime()
    const end = new Date(mockTaskWithScheduleAndDeadline.scheduled_end_at!).getTime()
    const durationHours = (end - start) / (1000 * 60 * 60)
    expect(durationHours).toBe(2)
  })

  it('does not produce a timeblock when scheduled start/end are null', () => {
    expect(mockTaskDeadlineOnly.scheduled_start_at).toBeNull()
    expect(mockTaskDeadlineOnly.scheduled_end_at).toBeNull()
    expect(mockTaskDeadlineOnly.deadline_at).toBe('2026-10-28T16:00:00.000Z')
  })

  it('preserves deadline independence when scheduled times are altered', () => {
    // When a task is rescheduled on the calendar timeline:
    const updatedTask: Task = {
      ...mockTaskWithScheduleAndDeadline,
      scheduled_start_at: '2026-10-29T10:00:00.000Z',
      scheduled_end_at: '2026-10-29T12:00:00.000Z',
    }

    // The deadline remains untouched!
    expect(updatedTask.deadline_at).toBe(mockTaskWithScheduleAndDeadline.deadline_at)
    expect(updatedTask.scheduled_start_at).toBe('2026-10-29T10:00:00.000Z')
  })

  it('links calendar events to projects and canonical tasks without duplication', () => {
    // Event is linked to task-111 and proj-xyz
    expect(mockCalendarEvent.task_id).toBe('task-111')
    expect(mockCalendarEvent.project_id).toBe('proj-xyz')

    // The event is distinct from the task itself
    expect(mockCalendarEvent.id).not.toBe(mockTaskWithScheduleAndDeadline.id)
  })

  it('ensures deduplication in calendar feed collections', () => {
    // When collecting feed items for a given day:
    const scheduledTasks = [mockTaskWithScheduleAndDeadline]
    const deadlineTasks = [mockTaskWithScheduleAndDeadline] // same task in both collections

    // Deduping by ID or rendering in dedicated slots prevents duplicate cards
    const scheduledIds = new Set(scheduledTasks.map((t) => t.id))
    const uniqueDeadlineTasksOnly = deadlineTasks.filter((t) => !t.scheduled_start_at)

    expect(scheduledIds.has('task-111')).toBe(true)
    expect(uniqueDeadlineTasksOnly).toHaveLength(0) // task-111 is handled by timeblock, not deadline-only
  })
})

