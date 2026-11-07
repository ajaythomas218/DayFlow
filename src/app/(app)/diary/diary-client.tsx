'use client'

import React, { useState, useCallback, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Sparkles,
  Save,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Flame,
  Smile,
  Target,
  Plus,
  Trash2,
  HelpCircle,
  Trophy,
  Video,
  MapPin,
  Loader2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea, Input, Label, Select } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import {
  DiaryDayData,
  getDiaryDayDataAction,
  saveDiaryEntryAction,
  toggleDiaryFocusTaskAction,
  updateTaskReflectionNoteAction,
} from '@/lib/actions/diary'
import { toggleTaskCompletionAction } from '@/lib/actions/tasks'
import { getLocalDateString, shiftLocalCalendarDay } from '@/lib/timezone'
import { Task } from '@/types'
import { TaskWithDetails } from '@/lib/actions/tasks'

interface DiaryClientProps {
  initialData: DiaryDayData
  userTimezone: string
  userDisplayName?: string
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

export function DiaryClient({
  initialData,
  userTimezone = 'UTC',
  userDisplayName,
}: DiaryClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [currentDate, setCurrentDate] = useState<string>(initialData.entryDate)
  const [data, setData] = useState<DiaryDayData>(initialData)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')

  // Form State
  const [morningIntentions, setMorningIntentions] = useState(initialData.entry?.morning_intentions || '')
  const [journalContent, setJournalContent] = useState(initialData.entry?.journal_content || '')
  const [eveningReflection, setEveningReflection] = useState(initialData.entry?.evening_reflection || '')
  const [wins, setWins] = useState(initialData.entry?.wins || '')
  const [challenges, setChallenges] = useState(initialData.entry?.challenges || '')
  const [lessonsLearned, setLessonsLearned] = useState(initialData.entry?.lessons_learned || '')
  const [tomorrowPlan, setTomorrowPlan] = useState(initialData.entry?.tomorrow_plan || '')
  const [energyLevel, setEnergyLevel] = useState<number | null>(initialData.entry?.energy_level || null)
  const [moodRating, setMoodRating] = useState<number | null>(initialData.entry?.mood_rating || null)

  const [selectedTaskToAdd, setSelectedTaskToAdd] = useState<string>('')
  const [expandedReflectionTaskId, setExpandedReflectionTaskId] = useState<string | null>(null)
  const [reflectionNoteDraft, setReflectionNoteDraft] = useState<string>('')

  // Debounced auto-save timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Sync state when day changes
  const applyDayData = (newDayData: DiaryDayData) => {
    setData(newDayData)
    setCurrentDate(newDayData.entryDate)
    const e = newDayData.entry
    setMorningIntentions(e?.morning_intentions || '')
    setJournalContent(e?.journal_content || '')
    setEveningReflection(e?.evening_reflection || '')
    setWins(e?.wins || '')
    setChallenges(e?.challenges || '')
    setLessonsLearned(e?.lessons_learned || '')
    setTomorrowPlan(e?.tomorrow_plan || '')
    setEnergyLevel(e?.energy_level || null)
    setMoodRating(e?.mood_rating || null)
    setSaveStatus('saved')
  }

  // Fetch day data when date navigation triggers
  const loadDate = useCallback(
    (targetDate: string) => {
      startTransition(async () => {
        const res = await getDiaryDayDataAction(targetDate, userTimezone)
        if (res.success && res.data) {
          applyDayData(res.data)
          router.replace(`/diary?date=${targetDate}`, { scroll: false })
        } else {
          toast({
            title: 'Error loading diary',
            message: res.error || 'Could not load diary data for this date',
            type: 'error',
          })
        }
      })
    },
    [userTimezone, router, toast]
  )

  // Save diary entry
  const handleSave = useCallback(
    async (silent: boolean = false) => {
      setSaveStatus('saving')
      try {
        const payload = {
          entry_date: currentDate,
          morning_intentions: morningIntentions.trim() || null,
          journal_content: journalContent.trim() || null,
          evening_reflection: eveningReflection.trim() || null,
          wins: wins.trim() || null,
          challenges: challenges.trim() || null,
          lessons_learned: lessonsLearned.trim() || null,
          tomorrow_plan: tomorrowPlan.trim() || null,
          energy_level: energyLevel,
          mood_rating: moodRating,
        }

        const res = await saveDiaryEntryAction(payload)
        if (res.success && res.data) {
          setSaveStatus('saved')
          if (!silent) {
            toast({
              title: 'Diary saved',
              message: `Reflections and notes recorded for ${currentDate}.`,
              type: 'success',
            })
          }
        } else {
          setSaveStatus('error')
          if (!silent) {
            toast({
              title: 'Save failed',
              message: res.error || 'Could not save diary entry',
              type: 'error',
            })
          }
        }
      } catch {
        setSaveStatus('error')
        if (!silent) {
          toast({
            title: 'Save failed',
            message: 'An unexpected error occurred while saving',
            type: 'error',
          })
        }
      }
    },
    [
      currentDate,
      morningIntentions,
      journalContent,
      eveningReflection,
      wins,
      challenges,
      lessonsLearned,
      tomorrowPlan,
      energyLevel,
      moodRating,
      toast,
    ]
  )

  // Auto-save debounced trigger on form field change
  const triggerAutoSave = () => {
    setSaveStatus('unsaved')
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      handleSave(true)
    }, 1500)
  }

  // Navigation handlers
  const handlePrevDay = () => {
    const prevDate = shiftLocalCalendarDay(`${currentDate}T12:00:00Z`, userTimezone, -1).slice(0, 10)
    loadDate(prevDate)
  }

  const handleNextDay = () => {
    const nextDate = shiftLocalCalendarDay(`${currentDate}T12:00:00Z`, userTimezone, 1).slice(0, 10)
    loadDate(nextDate)
  }

  const handleToday = () => {
    const today = getLocalDateString(userTimezone)
    if (currentDate !== today) {
      loadDate(today)
    }
  }

  // Toggle canonical task completion
  const handleToggleTask = async (task: Task) => {
    const nextStatus: Task['status'] = task.status === 'completed' ? 'todo' : 'completed'
    // Optimistic UI update
    setData((prev) => {
      const updateTaskInList = (list: TaskWithDetails[]) =>
        list.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))

      return {
        ...prev,
        focusTasks: updateTaskInList(prev.focusTasks),
        scheduledTasks: updateTaskInList(prev.scheduledTasks),
        dueTasks: updateTaskInList(prev.dueTasks),
        overdueTasks: updateTaskInList(prev.overdueTasks),
        completedTasks:
          nextStatus === 'completed'
            ? [...prev.completedTasks, { ...task, status: 'completed' } as TaskWithDetails]
            : prev.completedTasks.filter((t) => t.id !== task.id),
      }
    })

    const res = await toggleTaskCompletionAction(task.id)
    if (!res.success) {
      toast({
        title: 'Task update failed',
        message: res.error || 'Failed to update task completion',
        type: 'error',
      })
      // Revert reload
      loadDate(currentDate)
    }
  }

  // Add task to Focus List
  const handleAddFocusTask = async () => {
    if (!selectedTaskToAdd) return
    const res = await toggleDiaryFocusTaskAction({
      entry_date: currentDate,
      task_id: selectedTaskToAdd,
      is_focus_task: true,
    })

    if (res.success) {
      setSelectedTaskToAdd('')
      toast({
        title: 'Task added to focus',
        message: 'Task added to today’s primary focus list.',
        type: 'success',
      })
      loadDate(currentDate)
    } else {
      toast({
        title: 'Action failed',
        message: res.error || 'Could not add task to focus',
        type: 'error',
      })
    }
  }

  // Remove task from Focus List
  const handleRemoveFocusTask = async (taskId: string) => {
    const res = await toggleDiaryFocusTaskAction({
      entry_date: currentDate,
      task_id: taskId,
      is_focus_task: false,
    })

    if (res.success) {
      toast({
        title: 'Removed from focus',
        message: 'Task removed from today’s focus list.',
        type: 'info',
      })
      loadDate(currentDate)
    }
  }

  // Save reflection note for a linked task
  const handleSaveReflectionNote = async (taskId: string) => {
    if (!data.entry) return
    const res = await updateTaskReflectionNoteAction(data.entry.id, taskId, reflectionNoteDraft)
    if (res.success) {
      setExpandedReflectionTaskId(null)
      toast({
        title: 'Reflection note saved',
        type: 'success',
      })
      loadDate(currentDate)
    }
  }

  // Format readable header date (e.g. Wednesday, October 28, 2026)
  const formatHeaderDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number)
      const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(date)
    } catch {
      return dateStr
    }
  }

  const isToday = currentDate === getLocalDateString(userTimezone)

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* 1. Header & Date Horizon Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0B0F19]/90 border border-white/10 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 text-[#8B7CFF]">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white">Daily Diary &amp; Journal</h1>
              {isToday && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#22D3EE]/20 text-[#22D3EE] border border-[#22D3EE]/30">
                  Today
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {userDisplayName ? `${userDisplayName} • ` : ''}
              {formatHeaderDate(currentDate)} • Timezone: <span className="text-slate-300 font-mono">{userTimezone}</span>
            </p>
          </div>
        </div>

        {/* Date Navigation & Save Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Prev / Today / Next */}
          <div className="flex items-center bg-[#141B2D] p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={handlePrevDay}
              disabled={isPending}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              disabled={isPending}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                isToday
                  ? 'bg-[#8B7CFF] text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNextDay}
              disabled={isPending}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Date Picker Input */}
          <input
            type="date"
            value={currentDate}
            onChange={(e) => {
              if (e.target.value) loadDate(e.target.value)
            }}
            className="px-2.5 py-1.5 rounded-xl bg-[#141B2D] border border-white/10 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#8B7CFF]"
          />

          {/* Save Status & Button */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            <span className="text-[11px] flex items-center gap-1.5">
              {saveStatus === 'saving' && (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#22D3EE]" />
                  <span className="text-[#22D3EE]">Saving...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Saved</span>
                </>
              )}
              {saveStatus === 'unsaved' && (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-amber-400">Unsaved</span>
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-rose-400">Save error</span>
                </>
              )}
            </span>

            <Button
              size="sm"
              variant="primary"
              onClick={() => handleSave(false)}
              disabled={saveStatus === 'saving'}
              className="gap-1.5 text-xs py-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Grid Layout: Morning & Review Workflow + Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Intention, Journal, Retrospective */}
        <div className="lg:col-span-7 space-y-6">
          {/* A. Morning Planning & Intention */}
          <Card className="p-5 border-white/10 bg-[#0B0F19]/80 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles className="w-4 h-4 text-[#8B7CFF]" />
                <span>Morning Planning &amp; Daily Intention</span>
              </div>
              <span className="text-[11px] text-slate-400">Step 1 • Morning Focus</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="morning-intention">What is your primary focus or intention today?</Label>
              <Textarea
                id="morning-intention"
                value={morningIntentions}
                onChange={(e) => {
                  setMorningIntentions(e.target.value)
                  triggerAutoSave()
                }}
                placeholder="Today, my main goal is to finish the core project deliverables and maintain deep focus..."
                rows={3}
                className="bg-[#141B2D]/70 text-xs text-slate-200 resize-y"
              />
            </div>

            {/* Energy & Mood Indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Energy Level (1-5) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span>Energy Level</span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {energyLevel ? `${energyLevel} of 5` : 'Not set'}
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-[#141B2D] p-1 rounded-xl border border-white/5">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setEnergyLevel(energyLevel === val ? null : val)
                        triggerAutoSave()
                      }}
                      className={`flex-1 py-1 text-xs rounded-lg font-medium transition-colors ${
                        energyLevel === val
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood Rating (1-5) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Smile className="w-3.5 h-3.5 text-[#22D3EE]" />
                    <span>Mood / Mindset</span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {moodRating ? `${moodRating} of 5` : 'Not set'}
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-[#141B2D] p-1 rounded-xl border border-white/5">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setMoodRating(moodRating === val ? null : val)
                        triggerAutoSave()
                      }}
                      className={`flex-1 py-1 text-xs rounded-lg font-medium transition-colors ${
                        moodRating === val
                          ? 'bg-[#22D3EE] text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* B. Free-Form Journal & Working Notes */}
          <Card className="p-5 border-white/10 bg-[#0B0F19]/80 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <BookOpen className="w-4 h-4 text-[#22D3EE]" />
                <span>Journal &amp; Free-Form Notes</span>
              </div>
              <span className="text-[11px] text-slate-400">Step 2 • Day Log</span>
            </div>

            <div className="space-y-1.5">
              <Textarea
                value={journalContent}
                onChange={(e) => {
                  setJournalContent(e.target.value)
                  triggerAutoSave()
                }}
                placeholder="Log thoughts, meeting notes, sudden ideas, or work progress as your day unfolds..."
                rows={8}
                className="bg-[#141B2D]/70 text-xs text-slate-200 resize-y leading-relaxed font-mono"
              />
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Markdown supported</span>
                <span>{journalContent.length} characters</span>
              </div>
            </div>
          </Card>

          {/* C. End-of-Day Retrospective & Tomorrow Plan */}
          <Card className="p-5 border-white/10 bg-[#0B0F19]/80 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Trophy className="w-4 h-4 text-emerald-400" />
                <span>Evening Retrospective &amp; Tomorrow</span>
              </div>
              <span className="text-[11px] text-slate-400">Step 3 &amp; 4 • Evening Wrap</span>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="diary-reflection">Evening Reflection &amp; Highlights</Label>
                <Textarea
                  id="diary-reflection"
                  value={eveningReflection}
                  onChange={(e) => {
                    setEveningReflection(e.target.value)
                    triggerAutoSave()
                  }}
                  placeholder="How did today feel? What was meaningful or surprising?"
                  rows={3}
                  className="bg-[#141B2D]/70 text-xs text-slate-200 mt-1"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="diary-wins" className="text-emerald-300">
                    Wins &amp; Accomplishments
                  </Label>
                  <Textarea
                    id="diary-wins"
                    value={wins}
                    onChange={(e) => {
                      setWins(e.target.value)
                      triggerAutoSave()
                    }}
                    placeholder="1. Shipped API integration&#10;2. Had productive 1:1"
                    rows={3}
                    className="bg-[#141B2D]/70 text-xs text-slate-200 mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="diary-challenges" className="text-amber-300">
                    Challenges &amp; Lessons
                  </Label>
                  <Textarea
                    id="diary-challenges"
                    value={challenges}
                    onChange={(e) => {
                      setChallenges(e.target.value)
                      triggerAutoSave()
                    }}
                    placeholder="Encountered blocker with build, resolved by updating config"
                    rows={3}
                    className="bg-[#141B2D]/70 text-xs text-slate-200 mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="diary-tomorrow" className="text-[#8B7CFF]">
                  Tomorrow&apos;s Plan &amp; Carry-Forward
                </Label>
                <Textarea
                  id="diary-tomorrow"
                  value={tomorrowPlan}
                  onChange={(e) => {
                    setTomorrowPlan(e.target.value)
                    triggerAutoSave()
                  }}
                  placeholder="Key priority for tomorrow morning..."
                  rows={2}
                  className="bg-[#141B2D]/70 text-xs text-slate-200 mt-1"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column (5 cols): Daily Checklist & Canonical Tasks Integration */}
        <div className="lg:col-span-5 space-y-6">
          {/* 1. Today's Focus List */}
          <Card className="p-5 border-white/10 bg-[#0B0F19]/80 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Target className="w-4 h-4 text-[#8B7CFF]" />
                <span>Today&apos;s Primary Focus List</span>
              </div>
              <Badge variant="violet" className="text-[10px]">
                {data.focusTasks.length} Pinned
              </Badge>
            </div>

            {/* Quick-add task to focus selector */}
            <div className="flex items-center gap-2">
              <Select
                value={selectedTaskToAdd}
                onChange={(e) => setSelectedTaskToAdd(e.target.value)}
                className="text-xs bg-[#141B2D]"
              >
                <option value="">Pin a task to today&apos;s focus...</option>
                {data.availableTasks
                  .filter((t) => !data.focusTaskIds.includes(t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} {t.project ? `(${t.project.title})` : ''}
                    </option>
                  ))}
              </Select>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleAddFocusTask}
                disabled={!selectedTaskToAdd}
                className="shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Pin</span>
              </Button>
            </div>

            {/* Focus Task Items */}
            {data.focusTasks.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-xs text-slate-400">
                No focus tasks pinned yet. Select a task above to anchor your day.
              </div>
            ) : (
              <div className="space-y-2">
                {data.focusTasks.map((t) => {
                  const link = data.focusTaskLinks.find((l) => l.task_id === t.id)
                  const isCompleted = t.status === 'completed'
                  const isExpanded = expandedReflectionTaskId === t.id

                  return (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-[#141B2D]/70 border border-white/5 space-y-2 transition-colors hover:border-white/10"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleTask(t)}
                            className="mt-0.5 text-slate-400 hover:text-emerald-400 transition-colors"
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-500" />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <span
                              className={`text-xs font-medium block truncate ${
                                isCompleted ? 'line-through text-slate-500' : 'text-slate-200'
                              }`}
                            >
                              {t.title}
                            </span>
                            {t.project && (
                              <span
                                className="inline-block text-[10px] px-1.5 py-0.2 rounded mt-0.5 border"
                                style={{
                                  borderColor: `${t.project.color_hex}40`,
                                  color: t.project.color_hex,
                                }}
                              >
                                {t.project.title}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (isExpanded) {
                                setExpandedReflectionTaskId(null)
                              } else {
                                setExpandedReflectionTaskId(t.id)
                                setReflectionNoteDraft(link?.reflection_note || '')
                              }
                            }}
                            className="p-1 rounded text-slate-400 hover:text-white text-[11px] transition-colors"
                            title="Task reflection note"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveFocusTask(t.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-400 transition-colors"
                            title="Unpin from focus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Display existing reflection note */}
                      {link?.reflection_note && !isExpanded && (
                        <p className="text-[11px] text-slate-400 bg-black/20 p-2 rounded-lg italic">
                          &ldquo;{link.reflection_note}&rdquo;
                        </p>
                      )}

                      {/* Editable reflection note */}
                      {isExpanded && (
                        <div className="pt-2 border-t border-white/5 space-y-1.5 animate-in fade-in">
                          <Label className="text-[10px] text-slate-400">
                            Task Reflection Note (Wins / Lessons on this task)
                          </Label>
                          <Input
                            value={reflectionNoteDraft}
                            onChange={(e) => setReflectionNoteDraft(e.target.value)}
                            placeholder="e.g. Took 30m longer than estimated due to auth docs..."
                            className="text-xs"
                          />
                          <div className="flex justify-end gap-1.5 pt-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpandedReflectionTaskId(null)}
                              className="text-[11px] py-1 h-7"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleSaveReflectionNote(t.id)}
                              className="text-[11px] py-1 h-7"
                            >
                              Save Note
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* 2. Scheduled Time-Blocks for Today */}
          <Card className="p-5 border-white/10 bg-[#0B0F19]/80 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Clock className="w-3.5 h-3.5 text-[#22D3EE]" />
                <span>Scheduled Time Blocks Today</span>
              </div>
              <Badge variant="neutral" className="text-[10px]">
                {data.scheduledTasks.length}
              </Badge>
            </div>

            {data.scheduledTasks.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-1">No tasks time-blocked for this day.</p>
            ) : (
              <div className="space-y-1.5">
                {data.scheduledTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#141B2D]/50 text-xs"
                  >
                    <span className="truncate text-slate-300">{t.title}</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {t.scheduled_start_at ? new Date(t.scheduled_start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 3. Due Today & Overdue Warnings */}
          <Card className="p-5 border-white/10 bg-[#0B0F19]/80 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <CalendarIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>Deadlines &amp; Horizons</span>
              </div>
              <span className="text-[10px] text-slate-400">
                {data.dueTasks.length} Due • {data.overdueTasks.length} Overdue
              </span>
            </div>

            {/* Overdue Warnings (without modifying deadlines) */}
            {data.overdueTasks.length > 0 && (
              <div className="space-y-1.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Overdue Tasks (Need Rescheduling)</span>
                </div>
                {data.overdueTasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-xs py-0.5">
                    <span className="text-slate-200 truncate">{t.title}</span>
                    <span className="text-[10px] text-amber-400 font-mono">
                      {t.deadline_at?.slice(0, 10)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Due Today */}
            {data.dueTasks.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Due Today
                </span>
                {data.dueTasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-[#141B2D]/40">
                    <span className="truncate text-slate-300">{t.title}</span>
                    <span className="text-[11px] text-slate-400">
                      {t.status === 'completed' ? 'Done' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 4. Calendar Events on this Day */}
          {data.calendarEvents.length > 0 && (
            <Card className="p-5 border-white/10 bg-[#0B0F19]/80 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <CalendarIcon className="w-3.5 h-3.5 text-[#8B7CFF]" />
                  <span>Calendar Meetings &amp; Events</span>
                </div>
                <Badge variant="cyan" className="text-[10px]">
                  {data.calendarEvents.length}
                </Badge>
              </div>

              <div className="space-y-2">
                {data.calendarEvents.map((e) => (
                  <div
                    key={e.id}
                    className="p-2.5 rounded-xl bg-[#141B2D]/60 border border-white/5 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{e.title}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {e.is_all_day
                          ? 'All Day'
                          : `${new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(e.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </span>
                    </div>
                    {e.location && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        <span>{e.location}</span>
                      </div>
                    )}
                    {e.meeting_url && (
                      <div className="flex items-center gap-1 text-[11px] text-[#22D3EE]">
                        <Video className="w-3 h-3" />
                        <a href={e.meeting_url} target="_blank" rel="noreferrer" className="hover:underline">
                          Join Meeting
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
