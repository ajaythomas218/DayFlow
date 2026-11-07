'use client'

import React, { useMemo } from 'react'
import { CalendarEventWithDetails } from '@/lib/actions/calendar'
import { Task } from '@/types'
import {
  getMonthRange,
  getLocalDateString,
  formatTimeInTimezone,
  getLocalParts,
} from '@/lib/timezone'
import {
  Video,
  CheckCircle2,
  Circle,
  Flag,
} from 'lucide-react'

interface MonthViewProps {
  currentDate: Date
  userTimezone: string
  events: CalendarEventWithDetails[]
  scheduledTasks: Array<Task & { project?: { id: string; title: string; color_hex: string } | null }>
  deadlineTasks: Array<Task & { project?: { id: string; title: string; color_hex: string } | null }>
  showTasks: boolean
  showCompletedTasks: boolean
  onSelectEvent: (event: CalendarEventWithDetails) => void
  onSelectDay: (dayDate: Date) => void
  onToggleTask: (taskId: string) => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function MonthView({
  currentDate,
  userTimezone,
  events,
  scheduledTasks,
  deadlineTasks,
  showTasks,
  showCompletedTasks,
  onSelectEvent,
  onSelectDay,
  onToggleTask,
}: MonthViewProps) {
  const monthInfo = useMemo(() => {
    return getMonthRange(currentDate, userTimezone, 0)
  }, [currentDate, userTimezone])

  const todayString = getLocalDateString(userTimezone, new Date())

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
        return 'bg-slate-700/50 border-slate-600 text-slate-300'
    }
  }

  return (
    <div className="flex flex-col rounded-2xl bg-[#141B2D] border border-white/10 overflow-hidden shadow-2xl">
      {/* Weekday Names Header */}
      <div className="grid grid-cols-7 border-b border-white/10 bg-[#101522]/90">
        {WEEKDAYS.map((dayName) => (
          <div
            key={dayName}
            className="p-3 text-center border-r border-white/5 last:border-r-0 text-xs font-semibold uppercase tracking-wider text-slate-400"
          >
            {dayName}
          </div>
        ))}
      </div>

      {/* 42 Day Cells Grid */}
      <div className="grid grid-cols-7 auto-rows-fr">
        {monthInfo.days.map((dayDate, idx) => {
          const dayString = getLocalDateString(userTimezone, dayDate)
          const isToday = dayString === todayString

          const dayParts = getLocalParts(userTimezone, dayDate)
          const isCurrentMonth = dayParts.month === monthInfo.currentMonth

          // Filter events for this cell
          const cellEvents = events.filter((e) => {
            return getLocalDateString(userTimezone, new Date(e.start_time)) === dayString
          })

          // Filter scheduled tasks
          const cellTasks = showTasks
            ? scheduledTasks.filter((t) => {
                if (!t.scheduled_start_at) return false
                if (!showCompletedTasks && t.status === 'completed') return false
                return (
                  getLocalDateString(userTimezone, new Date(t.scheduled_start_at)) ===
                  dayString
                )
              })
            : []

          // Filter deadlines
          const cellDeadlines = showTasks
            ? deadlineTasks.filter((t) => {
                if (!t.deadline_at) return false
                if (!showCompletedTasks && t.status === 'completed') return false
                return (
                  getLocalDateString(userTimezone, new Date(t.deadline_at)) === dayString
                )
              })
            : []

          const totalItems = cellEvents.length + cellTasks.length + cellDeadlines.length
          const maxVisible = 3

          return (
            <div
              key={idx}
              onClick={() => onSelectDay(dayDate)}
              className={`min-h-[110px] p-2 border-b border-r border-white/5 flex flex-col justify-between transition-colors hover:bg-white/[0.02] cursor-pointer ${
                !isCurrentMonth ? 'opacity-35 bg-black/10' : ''
              } ${isToday ? 'bg-[#8B7CFF]/[0.04]' : ''}`}
            >
              {/* Day Number Header */}
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${
                    isToday
                      ? 'bg-[#8B7CFF] text-white shadow-md shadow-[#8B7CFF]/30'
                      : 'text-slate-300'
                  }`}
                >
                  {dayParts.day}
                </span>

                {totalItems > maxVisible && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    +{totalItems - maxVisible} more
                  </span>
                )}
              </div>

              {/* Day Items List */}
              <div className="space-y-1 flex-1 overflow-hidden">
                {/* Events */}
                {cellEvents.slice(0, 2).map((event) => (
                  <button
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectEvent(event)
                    }}
                    className={`w-full text-left px-1.5 py-0.5 rounded border text-[10px] font-medium truncate flex items-center justify-between gap-1 transition-transform hover:scale-[1.02] ${getEventBadgeClass(
                      event.event_type
                    )}`}
                  >
                    <span className="truncate">{event.title}</span>
                    {event.meeting_url ? (
                      <Video className="w-2.5 h-2.5 text-[#22D3EE] shrink-0" />
                    ) : (
                      <span className="text-[9px] font-mono opacity-70 shrink-0">
                        {formatTimeInTimezone(event.start_time, userTimezone)}
                      </span>
                    )}
                  </button>
                ))}

                {/* Scheduled Tasks */}
                {cellTasks.slice(0, 1).map((task) => {
                  const isDone = task.status === 'completed'
                  return (
                    <div
                      key={task.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleTask(task.id)
                      }}
                      className={`px-1.5 py-0.5 rounded border text-[10px] font-medium truncate flex items-center gap-1 ${
                        isDone
                          ? 'bg-[#182238]/60 border-white/5 line-through text-slate-500'
                          : 'bg-[#182238] border-[#8B7CFF]/40 text-slate-200 hover:border-[#8B7CFF]'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Circle className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                      )}
                      <span className="truncate">{task.title}</span>
                    </div>
                  )
                })}

                {/* Deadlines */}
                {cellDeadlines.slice(0, 1).map((task) => (
                  <div
                    key={`dl-${task.id}`}
                    className="px-1.5 py-0.2 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[9px] font-semibold truncate flex items-center gap-1"
                  >
                    <Flag className="w-2.5 h-2.5 text-rose-400 shrink-0" />
                    <span className="truncate">Due: {task.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

