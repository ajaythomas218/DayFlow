'use client'

import React, { useMemo } from 'react'
import { CalendarEventWithDetails } from '@/lib/actions/calendar'
import { Task } from '@/types'
import {
  getWeekRange,
  getLocalDateString,
  getMinutesFromStartOfDay,
  formatTimeInTimezone,
  getLocalParts,
} from '@/lib/timezone'
import {
  Video,
  CheckCircle2,
  Circle,
  Flag,
} from 'lucide-react'

interface WeekViewProps {
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

export function WeekView({
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
}: WeekViewProps) {
  // Get 7 days for current week in user timezone
  const weekInfo = useMemo(() => {
    return getWeekRange(currentDate, userTimezone, 0)
  }, [currentDate, userTimezone])

  const todayString = getLocalDateString(userTimezone, new Date())

  const getEventBadgeClass = (type: string) => {
    switch (type) {
      case 'meeting':
        return 'bg-[#8B7CFF]/20 border-[#8B7CFF]/50 text-[#9E91FF]'
      case 'appointment':
        return 'bg-[#22D3EE]/20 border-[#22D3EE]/50 text-[#38BDF8]'
      case 'focus_block':
        return 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
      case 'reminder_block':
        return 'bg-amber-500/20 border-amber-500/50 text-amber-300'
      default:
        return 'bg-slate-700/50 border-slate-600 text-slate-200'
    }
  }

  const handleCellClick = (dayDate: Date, hour: number) => {
    const parts = getLocalParts(userTimezone, dayDate)
    const slotStart = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour, 0, 0))
    const slotEnd = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour + 1, 0, 0))
    onSelectTimeSlot(slotStart.toISOString(), slotEnd.toISOString())
  }

  return (
    <div className="flex flex-col rounded-2xl bg-[#141B2D] border border-white/10 overflow-hidden shadow-2xl">
      {/* Week Header Row */}
      <div className="grid grid-cols-8 border-b border-white/10 bg-[#101522]/90 sticky top-0 z-30">
        {/* Time gutter header */}
        <div className="p-3 border-r border-white/5 text-[11px] font-mono text-slate-500 text-center">
          Time
        </div>

        {/* 7 Day Headers */}
        {weekInfo.days.map((dayDate) => {
          const dayString = getLocalDateString(userTimezone, dayDate)
          const isToday = dayString === todayString
          const dayName = new Intl.DateTimeFormat('en-US', {
            timeZone: userTimezone,
            weekday: 'short',
          }).format(dayDate)
          const dayNum = new Intl.DateTimeFormat('en-US', {
            timeZone: userTimezone,
            day: 'numeric',
          }).format(dayDate)

          return (
            <div
              key={dayString}
              className={`p-2.5 text-center border-r border-white/5 last:border-r-0 transition-colors ${
                isToday ? 'bg-[#8B7CFF]/10' : ''
              }`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                {dayName}
              </span>
              <span
                className={`inline-block mt-0.5 text-sm font-bold font-mono px-2 py-0.5 rounded-full ${
                  isToday
                    ? 'bg-[#8B7CFF] text-white shadow-md shadow-[#8B7CFF]/30'
                    : 'text-white'
                }`}
              >
                {dayNum}
              </span>
            </div>
          )
        })}
      </div>

      {/* Hourly Grid with 7 Columns */}
      <div className="relative overflow-y-auto max-h-[750px]">
        <div className="grid grid-cols-8 relative min-h-[1440px]">
          {/* Time Labels Column */}
          <div className="border-r border-white/5">
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
                  className="h-[60px] pr-2 text-right text-[10px] font-mono text-slate-500 border-b border-white/5 pt-0.5 select-none"
                >
                  {displayHour}
                </div>
              )
            })}
          </div>

          {/* 7 Day Columns */}
          {weekInfo.days.map((dayDate) => {
            const dayString = getLocalDateString(userTimezone, dayDate)
            const isToday = dayString === todayString

            // Filter items for this column
            const dayEvents = events.filter((e) => {
              const eDay = getLocalDateString(userTimezone, new Date(e.start_time))
              return eDay === dayString && !e.is_all_day
            })

            const dayTasks = showTasks
              ? scheduledTasks.filter((t) => {
                  if (!t.scheduled_start_at) return false
                  if (!showCompletedTasks && t.status === 'completed') return false
                  return (
                    getLocalDateString(userTimezone, new Date(t.scheduled_start_at)) ===
                    dayString
                  )
                })
              : []

            const dayDeadlines = showTasks
              ? deadlineTasks.filter((t) => {
                  if (!t.deadline_at) return false
                  if (!showCompletedTasks && t.status === 'completed') return false
                  return (
                    getLocalDateString(userTimezone, new Date(t.deadline_at)) === dayString
                  )
                })
              : []

            return (
              <div
                key={dayString}
                className={`relative border-r border-white/5 last:border-r-0 ${
                  isToday ? 'bg-[#8B7CFF]/[0.02]' : ''
                }`}
              >
                {/* 24 hour click slots */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    onClick={() => handleCellClick(dayDate, hour)}
                    className="h-[60px] border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer"
                  />
                ))}

                {/* Timed Events Rendered Absolute */}
                {dayEvents.map((event) => {
                  const startMinutes = getMinutesFromStartOfDay(event.start_time, userTimezone)
                  const endMinutes = getMinutesFromStartOfDay(event.end_time, userTimezone)
                  const duration = Math.max(25, endMinutes - startMinutes)

                  const topPercent = (startMinutes / 1440) * 100
                  const heightPercent = (duration / 1440) * 100

                  return (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectEvent(event)
                      }}
                      className={`absolute left-0.5 right-0.5 rounded-lg p-1.5 border shadow-md backdrop-blur-md cursor-pointer transition-all hover:scale-[1.02] hover:z-20 overflow-hidden ${getEventBadgeClass(
                        event.event_type
                      )}`}
                      style={{
                        top: `${topPercent}%`,
                        height: `${heightPercent}%`,
                        minHeight: '26px',
                      }}
                      title={`${event.title} (${formatTimeInTimezone(
                        event.start_time,
                        userTimezone
                      )} - ${formatTimeInTimezone(event.end_time, userTimezone)})`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-[11px] text-white truncate leading-tight">
                          {event.title}
                        </span>
                        {event.meeting_url && <Video className="w-3 h-3 text-[#22D3EE] shrink-0" />}
                      </div>
                      <p className="text-[9px] font-mono opacity-80 truncate leading-tight">
                        {formatTimeInTimezone(event.start_time, userTimezone)}
                      </p>
                    </div>
                  )
                })}

                {/* Scheduled Task Time Blocks */}
                {dayTasks.map((task) => {
                  if (!task.scheduled_start_at || !task.scheduled_end_at) return null

                  const startMinutes = getMinutesFromStartOfDay(
                    task.scheduled_start_at,
                    userTimezone
                  )
                  const endMinutes = getMinutesFromStartOfDay(
                    task.scheduled_end_at,
                    userTimezone
                  )
                  const duration = Math.max(25, endMinutes - startMinutes)

                  const topPercent = (startMinutes / 1440) * 100
                  const heightPercent = (duration / 1440) * 100
                  const isDone = task.status === 'completed'

                  return (
                    <div
                      key={task.id}
                      className={`absolute left-1 right-1 rounded-lg p-1.5 border shadow-sm backdrop-blur-md transition-all z-10 ${
                        isDone
                          ? 'bg-[#182238]/60 border-white/5 opacity-60'
                          : 'bg-[#182238]/95 border-[#8B7CFF]/50 hover:border-[#8B7CFF]'
                      }`}
                      style={{
                        top: `${topPercent}%`,
                        height: `${heightPercent}%`,
                        minHeight: '28px',
                      }}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleTask(task.id)
                          }}
                          className="text-slate-400 hover:text-emerald-400 shrink-0"
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Circle className="w-3 h-3" />
                          )}
                        </button>
                        <span
                          className={`text-[10px] font-medium truncate ${
                            isDone ? 'line-through text-slate-500' : 'text-white'
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>
                    </div>
                  )
                })}

                {/* Deadlines Indicators */}
                {dayDeadlines.map((task) => {
                  if (!task.deadline_at) return null
                  const deadlineMinutes = getMinutesFromStartOfDay(task.deadline_at, userTimezone)
                  const topPercent = (deadlineMinutes / 1440) * 100

                  return (
                    <div
                      key={`deadline-${task.id}`}
                      className="absolute left-0 right-0 pointer-events-auto flex items-center z-20"
                      style={{ top: `${topPercent}%` }}
                    >
                      <div className="h-[1.5px] bg-rose-500 flex-1 border-t border-dashed border-rose-400" />
                      <div
                        className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px] font-bold flex items-center gap-0.5 shrink-0"
                        title={`Due: ${task.title}`}
                      >
                        <Flag className="w-2.5 h-2.5 text-rose-400" />
                        <span className="truncate max-w-[60px]">{task.title}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

