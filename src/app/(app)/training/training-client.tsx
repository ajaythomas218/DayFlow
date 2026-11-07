'use client'

import React, { useState } from 'react'
import {
  GraduationCap,
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  ListTodo,
  Trash2,
  Edit2,
  ArrowLeft,
  Video,
  Sparkles,
  Layers,
  ChevronRight,
  BookOpen,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import {
  createTrainingCourseAction,
  updateTrainingCourseAction,
  deleteTrainingCourseAction,
  saveChecklistTemplateAction,
  deleteChecklistTemplateAction,
  createTrainingSessionAction,
  updateTrainingSessionAction,
  deleteTrainingSessionAction,
  generateTasksFromSessionTemplateAction,
  TrainingCourseWithDetails,
  TrainingTemplateWithItems,
} from '@/lib/actions/training'
import { toggleTaskCompletionAction } from '@/lib/actions/tasks'
import { TrainingCourse, TrainingSession, Task } from '@/types'

interface TrainingClientProps {
  initialCourses: TrainingCourseWithDetails[]
  userTimezone: string
}

export function TrainingClient({ initialCourses, userTimezone }: TrainingClientProps) {
  const { toast } = useToast()
  const [courses, setCourses] = useState<TrainingCourseWithDetails[]>(initialCourses)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'templates' | 'sessions' | 'tasks'>('overview')

  // Modals
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<TrainingCourse | null>(null)

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<TrainingTemplateWithItems | null>(null)

  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form states for Course
  const [courseForm, setCourseForm] = useState({
    title: '',
    description: '',
    provider: '',
    category: '',
    target_hours: 20,
    status: 'planned' as TrainingCourse['status'],
    start_date: '',
    end_date: '',
    personal_notes: '',
  })

  // Form states for Template
  const [templateForm, setTemplateForm] = useState({
    template_name: '',
    description: '',
    items: [
      {
        task_title: '',
        estimated_duration_minutes: 15,
        sort_order: 1,
        is_mandatory: true,
        due_offset_days: 0,
        relative_to: 'session_start',
      },
    ],
  })

  // Form states for Session
  const [sessionForm, setSessionForm] = useState({
    session_title: '',
    template_id: '',
    scheduled_start: '',
    scheduled_end: '',
    actual_duration_minutes: 60,
    status: 'scheduled' as TrainingSession['status'],
    notes: '',
    location: '',
    meeting_url: '',
    sync_to_calendar: true,
    generate_tasks: true,
  })

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) || null

  const getStatusBadge = (status: TrainingCourse['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>
      case 'planned':
        return <Badge variant="cyan">Planned</Badge>
      case 'paused':
        return <Badge variant="warning">Paused</Badge>
      case 'completed':
        return <Badge variant="violet">Completed</Badge>
      case 'archived':
        return <Badge variant="neutral">Archived</Badge>
      default:
        return <Badge variant="neutral">{status}</Badge>
    }
  }

  const getSessionStatusBadge = (status: TrainingSession['status']) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="cyan">Scheduled</Badge>
      case 'in_progress':
        return <Badge variant="warning">In Progress</Badge>
      case 'completed':
        return <Badge variant="success">Completed</Badge>
      case 'cancelled':
        return <Badge variant="danger">Cancelled</Badge>
      default:
        return <Badge variant="neutral">{status}</Badge>
    }
  }

  // Handle Course Create/Update
  const handleOpenCourseModal = (course?: TrainingCourse) => {
    if (course) {
      setEditingCourse(course)
      setCourseForm({
        title: course.title,
        description: course.description || '',
        provider: course.provider || '',
        category: course.category || '',
        target_hours: course.target_hours ? Number(course.target_hours) : 20,
        status: course.status,
        start_date: course.start_date || '',
        end_date: course.end_date || '',
        personal_notes: course.personal_notes || '',
      })
    } else {
      setEditingCourse(null)
      setCourseForm({
        title: '',
        description: '',
        provider: '',
        category: '',
        target_hours: 20,
        status: 'planned',
        start_date: '',
        end_date: '',
        personal_notes: '',
      })
    }
    setIsCourseModalOpen(true)
  }

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (editingCourse) {
        const res = await updateTrainingCourseAction({
          id: editingCourse.id,
          ...courseForm,
          target_hours: Number(courseForm.target_hours) || null,
        })
        if (!res.success) {
          toast({ title: 'Update failed', message: res.error, type: 'error' })
          return
        }
        setCourses((prev) =>
          prev.map((c) => (c.id === editingCourse.id ? { ...c, ...res.data! } : c))
        )
        toast({ title: 'Course updated', type: 'success' })
      } else {
        const res = await createTrainingCourseAction({
          ...courseForm,
          target_hours: Number(courseForm.target_hours) || null,
        })
        if (!res.success) {
          toast({ title: 'Creation failed', message: res.error, type: 'error' })
          return
        }
        const newCourseDetails: TrainingCourseWithDetails = {
          ...res.data!,
          templates: [],
          sessions: [],
          tasks: [],
          progress: {
            totalSessions: 0,
            completedSessions: 0,
            totalTasks: 0,
            completedTasks: 0,
            estimatedHoursLogged: 0,
          },
        }
        setCourses((prev) => [newCourseDetails, ...prev])
        setSelectedCourseId(res.data!.id)
        toast({ title: 'Course created', type: 'success' })
      }
      setIsCourseModalOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course and its associated templates?')) return
    const res = await deleteTrainingCourseAction(courseId)
    if (!res.success) {
      toast({ title: 'Delete failed', message: res.error, type: 'error' })
      return
    }
    setCourses((prev) => prev.filter((c) => c.id !== courseId))
    setSelectedCourseId(null)
    toast({ title: 'Course deleted', type: 'success' })
  }

  // Handle Templates
  const handleOpenTemplateModal = (template?: TrainingTemplateWithItems) => {
    if (!selectedCourse) return
    if (template) {
      setEditingTemplate(template)
      setTemplateForm({
        template_name: template.template_name,
        description: template.description || '',
        items: template.items.map((i) => ({
          task_title: i.task_title,
          estimated_duration_minutes: i.estimated_duration_minutes,
          sort_order: i.sort_order,
          is_mandatory: i.is_mandatory,
          due_offset_days: i.due_offset_days,
          relative_to: i.relative_to,
        })),
      })
    } else {
      setEditingTemplate(null)
      setTemplateForm({
        template_name: '',
        description: '',
        items: [
          {
            task_title: '',
            estimated_duration_minutes: 15,
            sort_order: 1,
            is_mandatory: true,
            due_offset_days: 0,
            relative_to: 'session_start',
          },
        ],
      })
    }
    setIsTemplateModalOpen(true)
  }

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCourse) return
    setIsSubmitting(true)

    try {
      const validItems = templateForm.items.filter((i) => i.task_title.trim().length > 0)
      if (validItems.length === 0) {
        toast({ title: 'Template Error', message: 'Add at least one checklist item with a title', type: 'error' })
        return
      }

      const res = await saveChecklistTemplateAction({
        id: editingTemplate?.id,
        course_id: selectedCourse.id,
        template_name: templateForm.template_name,
        description: templateForm.description || null,
        items: validItems,
      })

      if (!res.success) {
        toast({ title: 'Save failed', message: res.error, type: 'error' })
        return
      }

      setCourses((prev) =>
        prev.map((c) => {
          if (c.id !== selectedCourse.id) return c
          const existingTemplates = c.templates.filter((t) => t.id !== res.data!.id)
          return {
            ...c,
            templates: [...existingTemplates, res.data!],
          }
        })
      )

      setIsTemplateModalOpen(false)
      toast({
        title: 'Checklist template saved',
        message: 'Previously generated tasks remain unchanged.',
        type: 'success',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return
    const res = await deleteChecklistTemplateAction(templateId)
    if (!res.success) {
      toast({ title: 'Failed to delete template', message: res.error, type: 'error' })
      return
    }
    setCourses((prev) =>
      prev.map((c) => (c.id === selectedCourseId ? { ...c, templates: c.templates.filter((t) => t.id !== templateId) } : c))
    )
    toast({ title: 'Template removed', type: 'success' })
  }

  // Handle Sessions
  const handleOpenSessionModal = (session?: TrainingSession) => {
    if (!selectedCourse) return
    if (session) {
      setEditingSession(session)
      setSessionForm({
        session_title: session.session_title,
        template_id: session.template_id || '',
        scheduled_start: session.scheduled_start ? new Date(session.scheduled_start).toISOString().slice(0, 16) : '',
        scheduled_end: session.scheduled_end ? new Date(session.scheduled_end).toISOString().slice(0, 16) : '',
        actual_duration_minutes: session.actual_duration_minutes || 60,
        status: session.status,
        notes: session.notes || '',
        location: session.location || '',
        meeting_url: session.meeting_url || '',
        sync_to_calendar: Boolean(session.calendar_event_id),
        generate_tasks: false,
      })
    } else {
      setEditingSession(null)
      const now = new Date()
      now.setMinutes(0, 0, 0)
      now.setHours(now.getHours() + 1)
      const defaultStart = now.toISOString().slice(0, 16)
      const defaultEnd = new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 16)

      setSessionForm({
        session_title: '',
        template_id: selectedCourse.templates[0]?.id || '',
        scheduled_start: defaultStart,
        scheduled_end: defaultEnd,
        actual_duration_minutes: 60,
        status: 'scheduled',
        notes: '',
        location: '',
        meeting_url: '',
        sync_to_calendar: true,
        generate_tasks: selectedCourse.templates.length > 0,
      })
    }
    setIsSessionModalOpen(true)
  }

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCourse) return
    setIsSubmitting(true)

    try {
      const startIso = new Date(sessionForm.scheduled_start).toISOString()
      const endIso = sessionForm.scheduled_end ? new Date(sessionForm.scheduled_end).toISOString() : null

      if (editingSession) {
        const res = await updateTrainingSessionAction({
          id: editingSession.id,
          session_title: sessionForm.session_title,
          template_id: sessionForm.template_id || null,
          scheduled_start: startIso,
          scheduled_end: endIso,
          timezone: userTimezone,
          actual_duration_minutes: Number(sessionForm.actual_duration_minutes) || null,
          status: sessionForm.status,
          notes: sessionForm.notes || null,
          location: sessionForm.location || null,
          meeting_url: sessionForm.meeting_url || null,
        })

        if (!res.success) {
          toast({ title: 'Update failed', message: res.error, type: 'error' })
          return
        }

        setCourses((prev) =>
          prev.map((c) => {
            if (c.id !== selectedCourse.id) return c
            return {
              ...c,
              sessions: c.sessions.map((s) => (s.id === editingSession.id ? res.data! : s)),
            }
          })
        )
        toast({ title: 'Session updated', type: 'success' })
      } else {
        const res = await createTrainingSessionAction({
          course_id: selectedCourse.id,
          template_id: sessionForm.template_id || null,
          session_title: sessionForm.session_title,
          scheduled_start: startIso,
          scheduled_end: endIso,
          timezone: userTimezone,
          actual_duration_minutes: Number(sessionForm.actual_duration_minutes) || null,
          status: sessionForm.status,
          notes: sessionForm.notes || null,
          location: sessionForm.location || null,
          meeting_url: sessionForm.meeting_url || null,
          sync_to_calendar: sessionForm.sync_to_calendar,
          generate_tasks: sessionForm.generate_tasks,
        })

        if (!res.success) {
          toast({ title: 'Session creation failed', message: res.error, type: 'error' })
          return
        }

        setCourses((prev) =>
          prev.map((c) => {
            if (c.id !== selectedCourse.id) return c
            return {
              ...c,
              sessions: [...c.sessions, res.data!],
              progress: {
                ...c.progress,
                totalSessions: c.progress.totalSessions + 1,
              },
            }
          })
        )
        toast({ title: 'Session scheduled', type: 'success' })
      }
      setIsSessionModalOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return
    const res = await deleteTrainingSessionAction(sessionId)
    if (!res.success) {
      toast({ title: 'Failed to delete session', message: res.error, type: 'error' })
      return
    }
    setCourses((prev) =>
      prev.map((c) => (c.id === selectedCourseId ? { ...c, sessions: c.sessions.filter((s) => s.id !== sessionId) } : c))
    )
    toast({ title: 'Session removed', type: 'success' })
  }

  const handleGenerateTasks = async (session: TrainingSession) => {
    if (!selectedCourse) return
    const templateId = session.template_id || selectedCourse.templates[0]?.id
    if (!templateId) {
      toast({
        title: 'No template linked',
        message: 'Please associate a checklist template with this session first.',
        type: 'error',
      })
      return
    }

    setIsSubmitting(true)
    try {
      const res = await generateTasksFromSessionTemplateAction({
        session_id: session.id,
        course_id: selectedCourse.id,
        template_id: templateId,
      })

      if (!res.success) {
        toast({ title: 'Task generation failed', message: res.error, type: 'error' })
        return
      }

      const { createdCount, tasks } = res.data!
      setCourses((prev) =>
        prev.map((c) => {
          if (c.id !== selectedCourse.id) return c
          // Merge unique tasks
          const existingIds = new Set(c.tasks.map((t) => t.id))
          const fresh = tasks.filter((t) => !existingIds.has(t.id))
          return {
            ...c,
            tasks: [...fresh, ...c.tasks],
            progress: {
              ...c.progress,
              totalTasks: c.progress.totalTasks + createdCount,
            },
          }
        })
      )

      toast({
        title: createdCount > 0 ? `Created ${createdCount} task instances` : 'Tasks already up-to-date',
        message: 'Tasks are linked canonically in your Tasks board and My Day.',
        type: 'success',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleTask = async (task: Task) => {
    if (!selectedCourse) return
    const res = await toggleTaskCompletionAction(task.id)
    if (!res.success) {
      toast({ title: 'Failed to update task', message: res.error, type: 'error' })
      return
    }
    setCourses((prev) =>
      prev.map((c) => {
        if (c.id !== selectedCourse.id) return c
        const updatedTasks = c.tasks.map((t) => (t.id === task.id ? res.data! : t))
        const completed = updatedTasks.filter((t) => t.status === 'completed').length
        return {
          ...c,
          tasks: updatedTasks,
          progress: {
            ...c.progress,
            completedTasks: completed,
          },
        }
      })
    )
  }

  // Aggregate stats
  const totalCourses = courses.length
  const activeCourses = courses.filter((c) => c.status === 'active').length
  const totalTargetHours = courses.reduce((sum, c) => sum + (c.target_hours ? Number(c.target_hours) : 0), 0)
  const totalLoggedHours = courses.reduce((sum, c) => sum + (c.progress?.estimatedHoursLogged || 0), 0)

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {selectedCourse ? (
            <button
              onClick={() => setSelectedCourseId(null)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="p-2.5 rounded-xl bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 text-[#9E91FF]">
              <GraduationCap className="w-6 h-6" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {selectedCourse ? selectedCourse.title : 'Training Courses & Routines'}
              </h1>
              {selectedCourse && getStatusBadge(selectedCourse.status)}
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              {selectedCourse
                ? selectedCourse.provider || selectedCourse.category || 'Course Workspace & Checklists'
                : 'Structured training programs, reusable checklist templates, and scheduled sessions.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {selectedCourse ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleOpenCourseModal(selectedCourse)}
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit Course</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleOpenSessionModal()}
              >
                <Plus className="w-4 h-4" />
                <span>Schedule Session</span>
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="md"
              onClick={() => handleOpenCourseModal()}
            >
              <Plus className="w-4 h-4" />
              <span>New Course</span>
            </Button>
          )}
        </div>
      </div>

      {/* Overview Cards (when viewing all courses) */}
      {!selectedCourse && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <Card className="p-4 bg-[#101522]/70 border-white/10">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Courses
              </span>
              <p className="text-2xl font-bold text-white mt-1">{totalCourses}</p>
            </Card>
            <Card className="p-4 bg-[#101522]/70 border-white/10">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Active Programs
              </span>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{activeCourses}</p>
            </Card>
            <Card className="p-4 bg-[#101522]/70 border-white/10">
              <span className="text-xs font-semibold text-[#9E91FF] uppercase tracking-wider">
                Hours Logged
              </span>
              <p className="text-2xl font-bold text-[#9E91FF] mt-1">{totalLoggedHours}h</p>
            </Card>
            <Card className="p-4 bg-[#101522]/70 border-white/10">
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                Target Hours
              </span>
              <p className="text-2xl font-bold text-cyan-400 mt-1">{totalTargetHours}h</p>
            </Card>
          </div>

          {courses.length === 0 ? (
            <Card className="p-12 text-center border-dashed border-white/10 space-y-4 max-w-xl mx-auto my-8">
              <div className="w-12 h-12 rounded-2xl bg-[#8B7CFF]/10 border border-[#8B7CFF]/20 flex items-center justify-center mx-auto text-[#9E91FF]">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">No Training Courses Yet</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
                Organize professional certifications, university courses, fitness regimens, or corporate skill tracks with reusable checklist templates and time-blocked sessions.
              </p>
              <Button variant="primary" size="sm" onClick={() => handleOpenCourseModal()}>
                <Plus className="w-4 h-4 mr-1.5" />
                <span>Create Your First Course</span>
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map((course) => {
                const totalTasks = course.progress?.totalTasks || 0
                const completedTasks = course.progress?.completedTasks || 0
                const taskPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

                return (
                  <Card
                    key={course.id}
                    className="p-5 bg-[#121929]/80 border-white/10 hover:border-[#8B7CFF]/40 transition-all cursor-pointer flex flex-col justify-between group"
                    onClick={() => setSelectedCourseId(course.id)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-white text-base group-hover:text-[#9E91FF] transition-colors">
                            {course.title}
                          </h3>
                          {course.provider && (
                            <p className="text-xs text-slate-400 mt-0.5">{course.provider}</p>
                          )}
                        </div>
                        {getStatusBadge(course.status)}
                      </div>

                      {course.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {course.description}
                        </p>
                      )}

                      <div className="pt-2 border-t border-white/5 space-y-2 text-xs text-slate-400">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            Target Hours
                          </span>
                          <span className="text-slate-200 font-medium">
                            {course.progress?.estimatedHoursLogged || 0}h / {course.target_hours || 0}h
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                            Tasks Completed
                          </span>
                          <span className="text-slate-200 font-medium">
                            {completedTasks} / {totalTasks} ({taskPercent}%)
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-[#8B7CFF] h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, taskPercent)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                      <span>{course.sessions?.length || 0} Sessions &bull; {course.templates?.length || 0} Templates</span>
                      <span className="flex items-center gap-1 text-[#9E91FF] font-semibold group-hover:translate-x-0.5 transition-transform">
                        Explore <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Course Detail View */}
      {selectedCourse && (
        <div className="space-y-6">
          {/* Tabs Navigation */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'overview'
                  ? 'bg-[#8B7CFF]/20 text-white border border-[#8B7CFF]/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Overview &amp; Notes
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'templates'
                  ? 'bg-[#8B7CFF]/20 text-white border border-[#8B7CFF]/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Checklist Templates ({selectedCourse.templates.length})
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'sessions'
                  ? 'bg-[#8B7CFF]/20 text-white border border-[#8B7CFF]/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sessions ({selectedCourse.sessions.length})
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'tasks'
                  ? 'bg-[#8B7CFF]/20 text-white border border-[#8B7CFF]/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Canonical Tasks ({selectedCourse.tasks.length})
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-6 bg-[#121929]/80 border-white/10 space-y-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#9E91FF]" />
                    <span>Course Description &amp; Structure</span>
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {selectedCourse.description || 'No description provided for this course.'}
                  </p>

                  {selectedCourse.personal_notes && (
                    <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Personal Study Notes
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-white/5 p-3 rounded-lg border border-white/5">
                        {selectedCourse.personal_notes}
                      </p>
                    </div>
                  )}
                </Card>

                {/* Quick Upcoming Sessions */}
                <Card className="p-6 bg-[#121929]/80 border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-cyan-400" />
                      <span>Upcoming Training Sessions</span>
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveTab('sessions')}
                      className="text-xs text-[#9E91FF]"
                    >
                      View all ({selectedCourse.sessions.length})
                    </Button>
                  </div>

                  {selectedCourse.sessions.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No sessions scheduled yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedCourse.sessions.slice(0, 3).map((session) => (
                        <div
                          key={session.id}
                          className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between gap-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-white">{session.session_title}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {new Date(session.scheduled_start).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          {getSessionStatusBadge(session.status)}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* Sidebar Stats */}
              <div className="space-y-6">
                <Card className="p-6 bg-[#121929]/80 border-white/10 space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Program Metrics
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Status</span>
                      {getStatusBadge(selectedCourse.status)}
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Provider</span>
                      <span className="font-medium text-white">{selectedCourse.provider || 'Independent'}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Category</span>
                      <span className="font-medium text-white">{selectedCourse.category || 'General'}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Target Hours</span>
                      <span className="font-medium text-white">{selectedCourse.target_hours || 0}h</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Hours Logged</span>
                      <span className="font-medium text-emerald-400">
                        {selectedCourse.progress?.estimatedHoursLogged || 0}h
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Date Range</span>
                      <span className="font-medium text-slate-400">
                        {selectedCourse.start_date || 'Start'} &rarr; {selectedCourse.end_date || 'Ongoing'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5 flex items-center gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => handleDeleteCourse(selectedCourse.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      <span>Delete Course</span>
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 2: TEMPLATES & REUSABLE CHECKLISTS */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Reusable Checklist Templates</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Define standardized sequences, seminar preps, or lab tasks. Editing a template never mutates previously generated tasks.
                  </p>
                </div>
                <Button variant="primary" size="sm" onClick={() => handleOpenTemplateModal()}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  <span>New Template</span>
                </Button>
              </div>

              {selectedCourse.templates.length === 0 ? (
                <Card className="p-8 text-center border-dashed border-white/10 space-y-3">
                  <Layers className="w-8 h-8 text-slate-500 mx-auto" />
                  <h4 className="text-sm font-bold text-white">No Templates Defined</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Create a reusable checklist template with due offsets (e.g. 1 day before seminar) to instantiate tasks with a single click.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => handleOpenTemplateModal()}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Create Template
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedCourse.templates.map((template) => (
                    <Card key={template.id} className="p-5 bg-[#121929]/80 border-white/10 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-white text-sm">{template.template_name}</h4>
                          {template.description && (
                            <p className="text-xs text-slate-400 mt-0.5">{template.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenTemplateModal(template)}
                            className="p-1 rounded text-slate-400 hover:text-white"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 border-t border-white/5 pt-3">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          Checklist Items ({template.items.length})
                        </span>
                        <div className="space-y-1.5">
                          {template.items.map((item, idx) => (
                            <div
                              key={item.id || idx}
                              className="text-xs text-slate-300 flex items-center justify-between p-2 rounded-lg bg-white/5"
                            >
                              <span className="font-medium truncate max-w-[200px]">
                                {item.sort_order}. {item.task_title}
                              </span>
                              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                                <span>{item.estimated_duration_minutes}m</span>
                                <Badge variant="neutral">
                                  {item.due_offset_days === 0
                                    ? 'Day of'
                                    : item.due_offset_days < 0
                                    ? `${Math.abs(item.due_offset_days)}d before`
                                    : `+${item.due_offset_days}d after`}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SESSIONS */}
          {activeTab === 'sessions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Course Training Sessions</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Schedule lectures, seminars, practical workouts, and meetings with optional calendar sync and task instantiation.
                  </p>
                </div>
                <Button variant="primary" size="sm" onClick={() => handleOpenSessionModal()}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  <span>Schedule Session</span>
                </Button>
              </div>

              {selectedCourse.sessions.length === 0 ? (
                <Card className="p-8 text-center border-dashed border-white/10 space-y-3">
                  <Calendar className="w-8 h-8 text-slate-500 mx-auto" />
                  <h4 className="text-sm font-bold text-white">No Sessions Scheduled</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Add upcoming dates for workshops, training blocks, or study sessions.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => handleOpenSessionModal()}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Schedule Session
                  </Button>
                </Card>
              ) : (
                <div className="space-y-3">
                  {selectedCourse.sessions.map((session) => (
                    <Card
                      key={session.id}
                      className="p-4 bg-[#121929]/80 border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <h4 className="font-bold text-white text-sm">{session.session_title}</h4>
                          {getSessionStatusBadge(session.status)}
                          {session.calendar_event_id && (
                            <Badge variant="violet" size="sm">
                              Synced to Calendar
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            {new Date(session.scheduled_start).toLocaleString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                          {session.actual_duration_minutes && (
                            <span>{session.actual_duration_minutes} mins</span>
                          )}
                          {session.meeting_url && (
                            <a
                              href={session.meeting_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-[#9E91FF] hover:underline"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>Join Meeting</span>
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {session.template_id && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="text-xs text-cyan-300"
                            onClick={() => handleGenerateTasks(session)}
                            disabled={isSubmitting}
                          >
                            <Sparkles className="w-3.5 h-3.5 mr-1" />
                            <span>Generate Tasks</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenSessionModal(session)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSession(session.id)}
                          className="hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CANONICAL TASKS */}
          {activeTab === 'tasks' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-white">Canonical Course Tasks</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tasks generated from session checklist templates live directly in the central tasks system and appear in My Day and Task lists.
                </p>
              </div>

              {selectedCourse.tasks.length === 0 ? (
                <Card className="p-8 text-center border-dashed border-white/10 space-y-3">
                  <ListTodo className="w-8 h-8 text-slate-500 mx-auto" />
                  <h4 className="text-sm font-bold text-white">No Tasks Generated</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Go to the Sessions tab and click &quot;Generate Tasks&quot; on any session with an attached template.
                  </p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {selectedCourse.tasks.map((task) => {
                    const isCompleted = task.status === 'completed'
                    return (
                      <div
                        key={task.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                          isCompleted
                            ? 'bg-white/[0.02] border-white/5 opacity-60'
                            : 'bg-[#121929]/80 border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleToggleTask(task)}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                              isCompleted
                                ? 'bg-emerald-500 border-emerald-500 text-black'
                                : 'border-white/20 hover:border-[#8B7CFF]'
                            }`}
                          >
                            {isCompleted && <CheckCircle2 className="w-4 h-4 text-white" />}
                          </button>
                          <div>
                            <p
                              className={`text-sm font-medium ${
                                isCompleted ? 'line-through text-slate-500' : 'text-white'
                              }`}
                            >
                              {task.title}
                            </p>
                            {task.deadline_at && (
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Due: {new Date(task.deadline_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              task.priority === 'p1'
                                ? 'danger'
                                : task.priority === 'p2'
                                ? 'warning'
                                : 'neutral'
                            }
                            size="sm"
                          >
                            {task.priority.toUpperCase()}
                          </Badge>
                          {task.estimated_duration_minutes && (
                            <span className="text-xs text-slate-400">
                              {task.estimated_duration_minutes}m
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL: CREATE / EDIT COURSE */}
      <Modal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        title={editingCourse ? 'Edit Course' : 'Create Training Course'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveCourse} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Course Title *</label>
            <Input
              value={courseForm.title}
              onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
              placeholder="e.g. Master's Applied Data Science or Marathon Training"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Provider / Organization</label>
              <Input
                value={courseForm.provider}
                onChange={(e) => setCourseForm({ ...courseForm, provider: e.target.value })}
                placeholder="e.g. Stanford Online, Coursera"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Category</label>
              <Input
                value={courseForm.category}
                onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })}
                placeholder="e.g. Tech, Health, Management"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Status</label>
              <select
                value={courseForm.status}
                onChange={(e) =>
                  setCourseForm({ ...courseForm, status: e.target.value as TrainingCourse['status'] })
                }
                className="w-full bg-[#182238] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#8B7CFF]"
              >
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Target Hours</label>
              <Input
                type="number"
                value={courseForm.target_hours.toString()}
                onChange={(e) =>
                  setCourseForm({ ...courseForm, target_hours: Number(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Start Date</label>
              <Input
                type="date"
                value={courseForm.start_date}
                onChange={(e) => setCourseForm({ ...courseForm, start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">End Date</label>
              <Input
                type="date"
                value={courseForm.end_date}
                onChange={(e) => setCourseForm({ ...courseForm, end_date: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Description</label>
            <textarea
              value={courseForm.description}
              onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
              rows={2}
              className="w-full bg-[#182238] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#8B7CFF]"
              placeholder="Objectives, syllabus, or learning outcomes..."
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Personal Notes</label>
            <textarea
              value={courseForm.personal_notes}
              onChange={(e) => setCourseForm({ ...courseForm, personal_notes: e.target.value })}
              rows={3}
              className="w-full bg-[#182238] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#8B7CFF]"
              placeholder="Study reminders, key milestones, resources..."
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCourseModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              {editingCourse ? 'Save Changes' : 'Create Course'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: CREATE / EDIT CHECKLIST TEMPLATE */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title={editingTemplate ? 'Edit Checklist Template' : 'New Checklist Template'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveTemplate} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Template Name *</label>
            <Input
              value={templateForm.template_name}
              onChange={(e) => setTemplateForm({ ...templateForm, template_name: e.target.value })}
              placeholder="e.g. Pre-Lecture Prep Checklist"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Description</label>
            <Input
              value={templateForm.description}
              onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
              placeholder="Optional context for when to instantiate this template"
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Checklist Items</label>
              <button
                type="button"
                onClick={() =>
                  setTemplateForm({
                    ...templateForm,
                    items: [
                      ...templateForm.items,
                      {
                        task_title: '',
                        estimated_duration_minutes: 15,
                        sort_order: templateForm.items.length + 1,
                        is_mandatory: true,
                        due_offset_days: 0,
                        relative_to: 'session_start',
                      },
                    ],
                  })
                }
                className="text-xs text-[#9E91FF] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {templateForm.items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-bold w-4">{idx + 1}.</span>
                    <input
                      type="text"
                      value={item.task_title}
                      onChange={(e) => {
                        const updated = [...templateForm.items]
                        updated[idx].task_title = e.target.value
                        setTemplateForm({ ...templateForm, items: updated })
                      }}
                      placeholder="Item task title..."
                      className="flex-1 bg-[#182238] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#8B7CFF]"
                    />
                    {templateForm.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = templateForm.items.filter((_, i) => i !== idx)
                          setTemplateForm({ ...templateForm, items: updated })
                        }}
                        className="p-1 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-slate-400 pl-6">
                    <div className="flex items-center gap-1.5">
                      <span>Duration:</span>
                      <input
                        type="number"
                        value={item.estimated_duration_minutes}
                        onChange={(e) => {
                          const updated = [...templateForm.items]
                          updated[idx].estimated_duration_minutes = Number(e.target.value) || 15
                          setTemplateForm({ ...templateForm, items: updated })
                        }}
                        className="w-14 bg-[#182238] border border-white/10 rounded px-1.5 py-0.5 text-xs text-white"
                      />
                      <span>mins</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span>Due offset:</span>
                      <input
                        type="number"
                        value={item.due_offset_days}
                        onChange={(e) => {
                          const updated = [...templateForm.items]
                          updated[idx].due_offset_days = Number(e.target.value) || 0
                          setTemplateForm({ ...templateForm, items: updated })
                        }}
                        className="w-12 bg-[#182238] border border-white/10 rounded px-1.5 py-0.5 text-xs text-white"
                      />
                      <span>days</span>
                    </div>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.is_mandatory}
                        onChange={(e) => {
                          const updated = [...templateForm.items]
                          updated[idx].is_mandatory = e.target.checked
                          setTemplateForm({ ...templateForm, items: updated })
                        }}
                        className="rounded border-white/20"
                      />
                      <span>Mandatory</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-tight">
            * Note: Editing template items will not alter previously generated task instances in your workspace.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsTemplateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Save Template
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: CREATE / EDIT SESSION */}
      <Modal
        isOpen={isSessionModalOpen}
        onClose={() => setIsSessionModalOpen(false)}
        title={editingSession ? 'Edit Training Session' : 'Schedule Training Session'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveSession} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Session Title *</label>
            <Input
              value={sessionForm.session_title}
              onChange={(e) => setSessionForm({ ...sessionForm, session_title: e.target.value })}
              placeholder="e.g. Lab 4: Recurrent Neural Networks"
              required
            />
          </div>

          {selectedCourse && selectedCourse.templates.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Link Checklist Template
              </label>
              <select
                value={sessionForm.template_id}
                onChange={(e) => setSessionForm({ ...sessionForm, template_id: e.target.value })}
                className="w-full bg-[#182238] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#8B7CFF]"
              >
                <option value="">No Template</option>
                {selectedCourse.templates.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    {tmpl.template_name} ({tmpl.items.length} items)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Start Datetime *</label>
              <Input
                type="datetime-local"
                value={sessionForm.scheduled_start}
                onChange={(e) => setSessionForm({ ...sessionForm, scheduled_start: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">End Datetime</label>
              <Input
                type="datetime-local"
                value={sessionForm.scheduled_end}
                onChange={(e) => setSessionForm({ ...sessionForm, scheduled_end: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Duration (minutes)</label>
              <Input
                type="number"
                value={sessionForm.actual_duration_minutes.toString()}
                onChange={(e) =>
                  setSessionForm({
                    ...sessionForm,
                    actual_duration_minutes: Number(e.target.value) || 60,
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Status</label>
              <select
                value={sessionForm.status}
                onChange={(e) =>
                  setSessionForm({
                    ...sessionForm,
                    status: e.target.value as TrainingSession['status'],
                  })
                }
                className="w-full bg-[#182238] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#8B7CFF]"
              >
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Location</label>
              <Input
                value={sessionForm.location}
                onChange={(e) => setSessionForm({ ...sessionForm, location: e.target.value })}
                placeholder="Room 302 or Home Office"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Meeting URL</label>
              <Input
                value={sessionForm.meeting_url}
                onChange={(e) => setSessionForm({ ...sessionForm, meeting_url: e.target.value })}
                placeholder="https://meet.google.com/..."
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Notes</label>
            <textarea
              value={sessionForm.notes}
              onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })}
              rows={2}
              className="w-full bg-[#182238] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#8B7CFF]"
              placeholder="Agenda items, required readings, materials..."
            />
          </div>

          {!editingSession && (
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={sessionForm.sync_to_calendar}
                  onChange={(e) =>
                    setSessionForm({ ...sessionForm, sync_to_calendar: e.target.checked })
                  }
                  className="rounded border-white/20"
                />
                <span>Sync session as an appointment on your DayFlow Calendar</span>
              </label>

              {sessionForm.template_id && (
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={sessionForm.generate_tasks}
                    onChange={(e) =>
                      setSessionForm({ ...sessionForm, generate_tasks: e.target.checked })
                    }
                    className="rounded border-white/20"
                  />
                  <span>Generate checklist task instances in your workspace immediately</span>
                </label>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSessionModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              {editingSession ? 'Update Session' : 'Schedule Session'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
