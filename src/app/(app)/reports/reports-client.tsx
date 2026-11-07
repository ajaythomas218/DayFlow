'use client'

import React, { useState } from 'react'
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Dumbbell,
  GraduationCap,
  BookOpen,
  Filter,
  Layers,
  TrendingUp,
  Table as TableIcon,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { getReportsAction, ReportsData } from '@/lib/actions/reports'
import { ReportsFilterInput } from '@/lib/validations/reports'
import { useToast } from '@/components/ui/toast'

interface ReportsClientProps {
  initialData: ReportsData
}

export function ReportsClient({ initialData }: ReportsClientProps) {
  const { toast } = useToast()
  const [data, setData] = useState<ReportsData>(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [showTableAlternative, setShowTableAlternative] = useState(false)

  const [preset, setPreset] = useState<ReportsFilterInput['preset']>('this_week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const handleApplyPreset = async (newPreset: ReportsFilterInput['preset']) => {
    setPreset(newPreset)
    if (newPreset === 'custom') return

    setIsLoading(true)
    try {
      const res = await getReportsAction({ preset: newPreset })
      if (!res.success || !res.data) {
        toast({ title: 'Report error', message: res.error || 'Failed to load report', type: 'error' })
        return
      }
      setData(res.data)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApplyCustom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customStart || !customEnd) {
      toast({ title: 'Validation error', message: 'Both start and end dates are required', type: 'error' })
      return
    }

    if (customStart > customEnd) {
      toast({ title: 'Invalid range', message: 'Start date cannot be after end date', type: 'error' })
      return
    }

    setIsLoading(true)
    try {
      const res = await getReportsAction({
        preset: 'custom',
        start_date: customStart,
        end_date: customEnd,
      })
      if (!res.success || !res.data) {
        toast({ title: 'Report error', message: res.error || 'Failed to load report', type: 'error' })
        return
      }
      setData(res.data)
      toast({ title: 'Report updated', type: 'success' })
    } finally {
      setIsLoading(false)
    }
  }

  const { tasksSummary, dailyTrends, projectBreakdown, priorityBreakdown, calendarWorkload, trainingSummary, studentReviewsSummary, diarySummary, range } = data

  const maxDailyCount = Math.max(
    ...dailyTrends.map((d) => Math.max(d.createdCount, d.completedCount)),
    1
  )

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 text-[#9E91FF]">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Productivity Reports
              </h1>
              <Badge variant="cyan" size="sm">
                Canonical Truth
              </Badge>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              Timezone-aware metrics across tasks, calendar, training, reviews, and reflection coverage.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTableAlternative(!showTableAlternative)}
            className="text-xs"
          >
            <TableIcon className="w-3.5 h-3.5 mr-1.5" />
            <span>{showTableAlternative ? 'Show Visualizations' : 'Accessible Table'}</span>
          </Button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <Card className="p-4 bg-[#121929]/90 border-white/10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-[#182238] p-1 rounded-xl border border-white/10 text-xs">
            {(
              [
                { id: 'this_week', label: 'This Week' },
                { id: 'last_week', label: 'Last Week' },
                { id: 'this_month', label: 'This Month' },
                { id: 'last_month', label: 'Last Month' },
                { id: 'custom', label: 'Custom Range' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => handleApplyPreset(item.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  preset === item.id
                    ? 'bg-[#8B7CFF] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Active Range:</span>
            <span className="text-slate-200 font-semibold">{range.label}</span>
          </div>
        </div>

        {/* Custom Range Drawer */}
        {preset === 'custom' && (
          <form
            onSubmit={handleApplyCustom}
            className="flex flex-wrap items-end gap-3 pt-3 border-t border-white/5"
          >
            <div className="w-40">
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Start Date
              </label>
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                required
              />
            </div>
            <div className="w-40">
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">End Date</label>
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
              <Filter className="w-3.5 h-3.5 mr-1" />
              <span>Apply Range</span>
            </Button>
          </form>
        )}
      </Card>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <Card className="p-4 bg-[#101522]/80 border-white/10">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block truncate">
            Created in Period
          </span>
          <p className="text-2xl font-bold text-white mt-1">{tasksSummary.createdInPeriod}</p>
        </Card>

        <Card className="p-4 bg-[#101522]/80 border-white/10">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block truncate">
            Completed in Period
          </span>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {tasksSummary.completedInPeriod}
          </p>
        </Card>

        <Card className="p-4 bg-[#101522]/80 border-white/10">
          <span className="text-xs font-semibold text-[#9E91FF] uppercase tracking-wider block truncate">
            Productivity Ratio
          </span>
          <p className="text-2xl font-bold text-[#9E91FF] mt-1">
            {tasksSummary.netProductivityRatio}x
          </p>
        </Card>

        <Card className="p-4 bg-[#101522]/80 border-white/10">
          <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider block truncate">
            Open Tasks Total
          </span>
          <p className="text-2xl font-bold text-cyan-400 mt-1">{tasksSummary.openTotal}</p>
        </Card>

        <Card className="p-4 bg-[#101522]/80 border-white/10">
          <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider block truncate">
            Overdue Tasks
          </span>
          <p className="text-2xl font-bold text-rose-400 mt-1">{tasksSummary.overdueTotal}</p>
        </Card>

        <Card className="p-4 bg-[#101522]/80 border-white/10">
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block truncate">
            Diary Coverage
          </span>
          <p className="text-2xl font-bold text-amber-400 mt-1">
            {diarySummary.reflectionCoveragePercent}%
          </p>
        </Card>
      </div>

      {/* SECTION 1: DAILY TASK VELOCITY & TRENDS */}
      <Card className="p-6 bg-[#121929]/90 border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Daily Task Velocity Trend</span>
            </h3>
            <p className="text-xs text-slate-400">
              Compares tasks created versus tasks completed each day of the active horizon.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
              <span className="text-slate-300">Completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#8B7CFF] inline-block" />
              <span className="text-slate-300">Created</span>
            </div>
          </div>
        </div>

        {/* Visual Chart / Histogram */}
        {!showTableAlternative ? (
          <div className="pt-4">
            <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-48 border-b border-white/10 pb-2">
              {dailyTrends.slice(-14).map((day) => {
                const compHeight = Math.round((day.completedCount / maxDailyCount) * 100)
                const createdHeight = Math.round((day.createdCount / maxDailyCount) * 100)

                return (
                  <div key={day.date} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                    <div className="w-full flex items-end justify-center gap-1 h-36">
                      {/* Completed Bar */}
                      <div
                        style={{ height: `${Math.max(6, compHeight)}%` }}
                        className="w-1/2 max-w-[20px] bg-emerald-500/80 hover:bg-emerald-400 rounded-t transition-all relative"
                        title={`${day.dayLabel}: ${day.completedCount} completed`}
                      />
                      {/* Created Bar */}
                      <div
                        style={{ height: `${Math.max(6, createdHeight)}%` }}
                        className="w-1/2 max-w-[20px] bg-[#8B7CFF]/80 hover:bg-[#8B7CFF] rounded-t transition-all relative"
                        title={`${day.dayLabel}: ${day.createdCount} created`}
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium truncate max-w-full">
                      {day.dayLabel}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* Accessible Table Alternative */
          <div className="overflow-x-auto pt-2">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 text-slate-400 uppercase text-[11px] border-b border-white/10">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Day</th>
                  <th className="py-2.5 px-3">Tasks Created</th>
                  <th className="py-2.5 px-3">Tasks Completed</th>
                  <th className="py-2.5 px-3">Net Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {dailyTrends.map((d) => (
                  <tr key={d.date} className="hover:bg-white/[0.02]">
                    <td className="py-2 px-3 font-mono text-slate-400">{d.date}</td>
                    <td className="py-2 px-3 font-medium text-white">{d.dayLabel}</td>
                    <td className="py-2 px-3 text-[#9E91FF] font-semibold">{d.createdCount}</td>
                    <td className="py-2 px-3 text-emerald-400 font-semibold">{d.completedCount}</td>
                    <td className="py-2 px-3 font-semibold">
                      {d.completedCount - d.createdCount >= 0 ? (
                        <span className="text-emerald-400">+{d.completedCount - d.createdCount}</span>
                      ) : (
                        <span className="text-amber-400">{d.completedCount - d.createdCount}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* SECTION 2: PROJECTS & PRIORITY BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projects Breakdown */}
        <Card className="lg:col-span-2 p-6 bg-[#121929]/90 border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#8B7CFF]" />
              <span>Project Performance &amp; Completion Rate</span>
            </h3>
            <span className="text-xs text-slate-400">{projectBreakdown.length} Categories</span>
          </div>

          {projectBreakdown.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-6 text-center">No tasks recorded across projects.</p>
          ) : (
            <div className="space-y-3">
              {projectBreakdown.map((proj) => (
                <div key={proj.id} className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: proj.colorHex }}
                      />
                      <span className="font-semibold text-white">{proj.title}</span>
                    </div>
                    <span className="text-slate-300 font-medium">
                      {proj.completedTasks} / {proj.totalTasks} ({proj.completionRate}%)
                    </span>
                  </div>

                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${proj.completionRate}%`,
                        backgroundColor: proj.colorHex,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Priority Breakdown */}
        <Card className="p-6 bg-[#121929]/90 border-white/10 space-y-4">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>Priority Distribution</span>
          </h3>

          <div className="space-y-2.5">
            {priorityBreakdown.map((p) => (
              <div
                key={p.priority}
                className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-semibold text-white block">{p.label}</span>
                  <span className="text-[11px] text-slate-400">
                    {p.completedTasks} completed &bull; {p.totalTasks - p.completedTasks} open
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-white text-sm">{p.completionRate}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* SECTION 3: CROSS-MODULE WORKLOAD */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Calendar Workload */}
        <Card className="p-5 bg-[#121929]/80 border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-cyan-400" />
              Calendar Load
            </span>
            <Badge variant="cyan" size="sm">
              Events
            </Badge>
          </div>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Meetings:</span>
              <span className="font-semibold text-white">
                {calendarWorkload.totalMeetings} ({Math.round(calendarWorkload.meetingMinutes / 60)}h)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Focus Blocks:</span>
              <span className="font-semibold text-white">
                {calendarWorkload.focusBlocks} ({Math.round(calendarWorkload.focusMinutes / 60)}h)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Time-Blocked Tasks:</span>
              <span className="font-semibold text-white">{calendarWorkload.timeBlockedTasks}</span>
            </div>
          </div>
        </Card>

        {/* Training Summary */}
        <Card className="p-5 bg-[#121929]/80 border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Dumbbell className="w-4 h-4 text-[#8B7CFF]" />
              Training &amp; Routines
            </span>
            <Badge variant="violet" size="sm">
              Learning
            </Badge>
          </div>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Sessions Completed:</span>
              <span className="font-semibold text-white">
                {trainingSummary.sessionsCompleted}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Hours Logged:</span>
              <span className="font-semibold text-white">{trainingSummary.hoursLogged}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Active Programs:</span>
              <span className="font-semibold text-white">{trainingSummary.activeCoursesCount}</span>
            </div>
          </div>
        </Card>

        {/* Student Reviews */}
        <Card className="p-5 bg-[#121929]/80 border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-amber-400" />
              Review Queue
            </span>
            <Badge variant="warning" size="sm">
              Pastoral
            </Badge>
          </div>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Awaiting Review:</span>
              <span className="font-semibold text-amber-300">
                {studentReviewsSummary.awaitingReview}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">In Review:</span>
              <span className="font-semibold text-cyan-300">{studentReviewsSummary.inReview}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Overdue Follow-ups:</span>
              <span className="font-semibold text-rose-400">
                {studentReviewsSummary.overdueFollowUps}
              </span>
            </div>
          </div>
        </Card>

        {/* Daily Diary & Well-Being */}
        <Card className="p-5 bg-[#121929]/80 border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-emerald-400" />
              Diary &amp; Reflection
            </span>
            <Badge variant="success" size="sm">
              Coverage
            </Badge>
          </div>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Entries Logged:</span>
              <span className="font-semibold text-white">
                {diarySummary.entriesLogged} / {diarySummary.totalDaysInRange} days
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Avg Energy Level:</span>
              <span className="font-semibold text-white">
                {diarySummary.averageEnergyLevel ? `${diarySummary.averageEnergyLevel}/5` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Avg Mood Rating:</span>
              <span className="font-semibold text-white">
                {diarySummary.averageMoodRating ? `${diarySummary.averageMoodRating}/5` : 'N/A'}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
