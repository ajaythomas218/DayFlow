'use client'

import React, { useState } from 'react'
import {
  Sparkles,
  Calendar,
  CheckCircle2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Save,
  AlertCircle,
  FolderKanban,
  CheckSquare,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import {
  getWeeklyReviewDataAction,
  saveWeeklyReviewAction,
  WeeklyReviewComputedData,
} from '@/lib/actions/weekly-review'

interface WeeklyReviewClientProps {
  initialData: WeeklyReviewComputedData
}

export function WeeklyReviewClient({ initialData }: WeeklyReviewClientProps) {
  const { toast } = useToast()
  const [data, setData] = useState<WeeklyReviewComputedData>(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Reflection form state
  const [form, setForm] = useState({
    reflection_content: initialData.savedReview?.reflection_content || '',
    wins: initialData.savedReview?.wins || '',
    challenges: initialData.savedReview?.challenges || '',
    lessons_learned: initialData.savedReview?.lessons_learned || '',
    next_week_priorities: initialData.savedReview?.next_week_priorities || '',
  })

  // Navigate between weeks
  const handleNavigateWeek = async (direction: 'prev' | 'next' | 'current') => {
    let targetDateStr: string | undefined

    if (direction === 'current') {
      targetDateStr = undefined
    } else {
      const currentStart = new Date(`${data.week.weekStartDate}T12:00:00Z`)
      const offsetDays = direction === 'prev' ? -7 : 7
      const nextDate = new Date(currentStart.getTime() + offsetDays * 86400000)
      targetDateStr = nextDate.toISOString().split('T')[0]
    }

    setIsLoading(true)
    try {
      const res = await getWeeklyReviewDataAction(targetDateStr)
      if (!res.success || !res.data) {
        toast({ title: 'Navigation error', message: res.error || 'Failed to load week', type: 'error' })
        return
      }

      setData(res.data)
      setForm({
        reflection_content: res.data.savedReview?.reflection_content || '',
        wins: res.data.savedReview?.wins || '',
        challenges: res.data.savedReview?.challenges || '',
        lessons_learned: res.data.savedReview?.lessons_learned || '',
        next_week_priorities: res.data.savedReview?.next_week_priorities || '',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Save Review
  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const res = await saveWeeklyReviewAction({
        week_start_date: data.week.weekStartDate,
        ...form,
      })

      if (!res.success || !res.data) {
        toast({ title: 'Save failed', message: res.error || 'Could not save review', type: 'error' })
        return
      }

      setData((prev) => ({
        ...prev,
        savedReview: res.data!,
      }))

      toast({
        title: 'Weekly review saved',
        message: `Saved reflection for week of ${data.week.weekStartDate}.`,
        type: 'success',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const { week, savedReview, tasks, projects, calendar, training, studentReviews, diaryHighlights } = data

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 text-[#9E91FF]">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Weekly Review
              </h1>
              {savedReview ? (
                <Badge variant="success" size="sm">
                  Reviewed
                </Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  Review Pending
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              Close out your week with computed canonical summaries and structured reflections.
            </p>
          </div>
        </div>

        {/* Week Selector Controls */}
        <div className="flex items-center gap-2 bg-[#141B2D] p-1.5 rounded-xl border border-white/10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNavigateWeek('prev')}
            disabled={isLoading}
            className="h-8 w-8 p-0"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNavigateWeek('current')}
            disabled={isLoading}
            className="text-xs h-8"
          >
            Current Week
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNavigateWeek('next')}
            disabled={isLoading}
            className="h-8 w-8 p-0"
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Week Horizon Banner */}
      <Card className="p-4 bg-[#121929]/90 border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Calendar className="w-5 h-5 text-[#9E91FF]" />
          <div>
            <span className="text-xs text-slate-400 block font-medium">Review Horizon</span>
            <span className="text-sm font-bold text-white">{week.label}</span>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          {savedReview?.updated_at && (
            <span>Last saved: {new Date(savedReview.updated_at).toLocaleString()}</span>
          )}
        </div>
      </Card>

      {/* COMPUTED SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card className="p-4 bg-[#101522]/80 border-white/10">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block truncate">
            Completed Tasks
          </span>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {tasks.completedThisWeek.length}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {tasks.createdThisWeekCount} created this week
          </span>
        </Card>

        <Card className="p-4 bg-[#101522]/80 border-white/10">
          <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider block truncate">
            Calendar Workload
          </span>
          <p className="text-2xl font-bold text-cyan-400 mt-1">
            {Math.round(calendar.meetingMinutes / 60)}h
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {calendar.totalMeetings} meetings &bull; {calendar.focusBlocks} focus blocks
          </span>
        </Card>

        <Card className="p-4 bg-[#101522]/80 border-white/10">
          <span className="text-xs font-semibold text-[#9E91FF] uppercase tracking-wider block truncate">
            Training Hours
          </span>
          <p className="text-2xl font-bold text-[#9E91FF] mt-1">{training.hoursLogged}h</p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {training.sessionsCompleted} sessions logged
          </span>
        </Card>

        <Card className="p-4 bg-[#101522]/80 border-white/10">
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block truncate">
            Diary Logs
          </span>
          <p className="text-2xl font-bold text-amber-400 mt-1">
            {diaryHighlights.entriesCount} / 7
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {studentReviews.awaitingReviewCount} reviews awaiting
          </span>
        </Card>
      </div>

      {/* SECTION: COMPUTED MODULE DEEP DIVE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Completed Tasks & Projects */}
        <Card className="p-5 bg-[#121929]/90 border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-emerald-400" />
              <span>Tasks Completed This Week</span>
            </h3>
            <span className="text-xs text-slate-400">
              {tasks.completedThisWeek.length} finished
            </span>
          </div>

          {tasks.completedThisWeek.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center">
              No tasks completed during this week.
            </p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {tasks.completedThisWeek.map((t) => (
                <div
                  key={t.id}
                  className="p-2.5 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-slate-200 font-medium truncate max-w-[280px]">
                      {t.title}
                    </span>
                  </div>
                  <Badge variant="neutral" size="sm">
                    {t.priority.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Projects Progress */}
          <div className="pt-3 border-t border-white/5 space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FolderKanban className="w-3.5 h-3.5 text-[#8B7CFF]" />
              <span>Project Momentum</span>
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-emerald-400 font-semibold block">Progressed</span>
                <span className="text-white font-bold">{projects.progressed.length} projects</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-800 border border-white/10">
                <span className="text-slate-400 font-semibold block">Stalled / Inactive</span>
                <span className="text-white font-bold">{projects.stalled.length} projects</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Diary Highlights */}
        <Card className="p-5 bg-[#121929]/90 border-white/10 space-y-4">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#9E91FF]" />
            <span>Daily Diary Highlights for the Week</span>
          </h3>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1 text-xs">
            {diaryHighlights.wins.length > 0 && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <span className="font-semibold text-emerald-400 block text-[11px] uppercase tracking-wider">
                  Logged Daily Wins
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                  {diaryHighlights.wins.map((w, idx) => (
                    <li key={idx} className="truncate">{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {diaryHighlights.challenges.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-1">
                <span className="font-semibold text-amber-400 block text-[11px] uppercase tracking-wider">
                  Logged Challenges
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                  {diaryHighlights.challenges.map((c, idx) => (
                    <li key={idx} className="truncate">{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {diaryHighlights.lessonsLearned.length > 0 && (
              <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 space-y-1">
                <span className="font-semibold text-cyan-400 block text-[11px] uppercase tracking-wider">
                  Lessons Learned
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                  {diaryHighlights.lessonsLearned.map((l, idx) => (
                    <li key={idx} className="truncate">{l}</li>
                  ))}
                </ul>
              </div>
            )}

            {diaryHighlights.entriesCount === 0 && (
              <p className="text-xs text-slate-400 italic py-6 text-center">
                No daily diary entries logged for this week.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* SECTION: USER-WRITTEN WEEKLY REFLECTION FORM */}
      <form onSubmit={handleSaveReview}>
        <Card className="p-6 bg-[#121929]/95 border-white/10 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#8B7CFF]" />
                <span>Written Weekly Reflection</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Record your qualitative synthesis, lessons learned, and clear priorities for the week ahead.
              </p>
            </div>

            <Button type="submit" variant="primary" size="md" isLoading={isSaving}>
              <Save className="w-4 h-4 mr-1.5" />
              <span>Save Reflection</span>
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Weekly Reflection &amp; Executive Summary
              </label>
              <Textarea
                value={form.reflection_content}
                onChange={(e) => setForm({ ...form, reflection_content: e.target.value })}
                placeholder="How did this week go holistically? What went well, what slipped, and why?"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-emerald-400 block mb-1">
                  Key Wins &amp; Highlights
                </label>
                <Textarea
                  value={form.wins}
                  onChange={(e) => setForm({ ...form, wins: e.target.value })}
                  placeholder="Significant milestones reached, breakthroughs, deliverables completed..."
                  rows={3}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-amber-400 block mb-1">
                  Challenges &amp; Friction Points
                </label>
                <Textarea
                  value={form.challenges}
                  onChange={(e) => setForm({ ...form, challenges: e.target.value })}
                  placeholder="Blockers, scope creep, time sinks, unexpected interruptions..."
                  rows={3}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-cyan-400 block mb-1">
                  Lessons Learned &amp; Process Improvements
                </label>
                <Textarea
                  value={form.lessons_learned}
                  onChange={(e) => setForm({ ...form, lessons_learned: e.target.value })}
                  placeholder="What will you adjust about your scheduling, delegation, or focus..."
                  rows={3}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#9E91FF] block mb-1">
                  Next Week&apos;s Core Priorities &amp; Intended Outcomes
                </label>
                <Textarea
                  value={form.next_week_priorities}
                  onChange={(e) => setForm({ ...form, next_week_priorities: e.target.value })}
                  placeholder="Top 3 to 5 outcomes you must achieve next week..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Integrity Note */}
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-start gap-2.5 text-xs text-slate-400">
            <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              * Note: Saving your weekly review writes your personal reflection to your dedicated weekly review record. It will never automatically reschedule, complete, or mutate your tasks.
            </p>
          </div>
        </Card>
      </form>
    </div>
  )
}
