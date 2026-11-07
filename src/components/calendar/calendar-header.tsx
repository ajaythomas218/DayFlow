'use client'

import React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Clock,
  Filter,
  CheckSquare,
  Globe,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/ui/dropdown'
import { getLocalDateString } from '@/lib/timezone'

export type CalendarViewMode = 'day' | 'week' | 'month'

export interface CalendarFilters {
  eventType: string // 'all' or specific type
  showTasks: boolean
  showCompletedTasks: boolean
}

interface CalendarHeaderProps {
  currentDate: Date
  viewMode: CalendarViewMode
  userTimezone: string
  filters: CalendarFilters
  onViewModeChange: (mode: CalendarViewMode) => void
  onNavigatePrev: () => void
  onNavigateNext: () => void
  onNavigateToday: () => void
  onFiltersChange: (filters: CalendarFilters) => void
  onOpenCreateEvent: () => void
  onOpenScheduleTask: () => void
  onTriggerSync?: () => void
  isSyncing?: boolean
}

export function CalendarHeader({
  currentDate,
  viewMode,
  userTimezone,
  filters,
  onViewModeChange,
  onNavigatePrev,
  onNavigateNext,
  onNavigateToday,
  onFiltersChange,
  onOpenCreateEvent,
  onOpenScheduleTask,
  onTriggerSync,
  isSyncing = false,
}: CalendarHeaderProps) {
  // Format title based on viewMode and userTimezone
  const getHeaderTitle = () => {
    try {
      if (viewMode === 'month') {
        return new Intl.DateTimeFormat('en-US', {
          timeZone: userTimezone,
          month: 'long',
          year: 'numeric',
        }).format(currentDate)
      }

      if (viewMode === 'day') {
        return new Intl.DateTimeFormat('en-US', {
          timeZone: userTimezone,
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }).format(currentDate)
      }

      // Week view: format week range
      const dayOfWeek = currentDate.getDay()
      const weekStart = new Date(currentDate.getTime() - dayOfWeek * 86400000)
      const weekEnd = new Date(weekStart.getTime() + 6 * 86400000)

      const startMonth = new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        month: 'short',
        day: 'numeric',
      }).format(weekStart)

      const endMonth = new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(weekEnd)

      return `${startMonth} – ${endMonth}`
    } catch {
      return currentDate.toDateString()
    }
  }

  const isToday = getLocalDateString(userTimezone, currentDate) === getLocalDateString(userTimezone, new Date())

  return (
    <div className="flex flex-col gap-4 pb-4 border-b border-white/10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Title & Date Navigation */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-2 rounded-xl bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 text-[#8B7CFF]">
            <CalendarIcon className="w-5 h-5" />
          </div>

          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight min-w-[200px]">
              {getHeaderTitle()}
            </h1>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-1 bg-[#141B2D] p-1 rounded-xl border border-white/10">
            <button
              onClick={onNavigatePrev}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Previous period"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={onNavigateToday}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                isToday
                  ? 'bg-[#8B7CFF]/20 text-[#8B7CFF] border border-[#8B7CFF]/40'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Today
            </button>
            <button
              onClick={onNavigateNext}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Next period"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Timezone Indicator */}
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-slate-400">
            <Globe className="w-3 h-3 text-[#22D3EE]" />
            <span>{userTimezone}</span>
          </div>
        </div>

        {/* Right: View Mode Switcher, Filters & Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Segmented Pill */}
          <div className="flex items-center bg-[#141B2D] p-1 rounded-xl border border-white/10 text-xs">
            {(['day', 'week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onViewModeChange(mode)}
                className={`px-3 py-1.5 rounded-lg font-medium capitalize transition-all ${
                  viewMode === mode
                    ? 'bg-[#8B7CFF] text-white shadow-md shadow-[#8B7CFF]/20 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Filter Dropdown */}
          <Dropdown
            align="right"
            trigger={
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#141B2D] border border-white/10 text-xs text-slate-300 hover:text-white hover:border-white/20 transition-all">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Filters</span>
              </button>
            }
            items={[
              {
                label: filters.showTasks ? '✓ Show Tasks' : 'Hide Tasks',
                icon: <CheckSquare className="w-3.5 h-3.5 text-[#8B7CFF]" />,
                onClick: () =>
                  onFiltersChange({ ...filters, showTasks: !filters.showTasks }),
              },
              {
                label: filters.showCompletedTasks
                  ? '✓ Show Completed Tasks'
                  : 'Hide Completed Tasks',
                icon: <Clock className="w-3.5 h-3.5 text-emerald-400" />,
                onClick: () =>
                  onFiltersChange({
                    ...filters,
                    showCompletedTasks: !filters.showCompletedTasks,
                  }),
              },
            ]}
          />

          {onTriggerSync && (
            <Button
              onClick={onTriggerSync}
              variant="outline"
              size="sm"
              disabled={isSyncing}
              title="Sync with Google Calendar"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#22D3EE] ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </Button>
          )}

          <Button onClick={onOpenScheduleTask} variant="secondary" size="sm">
            <Clock className="w-3.5 h-3.5 text-[#22D3EE]" />
            <span className="hidden sm:inline">Time-Block Task</span>
          </Button>

          <Button onClick={onOpenCreateEvent} variant="primary" size="sm">
            <Plus className="w-4 h-4" />
            <span>New Event</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

