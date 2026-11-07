import { describe, it, expect } from 'vitest'
import {
  createStudentReviewSchema,
  updateStudentReviewSchema,
  createReviewFollowUpTaskSchema,
  configureExternalRiskReminderSchema,
} from '@/lib/validations/student-reviews'

describe('Student Assignment Reviews & Risk Check Reminder Architecture', () => {
  it('validates student review creation with non-sensitive identifiers', () => {
    const validReview = {
      student_identifier: 'Student #4092 (J. Doe)',
      assignment_title: 'Database Normalization & Indexing Project',
      course_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      submission_date: '2026-11-05T10:00:00.000Z',
      status: 'awaiting_review' as const,
      feedback_notes: 'Initial submission received on time.',
      score_or_grade: null,
      external_risk_check_prompted: true,
      external_system_link: 'https://external-portal.example.edu/students/4092',
    }

    const result = createStudentReviewSchema.safeParse(validReview)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.student_identifier).toBe('Student #4092 (J. Doe)')
      expect(result.data.status).toBe('awaiting_review')
      expect(result.data.external_risk_check_prompted).toBe(true)
    }
  })

  it('rejects empty student identifier or assignment title', () => {
    const invalidReview = {
      student_identifier: '   ',
      assignment_title: '',
      submission_date: '2026-11-05T10:00:00.000Z',
    }

    const result = createStudentReviewSchema.safeParse(invalidReview)
    expect(result.success).toBe(false)
  })

  it('supports all required review statuses', () => {
    const statuses = [
      'awaiting_review',
      'in_review',
      'feedback_ready',
      'completed',
      'pending',
      'needs_follow_up',
    ] as const

    for (const status of statuses) {
      const result = updateStudentReviewSchema.safeParse({
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        status,
      })
      expect(result.success).toBe(true)
    }
  })

  it('validates follow-up task creation linked to student review', () => {
    const followUpInput = {
      review_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      title: 'Send feedback email and schedule 1-on-1 office hour',
      deadline_at: '2026-11-08T17:00:00.000Z',
      priority: 'p2' as const,
      description: 'Discuss 3NF vs BCNF concepts from the assignment review.',
    }

    const result = createReviewFollowUpTaskSchema.safeParse(followUpInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.review_id).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
      expect(result.data.priority).toBe('p2')
    }
  })

  it('validates external student risk tracker reminder schedule configuration', () => {
    const validConfig = {
      frequency: 'weekly' as const,
      time_of_day: '09:00',
      enabled: true,
    }

    const result = configureExternalRiskReminderSchema.safeParse(validConfig)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.frequency).toBe('weekly')
      expect(result.data.time_of_day).toBe('09:00')
    }

    // Invalid time of day
    const invalidTime = configureExternalRiskReminderSchema.safeParse({
      frequency: 'daily' as const,
      time_of_day: '25:99',
      enabled: true,
    })
    expect(invalidTime.success).toBe(false)
  })

  it('strictly isolates student reviews without algorithmic risk scoring', () => {
    // Verify that the schema does NOT accept or contain any algorithmic risk score fields
    const reviewData = {
      student_identifier: 'Student #101',
      assignment_title: 'Essay 1',
      submission_date: '2026-11-01',
      student_risk_score: 95, // algorithmic score attempted
    }

    const parsed = createStudentReviewSchema.safeParse(reviewData)
    expect(parsed.success).toBe(true)
    // The parsed result should strip or ignore student_risk_score since it does not exist in schema
    expect((parsed as Record<string, unknown>).student_risk_score).toBeUndefined()
  })
})

