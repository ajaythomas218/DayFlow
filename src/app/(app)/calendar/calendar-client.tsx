'use client'

import React, { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarHeader,
  CalendarViewMode,
  CalendarFilters,
} from '@/components/calendar/calendar-header'
import { DayView } from '@/components/calendar/day-view'
import { WeekView } from '@/components/calendar/week-view'
import { MonthView } from '@/components/calendar/month-view'
import { EventModal } from '@/components/calendar/event-modal'
import { ScheduleTaskModal } from '@/components/calendar/schedule-task-modal'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import {
  getCalendarFeedAction,
  CalendarEventWithDetails,
  CalendarFeed,
} from '@/lib/actions/calendar'
import { triggerGoogleCalendarSyncAction } from '@/lib/actions/google-calendar'
import { toggleTaskCompletionAction } from '@/lib/actions/tasks'
import {
  getDayRange,
  getWeekRange,
  getMonthRange,
  getLocalParts,
  localPartsToUtc,
} from '@/lib/timezone'
import { Project, Task } from '@/types'
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react'

interface CalendarClientProps {
  initialFeed: CalendarFeed
  userTimezone: string
  projects: Project[]
  tasks: Task[]
}

export function CalendarClient({
  initialFeed,
  userTimezone,
  projects,
  tasks,
}: CalendarClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [currentDate, setCurrentDate] = useState<Date>(() => new Date())
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week')
  const [filters, setFilters] = useState<CalendarFilters>({
    eventType: 'all',
    showTasks: true,
    showCompletedTasks: false,
  })

  const [feed, setFeed] = useState<CalendarFeed>(initialFeed)
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventWithDetails | null>(null)
  const [isScheduleTaskModalOpen, setIsScheduleTaskModalOpen] = useState(false)
  const [slotStart, setSlotStart] = useState<string | null>(null)
  const [slotEnd, setSlotEnd] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  // Fetch feed for the active view date window
  const loadFeed = useCallback(
    (targetDate: Date, targetView: CalendarViewMode) => {
      let range: { startIso: string; endIso: string }
      if (targetView === 'day') {
        range = getDayRange(targetDate, userTimezone)
      } else if (targetView === 'week') {
        range = getWeekRange(targetDate, userTimezone, 0)
      } else {
        range = getMonthRange(targetDate, userTimezone, 0)
      }

      startTransition(async () => {
        const res = await getCalendarFeedAction(range.startIso, range.endIso)
        if (res.success && res.data) {
          setFeed(res.data)
        }
      })
    },
    [userTimezone]
  )

  // Navigate periods
  const handleNavigatePrev = () => {
    const parts = getLocalParts(userTimezone, currentDate)
    let newDate: Date

    if (viewMode === 'day') {
      newDate = localPartsToUtc({ ...parts, day: parts.day - 1 }, userTimezone)
    } else if (viewMode === 'week') {
      newDate = localPartsToUtc({ ...parts, day: parts.day - 7 }, userTimezone)
    } else {
      newDate = localPartsToUtc({ ...parts, month: parts.month - 1 }, userTimezone)
    }

    setCurrentDate(newDate)
    loadFeed(newDate, viewMode)
  }

  const handleNavigateNext = () => {
    const parts = getLocalParts(userTimezone, currentDate)
    let newDate: Date

    if (viewMode === 'day') {
      newDate = localPartsToUtc({ ...parts, day: parts.day + 1 }, userTimezone)
    } else if (viewMode === 'week') {
      newDate = localPartsToUtc({ ...parts, day: parts.day + 7 }, userTimezone)
    } else {
      newDate = localPartsToUtc({ ...parts, month: parts.month + 1 }, userTimezone)
    }

    setCurrentDate(newDate)
    loadFeed(newDate, viewMode)
  }

  const handleNavigateToday = () => {
    const today = new Date()
    setCurrentDate(today)
    loadFeed(today, viewMode)
  }

  const handleViewModeChange = (mode: CalendarViewMode) => {
    setViewMode(mode)
    loadFeed(currentDate, mode)
  }

  const handleToggleTask = async (taskId: string) => {
    // Optimistic toggle in local feed
    setFeed((prev) => ({
      ...prev,
      scheduledTasks: prev.scheduledTasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: t.status === 'completed' ? 'todo' : 'completed',
              completed_at: t.status === 'completed' ? null : new Date().toISOString(),
            }
          : t
      ),
      deadlineTasks: prev.deadlineTasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: t.status === 'completed' ? 'todo' : 'completed',
              completed_at: t.status === 'completed' ? null : new Date().toISOString(),
            }
          : t
      ),
    }))

    const res = await toggleTaskCompletionAction(taskId)
    if (!res.success) {
      toast({
        title: 'Error',
        message: res.error || 'Failed to toggle task completion',
        type: 'error',
      })
      loadFeed(currentDate, viewMode)
    } else {
      router.refresh()
    }
  }

  const handleSelectTimeSlot = (startIso: string, endIso: string) => {
    setSelectedEvent(null)
    setSlotStart(startIso)
    setSlotEnd(endIso)
    setIsEventModalOpen(true)
  }

  const handleSelectEvent = (event: CalendarEventWithDetails) => {
    setSelectedEvent(event)
    setSlotStart(event.start_time)
    setSlotEnd(event.end_time)
    setIsEventModalOpen(true)
  }

  const handleSelectDayFromMonth = (dayDate: Date) => {
    setCurrentDate(dayDate)
    setViewMode('day')
    loadFeed(dayDate, 'day')
  }

  const handleTriggerSync = async () => {
    setIsSyncing(true)
    try {
      const res = await triggerGoogleCalendarSyncAction()
      if (!res.success) {
        toast({
          title: 'Google Calendar Sync',
          message: res.error || 'Sync failed',
          type: 'error',
        })
      } else {
        toast({
          title: 'Google Calendar Synced',
          message: `Pushed ${res.data?.pushedCount ?? 0} item(s), pulled ${res.data?.pulledCount ?? 0} item(s).`,
          type: 'success',
        })
        loadFeed(currentDate, viewMode)
      }
    } catch {
      toast({
        title: 'Sync Failed',
        message: 'An unexpected error occurred during sync.',
        type: 'error',
      })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Calendar Header with Navigation and Filters */}
      <CalendarHeader
        currentDate={currentDate}
        viewMode={viewMode}
        userTimezone={userTimezone}
        filters={filters}
        onViewModeChange={handleViewModeChange}
        onNavigatePrev={handleNavigatePrev}
        onNavigateNext={handleNavigateNext}
        onNavigateToday={handleNavigateToday}
        onFiltersChange={setFilters}
        onTriggerSync={handleTriggerSync}
        isSyncing={isSyncing}
        onOpenCreateEvent={() => {
          setSelectedEvent(null)
          setSlotStart(null)
          setSlotEnd(null)
          setIsEventModalOpen(true)
        }}
        onOpenScheduleTask={() => setIsScheduleTaskModalOpen(true)}
      />

      {/* Main View Grid */}
      <div className="animate-in fade-in duration-200">
        {viewMode === 'day' && (
          <DayView
            currentDate={currentDate}
            userTimezone={userTimezone}
            events={feed.events}
            scheduledTasks={feed.scheduledTasks}
            deadlineTasks={feed.deadlineTasks}
            showTasks={filters.showTasks}
            showCompletedTasks={filters.showCompletedTasks}
            onSelectEvent={handleSelectEvent}
            onSelectTimeSlot={handleSelectTimeSlot}
            onToggleTask={handleToggleTask}
          />
        )}

        {viewMode === 'week' && (
          <WeekView
            currentDate={currentDate}
            userTimezone={userTimezone}
            events={feed.events}
            scheduledTasks={feed.scheduledTasks}
            deadlineTasks={feed.deadlineTasks}
            showTasks={filters.showTasks}
            showCompletedTasks={filters.showCompletedTasks}
            onSelectEvent={handleSelectEvent}
            onSelectTimeSlot={handleSelectTimeSlot}
            onToggleTask={handleToggleTask}
          />
        )}

        {viewMode === 'month' && (
          <MonthView
            currentDate={currentDate}
            userTimezone={userTimezone}
            events={feed.events}
            scheduledTasks={feed.scheduledTasks}
            deadlineTasks={feed.deadlineTasks}
            showTasks={filters.showTasks}
            showCompletedTasks={filters.showCompletedTasks}
            onSelectEvent={handleSelectEvent}
            onSelectDay={handleSelectDayFromMonth}
            onToggleTask={handleToggleTask}
          />
        )}
      </div>

      {/* Google Calendar Synchronization Architecture Readiness Banner */}
      <Card className="p-6 border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#22D3EE]/15 border border-[#22D3EE]/30 text-[#22D3EE] shrink-0">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">Google Calendar Sync Readiness</h3>
                <Badge variant="cyan">Phase 3 Architecture</Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Mapping tables, webhook subscriptions, and conflict resolution policies are staged.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8B7CFF]" />}
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>calendar_event_mappings Ready</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <span className="text-slate-400 font-medium">Event Mappings</span>
            <p className="text-white font-semibold mt-1">UUID &lt;=&gt; Google Event ID</p>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <span className="text-slate-400 font-medium">Conflict Resolution</span>
            <p className="text-white font-semibold mt-1">ETag + Last-Write-Wins</p>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <span className="text-slate-400 font-medium">Credential Security</span>
            <p className="text-white font-semibold mt-1">AES-256 Encrypted Tokens</p>
          </div>
        </div>
      </Card>

      {/* Modals */}
      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => {
          setIsEventModalOpen(false)
          setSelectedEvent(null)
          setSlotStart(null)
          setSlotEnd(null)
        }}
        onSuccess={() => loadFeed(currentDate, viewMode)}
        initialEvent={selectedEvent}
        defaultStartTime={slotStart}
        defaultEndTime={slotEnd}
        projects={projects}
        tasks={tasks}
      />

      <ScheduleTaskModal
        isOpen={isScheduleTaskModalOpen}
        onClose={() => setIsScheduleTaskModalOpen(false)}
        onSuccess={() => loadFeed(currentDate, viewMode)}
        tasks={tasks}
        defaultStartTime={slotStart}
        defaultEndTime={slotEnd}
      />
    </div>
  )
}
