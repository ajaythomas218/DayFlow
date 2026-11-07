'use client'

import React, { useState } from 'react'
import {
  GraduationCap,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  Edit2,
  Bell,
  Calendar,
  ShieldCheck,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import {
  createStudentReviewAction,
  updateStudentReviewAction,
  deleteStudentReviewAction,
  createReviewFollowUpTaskAction,
  configureExternalRiskTrackerReminderAction,
  StudentReviewWithDetails,
} from '@/lib/actions/student-reviews'
import { toggleTaskCompletionAction } from '@/lib/actions/tasks'
import { StudentReview, TrainingCourse } from '@/types'

interface StudentReviewsClientProps {
  initialReviews: StudentReviewWithDetails[]
  courses: TrainingCourse[]
  initialReminderConfig: { enabled: boolean; schedule: string }
}

export function StudentReviewsClient({
  initialReviews,
  courses,
  initialReminderConfig,
}: StudentReviewsClientProps) {
  const { toast } = useToast()
  const [reviews, setReviews] = useState<StudentReviewWithDetails[]>(initialReviews)
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [editingReview, setEditingReview] = useState<StudentReview | null>(null)

  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false)
  const [followUpReview, setFollowUpReview] = useState<StudentReview | null>(null)

  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false)
  const [reminderConfig, setReminderConfig] = useState(initialReminderConfig)

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Review Form
  const [reviewForm, setReviewForm] = useState({
    student_identifier: '',
    assignment_title: '',
    course_id: '',
    submission_date: new Date().toISOString().slice(0, 10),
    status: 'awaiting_review' as StudentReview['status'],
    feedback_notes: '',
    score_or_grade: '',
    external_system_link: '',
    external_risk_check_prompted: false,
  })

  // Follow-up Task Form
  const [followUpForm, setFollowUpForm] = useState({
    title: '',
    deadline_at: '',
    priority: 'p2' as 'p1' | 'p2' | 'p3' | 'p4',
    description: '',
  })

  // Reminder Configuration Form
  const [reminderForm, setReminderForm] = useState({
    frequency: 'weekly' as 'daily' | 'weekly' | 'biweekly' | 'monthly',
    time_of_day: '09:00',
    enabled: reminderConfig.enabled,
  })

  const getStatusBadge = (status: StudentReview['status']) => {
    switch (status) {
      case 'awaiting_review':
        return <Badge variant="warning">Awaiting Review</Badge>
      case 'in_review':
        return <Badge variant="cyan">In Review</Badge>
      case 'feedback_ready':
        return <Badge variant="violet">Feedback Ready</Badge>
      case 'completed':
        return <Badge variant="success">Completed</Badge>
      case 'needs_follow_up':
        return <Badge variant="danger">Needs Follow-Up</Badge>
      case 'pending':
        return <Badge variant="neutral">Pending</Badge>
      default:
        return <Badge variant="neutral">{status}</Badge>
    }
  }

  // Filtered reviews
  const filteredReviews = reviews.filter((r) => {
    if (selectedStatus !== 'all' && r.status !== selectedStatus) return false
    if (selectedCourseId !== 'all' && r.course_id !== selectedCourseId) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchId = r.student_identifier.toLowerCase().includes(q)
      const matchTitle = r.assignment_title.toLowerCase().includes(q)
      const matchNotes = (r.feedback_notes || '').toLowerCase().includes(q)
      if (!matchId && !matchTitle && !matchNotes) return false
    }
    return true
  })

  // Review Modal Handlers
  const handleOpenReviewModal = (review?: StudentReview) => {
    if (review) {
      setEditingReview(review)
      setReviewForm({
        student_identifier: review.student_identifier,
        assignment_title: review.assignment_title,
        course_id: review.course_id || '',
        submission_date: review.submission_date.slice(0, 10),
        status: review.status,
        feedback_notes: review.feedback_notes || '',
        score_or_grade: review.score_or_grade || '',
        external_system_link: review.external_system_link || '',
        external_risk_check_prompted: review.external_risk_check_prompted,
      })
    } else {
      setEditingReview(null)
      setReviewForm({
        student_identifier: '',
        assignment_title: '',
        course_id: courses[0]?.id || '',
        submission_date: new Date().toISOString().slice(0, 10),
        status: 'awaiting_review',
        feedback_notes: '',
        score_or_grade: '',
        external_system_link: '',
        external_risk_check_prompted: false,
      })
    }
    setIsReviewModalOpen(true)
  }

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (editingReview) {
        const res = await updateStudentReviewAction({
          id: editingReview.id,
          ...reviewForm,
          course_id: reviewForm.course_id || null,
          external_system_link: reviewForm.external_system_link || null,
        })

        if (!res.success) {
          toast({ title: 'Update failed', message: res.error, type: 'error' })
          return
        }

        const linkedCourse = courses.find((c) => c.id === res.data!.course_id)
        setReviews((prev) =>
          prev.map((r) =>
            r.id === editingReview.id
              ? {
                  ...r,
                  ...res.data!,
                  course: linkedCourse ? { id: linkedCourse.id, title: linkedCourse.title } : null,
                }
              : r
          )
        )
        toast({ title: 'Review updated', type: 'success' })
      } else {
        const res = await createStudentReviewAction({
          ...reviewForm,
          course_id: reviewForm.course_id || null,
          external_system_link: reviewForm.external_system_link || null,
        })

        if (!res.success) {
          toast({ title: 'Creation failed', message: res.error, type: 'error' })
          return
        }

        const linkedCourse = courses.find((c) => c.id === res.data!.course_id)
        const newReviewWithDetails: StudentReviewWithDetails = {
          ...res.data!,
          course: linkedCourse ? { id: linkedCourse.id, title: linkedCourse.title } : null,
          follow_up_task: null,
        }

        setReviews((prev) => [newReviewWithDetails, ...prev])
        toast({ title: 'Student review logged', type: 'success' })
      }
      setIsReviewModalOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review record?')) return
    const res = await deleteStudentReviewAction(reviewId)
    if (!res.success) {
      toast({ title: 'Delete failed', message: res.error, type: 'error' })
      return
    }
    setReviews((prev) => prev.filter((r) => r.id !== reviewId))
    toast({ title: 'Review deleted', type: 'success' })
  }

  // Quick Status Transition
  const handleQuickStatusChange = async (
    reviewId: string,
    nextStatus: StudentReview['status']
  ) => {
    const res = await updateStudentReviewAction({
      id: reviewId,
      status: nextStatus,
    })
    if (!res.success) {
      toast({ title: 'Status change failed', message: res.error, type: 'error' })
      return
    }
    setReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, ...res.data! } : r))
    )
    toast({ title: `Moved to ${nextStatus.replace('_', ' ')}`, type: 'success' })
  }

  // Follow-up Task Modal Handlers
  const handleOpenFollowUpModal = (review: StudentReview) => {
    setFollowUpReview(review)
    const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
    setFollowUpForm({
      title: `Follow-up with ${review.student_identifier}: ${review.assignment_title}`,
      deadline_at: in3Days,
      priority: 'p2',
      description: `Follow-up action regarding submitted assignment "${review.assignment_title}".`,
    })
    setIsFollowUpModalOpen(true)
  }

  const handleSaveFollowUpTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!followUpReview) return
    setIsSubmitting(true)

    try {
      const res = await createReviewFollowUpTaskAction({
        review_id: followUpReview.id,
        title: followUpForm.title,
        deadline_at: followUpForm.deadline_at ? new Date(followUpForm.deadline_at).toISOString() : null,
        priority: followUpForm.priority,
        description: followUpForm.description,
      })

      if (!res.success) {
        toast({ title: 'Failed to create task', message: res.error, type: 'error' })
        return
      }

      const { task, review } = res.data!
      setReviews((prev) =>
        prev.map((r) =>
          r.id === followUpReview.id
            ? {
                ...r,
                ...review,
                follow_up_task: {
                  id: task.id,
                  title: task.title,
                  status: task.status,
                  deadline_at: task.deadline_at,
                },
              }
            : r
        )
      )

      setIsFollowUpModalOpen(false)
      toast({
        title: 'Canonical follow-up task created',
        message: 'Task is added to your tasks board and My Day view.',
        type: 'success',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Toggle follow-up task completion
  const handleToggleFollowUpTask = async (taskId: string, reviewId: string) => {
    const res = await toggleTaskCompletionAction(taskId)
    if (!res.success) {
      toast({ title: 'Task toggle failed', message: res.error, type: 'error' })
      return
    }

    setReviews((prev) =>
      prev.map((r) => {
        if (r.id !== reviewId || !r.follow_up_task) return r
        return {
          ...r,
          follow_up_task: {
            ...r.follow_up_task,
            status: res.data!.status,
          },
        }
      })
    )
  }

  // Reminder Configuration
  const handleSaveReminderConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const res = await configureExternalRiskTrackerReminderAction({
        frequency: reminderForm.frequency,
        time_of_day: reminderForm.time_of_day,
        enabled: reminderForm.enabled,
      })

      if (!res.success) {
        toast({ title: 'Configuration failed', message: res.error, type: 'error' })
        return
      }

      setReminderConfig(res.data!)
      setIsReminderModalOpen(false)
      toast({
        title: 'Reminder schedule updated',
        message: res.data!.enabled
          ? `Prompting manual checks on external tracker (${res.data!.schedule})`
          : 'External tracker manual check reminder disabled.',
        type: 'success',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Metric counts
  const awaitingCount = reviews.filter((r) => r.status === 'awaiting_review').length
  const inReviewCount = reviews.filter((r) => r.status === 'in_review').length
  const feedbackReadyCount = reviews.filter((r) => r.status === 'feedback_ready').length
  const followUpCount = reviews.filter(
    (r) => r.status === 'needs_follow_up' || (r.follow_up_task && r.follow_up_task.status !== 'completed')
  ).length

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Student Assignment Reviews
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-amber-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Strict Privacy &bull; Non-Automated</span>
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              Personal educator grading queue, qualitative feedback notes, and canonical follow-up action items.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsReminderModalOpen(true)}
            className="text-xs"
          >
            <Bell className="w-3.5 h-3.5 text-amber-400 mr-1.5" />
            <span>Risk Check Reminder</span>
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => handleOpenReviewModal()}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>New Review</span>
          </Button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card className="p-4 bg-[#101522]/70 border-white/10">
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
            Awaiting Review
          </span>
          <p className="text-2xl font-bold text-amber-400 mt-1">{awaitingCount}</p>
        </Card>
        <Card className="p-4 bg-[#101522]/70 border-white/10">
          <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
            In Review
          </span>
          <p className="text-2xl font-bold text-cyan-400 mt-1">{inReviewCount}</p>
        </Card>
        <Card className="p-4 bg-[#101522]/70 border-white/10">
          <span className="text-xs font-semibold text-[#9E91FF] uppercase tracking-wider">
            Feedback Ready
          </span>
          <p className="text-2xl font-bold text-[#9E91FF] mt-1">{feedbackReadyCount}</p>
        </Card>
        <Card className="p-4 bg-[#101522]/70 border-white/10">
          <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
            Follow-Ups Due
          </span>
          <p className="text-2xl font-bold text-rose-400 mt-1">{followUpCount}</p>
        </Card>
      </div>

      {/* Pastoral Notice Banner */}
      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-xs text-amber-300/90 leading-relaxed">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-semibold text-amber-200">Pastoral Privacy &amp; External Risk Tracker Note:</span>
          <p>
            DayFlow does not scrape or store external algorithmic student risk profiles. If your institution maintains a student risk tracker, use our recurring notification schedule to manually check the institution portal.
            {reminderConfig.enabled && (
              <span className="ml-1 text-white font-medium">
                (Current schedule: {reminderConfig.schedule})
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search student or assignment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#182238] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#8B7CFF]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="bg-[#182238] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 bg-[#182238] p-1 rounded-xl border border-white/10 text-xs">
            {['all', 'awaiting_review', 'in_review', 'feedback_ready', 'completed', 'needs_follow_up'].map(
              (st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                    selectedStatus === st
                      ? 'bg-[#8B7CFF] text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st === 'all'
                    ? 'All'
                    : st
                        .replace('_', ' ')
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Reviews Queue List */}
      {filteredReviews.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-white/10 space-y-4 max-w-xl mx-auto my-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">No Student Reviews Found</h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
            {searchQuery || selectedStatus !== 'all' || selectedCourseId !== 'all'
              ? 'No reviews match your current filters. Clear the search or status filter to see all records.'
              : 'Keep track of student submissions, personalized qualitative feedback, and follow-up consultation tasks.'}
          </p>
          <Button variant="primary" size="sm" onClick={() => handleOpenReviewModal()}>
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Log First Review</span>
          </Button>
        </Card>
      ) : (
        <div className="space-y-3.5">
          {filteredReviews.map((review) => {
            const hasFollowUp = Boolean(review.follow_up_task)
            const isFollowUpCompleted = review.follow_up_task?.status === 'completed'

            return (
              <Card
                key={review.id}
                className="p-5 bg-[#121929]/80 border-white/10 hover:border-white/20 transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-bold text-white text-base">
                        {review.student_identifier}
                      </span>
                      {getStatusBadge(review.status)}
                      {review.score_or_grade && (
                        <Badge variant="violet" size="sm">
                          Grade: {review.score_or_grade}
                        </Badge>
                      )}
                      {review.course && (
                        <span className="text-xs text-slate-400 font-medium">
                          &bull; {review.course.title}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm text-slate-200 font-semibold">
                      {review.assignment_title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenReviewModal(review)}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteReview(review.id)}
                      className="hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Feedback Notes */}
                {review.feedback_notes && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                    <span className="font-semibold text-slate-400 block text-[11px] uppercase tracking-wider mb-1">
                      Qualitative Feedback
                    </span>
                    {review.feedback_notes}
                  </div>
                )}

                {/* Follow-up Task Banner & External System Link */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/5 text-xs">
                  <div className="flex flex-wrap items-center gap-4 text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Submitted: {new Date(review.submission_date).toLocaleDateString()}
                    </span>

                    {review.external_system_link && (
                      <a
                        href={review.external_system_link}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[#9E91FF] hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>External Portal Check</span>
                      </a>
                    )}
                  </div>

                  {/* Follow-up task status / Action */}
                  <div className="flex items-center gap-2">
                    {hasFollowUp ? (
                      <div className="flex items-center gap-2 bg-[#182238] px-2.5 py-1 rounded-lg border border-white/10">
                        <button
                          onClick={() =>
                            handleToggleFollowUpTask(review.follow_up_task!.id, review.id)
                          }
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            isFollowUpCompleted
                              ? 'bg-emerald-500 border-emerald-500 text-black'
                              : 'border-white/30 hover:border-[#8B7CFF]'
                          }`}
                        >
                          {isFollowUpCompleted && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </button>
                        <span
                          className={`text-xs ${
                            isFollowUpCompleted
                              ? 'line-through text-slate-500'
                              : 'text-slate-200 font-medium'
                          }`}
                        >
                          Follow-up Task
                        </span>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenFollowUpModal(review)}
                        className="text-xs text-amber-300"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        <span>Create Follow-Up</span>
                      </Button>
                    )}

                    {/* Quick State Transitions */}
                    {review.status === 'awaiting_review' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleQuickStatusChange(review.id, 'in_review')}
                      >
                        Start Review
                      </Button>
                    )}

                    {review.status === 'in_review' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-[#9E91FF]"
                        onClick={() => handleQuickStatusChange(review.id, 'feedback_ready')}
                      >
                        Ready Feedback
                      </Button>
                    )}

                    {review.status === 'feedback_ready' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-emerald-400"
                        onClick={() => handleQuickStatusChange(review.id, 'completed')}
                      >
                        Mark Completed
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* MODAL: CREATE / EDIT STUDENT REVIEW */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title={editingReview ? 'Edit Student Review' : 'Log Student Assignment Review'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveReview} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Student Identifier *</label>
            <Input
              value={reviewForm.student_identifier}
              onChange={(e) =>
                setReviewForm({ ...reviewForm, student_identifier: e.target.value })
              }
              placeholder="e.g. Student #3014, or Jane D. (Avoid sensitive PII)"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Assignment Title *</label>
            <Input
              value={reviewForm.assignment_title}
              onChange={(e) => setReviewForm({ ...reviewForm, assignment_title: e.target.value })}
              placeholder="e.g. Midterm Lab Report: Transformer Architectures"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Linked Course
              </label>
              <select
                value={reviewForm.course_id}
                onChange={(e) => setReviewForm({ ...reviewForm, course_id: e.target.value })}
                className="w-full bg-[#182238] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#8B7CFF]"
              >
                <option value="">No Linked Course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Submission Date *</label>
              <Input
                type="date"
                value={reviewForm.submission_date}
                onChange={(e) => setReviewForm({ ...reviewForm, submission_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Status</label>
              <select
                value={reviewForm.status}
                onChange={(e) =>
                  setReviewForm({
                    ...reviewForm,
                    status: e.target.value as StudentReview['status'],
                  })
                }
                className="w-full bg-[#182238] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#8B7CFF]"
              >
                <option value="awaiting_review">Awaiting Review</option>
                <option value="in_review">In Review</option>
                <option value="feedback_ready">Feedback Ready</option>
                <option value="completed">Completed</option>
                <option value="needs_follow_up">Needs Follow-Up</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Score or Grade</label>
              <Input
                value={reviewForm.score_or_grade}
                onChange={(e) => setReviewForm({ ...reviewForm, score_or_grade: e.target.value })}
                placeholder="e.g. 94%, A-, or Pass"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Feedback Notes &amp; Observations
            </label>
            <textarea
              value={reviewForm.feedback_notes}
              onChange={(e) => setReviewForm({ ...reviewForm, feedback_notes: e.target.value })}
              rows={3}
              className="w-full bg-[#182238] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#8B7CFF]"
              placeholder="Strengths demonstrated, areas requiring clarification, notes for 1-on-1 check-in..."
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">External System / Portal Link</label>
            <Input
              value={reviewForm.external_system_link}
              onChange={(e) =>
                setReviewForm({ ...reviewForm, external_system_link: e.target.value })
              }
              placeholder="https://canvas.institution.edu/..."
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsReviewModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              {editingReview ? 'Save Changes' : 'Log Review'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: CREATE FOLLOW-UP TASK */}
      <Modal
        isOpen={isFollowUpModalOpen}
        onClose={() => setIsFollowUpModalOpen(false)}
        title="Create Canonical Follow-Up Task"
        maxWidth="md"
      >
        <form onSubmit={handleSaveFollowUpTask} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Task Title *</label>
            <Input
              value={followUpForm.title}
              onChange={(e) => setFollowUpForm({ ...followUpForm, title: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Deadline</label>
              <Input
                type="datetime-local"
                value={followUpForm.deadline_at}
                onChange={(e) => setFollowUpForm({ ...followUpForm, deadline_at: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Priority</label>
              <select
                value={followUpForm.priority}
                onChange={(e) =>
                  setFollowUpForm({
                    ...followUpForm,
                    priority: e.target.value as 'p1' | 'p2' | 'p3' | 'p4',
                  })
                }
                className="w-full bg-[#182238] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#8B7CFF]"
              >
                <option value="p1">P1 - Urgent</option>
                <option value="p2">P2 - High</option>
                <option value="p3">P3 - Medium</option>
                <option value="p4">P4 - Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Description</label>
            <textarea
              value={followUpForm.description}
              onChange={(e) => setFollowUpForm({ ...followUpForm, description: e.target.value })}
              rows={2}
              className="w-full bg-[#182238] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#8B7CFF]"
              placeholder="Action items or consultation agenda..."
            />
          </div>

          <p className="text-[11px] text-slate-400">
            * This action inserts a canonical record into your DayFlow tasks engine, linking it directly to this student review.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsFollowUpModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Create Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: CONFIGURE EXTERNAL RISK TRACKER REMINDER */}
      <Modal
        isOpen={isReminderModalOpen}
        onClose={() => setIsReminderModalOpen(false)}
        title="External Risk Tracker Reminder Schedule"
        maxWidth="md"
      >
        <form onSubmit={handleSaveReminderConfig} className="space-y-4">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 leading-relaxed">
            Configure a recurring in-app reminder in DayFlow to prompt you to manually inspect your institution&apos;s external student risk tracker.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Frequency</label>
              <select
                value={reminderForm.frequency}
                onChange={(e) =>
                  setReminderForm({
                    ...reminderForm,
                    frequency: e.target.value as 'daily' | 'weekly' | 'biweekly' | 'monthly',
                  })
                }
                className="w-full bg-[#182238] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#8B7CFF]"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Time of Day</label>
              <Input
                type="time"
                value={reminderForm.time_of_day}
                onChange={(e) => setReminderForm({ ...reminderForm, time_of_day: e.target.value })}
                required
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 pt-2">
            <input
              type="checkbox"
              checked={reminderForm.enabled}
              onChange={(e) => setReminderForm({ ...reminderForm, enabled: e.target.checked })}
              className="rounded border-white/20"
            />
            <span>Enable recurring manual check reminder</span>
          </label>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsReminderModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Save Schedule
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
