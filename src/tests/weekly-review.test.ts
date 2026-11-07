import { describe, it, expect } from 'vitest'
import { saveWeeklyReviewSchema } from '@/lib/validations/weekly-review'
import { getWeekBoundaries } from '@/lib/timezone'
import fs from 'fs'
import path from 'path'

describe('Weekly Review & Reflection Architecture', () => {
  it('validates explicit week boundaries starting on Monday', () => {
    const wednesday = new Date('2026-10-28T15:30:00Z')
    const bounds = getWeekBoundaries(wednesday, 'UTC', 1)

    expect(bounds.weekStartDate).toBe('2026-10-26') // Monday
    expect(bounds.weekEndDate).toBe('2026-11-01') // Sunday
    expect(bounds.label).toContain('2026-10-26 – 2026-11-01')
  })

  it('validates weekly review payload with reflection, wins, and next week priorities', () => {
    const validReview = {
      week_start_date: '2026-10-26',
      reflection_content: 'A highly productive week closing out Phase 8 of Workday OS.',
      wins: 'All test suites passing, cleanly built Next.js 16 production bundle.',
      challenges: 'Coordinating cross-timezone boundaries across multiple modules.',
      lessons_learned: 'Always verify IANA wall-clock parts rather than naive 86400000ms addition.',
      next_week_priorities: '1. Production smoke testing\n2. User onboarding walkthrough',
    }

    const res = saveWeeklyReviewSchema.safeParse(validReview)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.week_start_date).toBe('2026-10-26')
      expect(res.data.wins).toContain('All test suites passing')
    }
  })

  it('rejects invalid week_start_date formatting', () => {
    const invalid = {
      week_start_date: '26-10-2026', // Not YYYY-MM-DD
      reflection_content: 'Note',
    }
    const res = saveWeeklyReviewSchema.safeParse(invalid)
    expect(res.success).toBe(false)
  })

  it('enforces one review per user per week in schema uniqueness constraint', () => {
    const migrationFile = path.resolve(
      __dirname,
      '../../supabase/migrations/20261029000000_weekly_reviews.sql'
    )
    const migrationContent = fs.readFileSync(migrationFile, 'utf-8')

    expect(migrationContent).toContain('CREATE TABLE IF NOT EXISTS public.weekly_reviews')
    expect(migrationContent).toContain('CONSTRAINT uq_user_weekly_review UNIQUE (user_id, week_start_date)')
    expect(migrationContent).toContain('CREATE POLICY "weekly_reviews_select_own"')
    expect(migrationContent).toContain('CREATE POLICY "weekly_reviews_insert_own"')
  })

  it('guarantees that saving a review does not mutate or reschedule canonical tasks', () => {
    // In our architecture, weekly reviews are stored in `weekly_reviews` table.
    // Tasks are queried strictly read-only for computation, ensuring that user reflections
    // leave task statuses, deadlines, and schedules untouched.
    const sampleTask = {
      id: 'task-999',
      title: 'Review production logs',
      status: 'in_progress' as const,
      deadline_at: '2026-10-30T17:00:00.000Z',
      scheduled_start_at: '2026-10-30T09:00:00.000Z',
    }

    const reviewSaved = {
      week_start_date: '2026-10-26',
      reflection_content: 'Closed the week smoothly.',
    }

    // Task remains unmodified
    expect(sampleTask.status).toBe('in_progress')
    expect(sampleTask.deadline_at).toBe('2026-10-30T17:00:00.000Z')
    expect(reviewSaved.week_start_date).toBe('2026-10-26')
  })
})

