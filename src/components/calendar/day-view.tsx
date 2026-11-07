'use client'

import React, { useMemo } from 'react'
import {
  CalendarEventWithDetails,
} from '@/lib/actions/calendar'
import { Task } from '@/types'
import {
  getMinutesFromStartOfDay,
  formatTimeInTimezone,
  getLocalDateString,
  getLocalParts,
} from '@/lib/timezone'
import {
  Video,
  MapPin,
  Users,
  CheckCircle2,
  Circle,
  Flag,
  Plus,
} from 'lucide-react'

interface DayViewProps {
  currentDate: Date
  userTimezone: string
  events: CalendarEventWithDetails[]
  scheduledTasks: Array<Task & { project?: { id: string; title: string; color_hex: string } | null }>
  deadlineTasks: Array<Task & { project?: { id: string; title: string; color_hex: string } | null }>
  showTasks: boolean
  showCompletedTasks: boolean
  onSelectEvent: (event: CalendarEventWithDetails) => void
  onSelectTimeSlot: (startIso: string, endIso: string) => void
  onToggleTask: (taskId: string) => void
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function DayView({
  currentDate,
  userTimezone,
  events,
  scheduledTasks,
  deadlineTasks,
  showTasks,
  showCompletedTasks,
  onSelectEvent,
  onSelectTimeSlot,
  onToggleTask,
}: DayViewProps) {
  const currentDayString = getLocalDateString(userTimezone, currentDate)

  // Filter events and tasks for this local calendar day
  const dayEvents = useMemo(() => {
    return events.filter((e) => {
      const eventDay = getLocalDateString(userTimezone, new Date(e.start_time))
      return eventDay === currentDayString
    })
  }, [events, currentDayString, userTimezone])

  const allDayEvents = useMemo(() => {
    return dayEvents.filter((e) => e.is_all_day)
  }, [dayEvents])

  const timedEvents = useMemo(() => {
    return dayEvents.filter((e) => !e.is_all_day)
  }, [dayEvents])

  const dayScheduledTasks = useMemo(() => {
    if (!showTasks) return []
    return scheduledTasks.filter((t) => {
      if (!t.scheduled_start_at) return false
      if (!showCompletedTasks && t.status === 'completed') return false
      return getLocalDateString(userTimezone, new Date(t.scheduled_start_at)) === currentDayString
    })
  }, [scheduledTasks, showTasks, showCompletedTasks, currentDayString, userTimezone])

  const dayDeadlineTasks = useMemo(() => {
    if (!showTasks) return []
    return deadlineTasks.filter((t) => {
      if (!t.deadline_at) return false
      if (!showCompletedTasks && t.status === 'completed') return false
      return getLocalDateString(userTimezone, new Date(t.deadline_at)) === currentDayString
    })
  }, [deadlineTasks, showTasks, showCompletedTasks, currentDayString, userTimezone])

  const getEventBadgeClass = (type: string) => {
    switch (type) {
      case 'meeting':
        return 'bg-[#8B7CFF]/20 border-[#8B7CFF]/40 text-[#9E91FF]'
      case 'appointment':
        return 'bg-[#22D3EE]/20 border-[#22D3EE]/40 text-[#38BDF8]'
      case 'focus_block':
        return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
      case 'reminder_block':
        return 'bg-amber-500/20 border-amber-500/40 text-amber-300'
      default:
        return 'bg-slate-700/50 border-slate-600 text-slate-200'
    }
  }

  const handleSlotClick = (hour: number) => {
    const parts = getLocalParts(userTimezone, currentDate)
    const slotStart = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour, 0, 0))
    const slotEnd = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour + 1, 0, 0))
    onSelectTimeSlot(slotStart.toISOString(), slotEnd.toISOString())
  }

  return (
    <div className="flex flex-col rounded-2xl bg-[#141B2D] border border-white/10 overflow-hidden shadow-2xl">
      {/* All-Day Events Banner */}
      {allDayEvents.length > 0 && (
        <div className="p-3 bg-white/[0.02] border-b border-white/10 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1">
            All-Day:
          </span>
          {allDayEvents.map((e) => (
            <button
              key={e.id}
              onClick={() => onSelectEvent(e)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 text-white hover:bg-[#8B7CFF]/25 transition-colors flex items-center gap-1.5"
            >
              <span>{e.title}</span>
              {e.meeting_url && <Video className="w-3 h-3 text-[#22D3EE]" />}
            </button>
          ))}
        </div>
      )}

      {/* Hourly Grid Timeline */}
      <div className="relative min-h-[960px] overflow-y-auto">
        {/* Hour Slot Rows */}
        {HOURS.map((hour) => {
          const displayHour =
            hour === 0
              ? '12 AM'
              : hour < 12
              ? `${hour} AM`
              : hour === 12
              ? '12 PM'
              : `${hour - 12} PM`

          return (
            <div
              key={hour}
              onClick={() => handleSlotClick(hour)}
              className="group relative flex items-start border-b border-white/5 h-16 hover:bg-white/[0.02] transition-colors cursor-pointer"
            >
              <div className="w-16 sm:w-20 pr-3 text-right text-[11px] font-mono text-slate-500 pt-1 select-none shrink-0">
                {displayHour}
              </div>
              <div className="flex-1 h-full border-l border-white/5 relative">
                {/* Plus hint on hover */}
                <div className="hidden group-hover:flex items-center gap-1 text-[10px] text-slate-500 pl-3 pt-1">
                  <Plus className="w-3 h-3" />
                  <span>Schedule at {displayHour}</span>
                </div>
              </div>
            </div>
          )
        })}

        {/* Timed Events Rendered Over the Grid */}
        <div className="absolute inset-y-0 left-16 sm:left-20 right-2 pointer-events-none">
          {/* Calendar Events */}
          {timedEvents.map((event) => {
            const startMinutes = getMinutesFromStartOfDay(event.start_time, userTimezone)
            const endMinutes = getMinutesFromStartOfDay(event.end_time, userTimezone)
            const duration = Math.max(30, endMinutes - startMinutes)

            const topPercent = (startMinutes / 1440) * 100
            const heightPercent = (duration / 1440) * 100

            return (
              <div
                key={event.id}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectEvent(event)
                }}
                className={`absolute left-1 right-2 rounded-xl p-2.5 border shadow-lg backdrop-blur-md cursor-pointer transition-all hover:scale-[1.01] hover:z-20 pointer-events-auto ${getEventBadgeClass(
                  event.event_type
                )}`}
                style={{
                  top: `${topPercent}%`,
                  height: `${heightPercent}%`,
                  minHeight: '36px',
                }}
              >
                <div className="flex items-start justify-between gap-2 overflow-hidden">
                  <div className="truncate min-w-0">
                    <p className="font-semibold text-xs text-white truncate">{event.title}</p>
                    <p className="text-[10px] font-mono opacity-80 mt-0.5 truncate">
                      {formatTimeInTimezone(event.start_time, userTimezone)} –{' '}
                      {formatTimeInTimezone(event.end_time, userTimezone)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {event.meeting_url && <Video className="w-3.5 h-3.5 text-[#22D3EE]" />}
                    {event.location && <MapPin className="w-3 h-3 text-slate-400" />}
                    {Array.isArray(event.attendees) && event.attendees.length > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] opacity-80">
                        <Users className="w-3 h-3" />
                        <span>{event.attendees.length}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Scheduled Task Time Blocks */}
          {dayScheduledTasks.map((task) => {
            if (!task.scheduled_start_at || !task.scheduled_end_at) return null

            const startMinutes = getMinutesFromStartOfDay(task.scheduled_start_at, userTimezone)
            const endMinutes = getMinutesFromStartOfDay(task.scheduled_end_at, userTimezone)
            const duration = Math.max(30, endMinutes - startMinutes)

            const topPercent = (startMinutes / 1440) * 100
            const heightPercent = (duration / 1440) * 100
            const isDone = task.status === 'completed'

            return (
              <div
                key={task.id}
                className={`absolute left-2 right-4 rounded-xl p-2.5 border shadow-md backdrop-blur-md transition-all pointer-events-auto ${
                  isDone
                    ? 'bg-[#182238]/60 border-white/5 opacity-60'
                    : 'bg-[#182238]/95 border-[#8B7CFF]/50 hover:border-[#8B7CFF] shadow-[#8B7CFF]/10'
                }`}
                style={{
                  top: `${topPercent}%`,
                  height: `${heightPercent}%`,
                  minHeight: '38px',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleTask(task.id)
                      }}
                      className="text-slate-400 hover:text-emerald-400 shrink-0"
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </button>
                    <span
                      className={`text-xs font-semibold truncate ${
                        isDone ? 'line-through text-slate-500' : 'text-white'
                      }`}
                    >
                      {task.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {task.project && (
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-white/10"
                        style={{
                          backgroundColor: `${task.project.color_hex}20`,
                          color: task.project.color_hex,
                        }}
                      >
                        {task.project.title}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-[#8B7CFF]">
                      {formatTimeInTimezone(task.scheduled_start_at, userTimezone)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Deadline Indicators (Flag lines on the timeline) */}
          {dayDeadlineTasks.map((task) => {
            if (!task.deadline_at) return null
            const deadlineMinutes = getMinutesFromStartOfDay(task.deadline_at, userTimezone)
            const topPercent = (deadlineMinutes / 1440) * 100

            return (
              <div
                key={`deadline-${task.id}`}
                className="absolute left-0 right-0 pointer-events-auto flex items-center z-30"
                style={{ top: `${topPercent}%` }}
              >
                <div className="h-[2px] bg-rose-500 flex-1 border-t border-dashed border-rose-400" />
                <div className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 text-[10px] font-bold flex items-center gap-1 shrink-0 ml-2 shadow-sm">
                  <Flag className="w-3 h-3 text-rose-400" />
                  <span>Due: {task.title}</span>
                  <span className="font-mono opacity-80">
                    ({formatTimeInTimezone(task.deadline_at, userTimezone)})
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
