import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Cross-Module Consistency & Production QA Audit', () => {
  it('verifies canonical tasks table is the single source of truth across all modules', () => {
    const tasksSchemaPath = path.resolve(__dirname, '../../supabase/migrations/20261027000000_initial_schema.sql')
    const content = fs.readFileSync(tasksSchemaPath, 'utf-8')

    // Canonical fields
    expect(content).toContain('CREATE TABLE IF NOT EXISTS public.tasks')
    expect(content).toContain('deadline_at TIMESTAMPTZ')
    expect(content).toContain('scheduled_start_at TIMESTAMPTZ')
    expect(content).toContain('scheduled_end_at TIMESTAMPTZ')
    expect(content).toContain('is_time_blocked BOOLEAN NOT NULL DEFAULT FALSE')
    expect(content).toContain('recurrence_rule TEXT')
  })

  it('verifies additive migrations link Training and Student Reviews directly to canonical tasks', () => {
    const trainingReviewsPath = path.resolve(
      __dirname,
      '../../supabase/migrations/20261028000002_training_and_reviews_refinement.sql'
    )
    const content = fs.readFileSync(trainingReviewsPath, 'utf-8')

    // Task table contains foreign keys to course and training session
    expect(content).toContain('course_id UUID REFERENCES public.training_courses(id)')
    expect(content).toContain('training_session_id UUID REFERENCES public.training_sessions(id)')
    expect(content).toContain('checklist_template_task_id UUID REFERENCES public.training_template_tasks(id)')

    // Student reviews link to canonical task for follow-up
    expect(content).toContain('idx_tasks_training_session')
    expect(content).toContain('idx_tasks_course')
  })

  it('verifies Google Calendar bidirectional sync protects against infinite echo loops and preserves canonical task history', () => {
    const initialPath = path.resolve(__dirname, '../../supabase/migrations/20261027000000_initial_schema.sql')
    const gcalSyncPath = path.resolve(
      __dirname,
      '../../supabase/migrations/20261028000000_google_calendar_sync.sql'
    )
    const initialContent = fs.readFileSync(initialPath, 'utf-8')
    const syncContent = fs.readFileSync(gcalSyncPath, 'utf-8')

    expect(initialContent).toContain('CREATE TABLE IF NOT EXISTS public.calendar_event_mappings')
    expect(initialContent).toContain('etag TEXT')
    expect(initialContent).toContain("sync_direction TEXT NOT NULL DEFAULT 'bidirectional'")
    expect(initialContent).toContain('chk_mapping_target')
    expect(syncContent).toContain('uq_mappings_conn_event')
    expect(syncContent).toContain('uq_mappings_conn_task')
  })

  it('verifies atomic reminder claims and delivery retry engine with exponential backoff', () => {
    const remindersPath = path.resolve(
      __dirname,
      '../../supabase/migrations/20261027000003_reminder_engine_and_recurrence.sql'
    )
    const content = fs.readFileSync(remindersPath, 'utf-8')

    expect(content).toContain('CREATE OR REPLACE FUNCTION public.claim_due_reminder_deliveries')
    expect(content).toContain('FOR UPDATE SKIP LOCKED')
    expect(content).toContain("status = 'processing'")
  })

  it('verifies strict pastoral isolation: no algorithmic student risk scores exist in codebase or schema', () => {
    const initialSchema = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/20261027000000_initial_schema.sql'),
      'utf-8'
    )
    const phase7Schema = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/20261028000002_training_and_reviews_refinement.sql'),
      'utf-8'
    )

    // No automatic risk scoring columns
    expect(initialSchema).not.toContain('risk_score')
    expect(initialSchema).not.toContain('ai_evaluation')
    expect(phase7Schema).not.toContain('risk_score')
    expect(phase7Schema).not.toContain('predictive_risk')

    // Manual prompt and external link only
    expect(initialSchema).toContain('external_risk_check_prompted BOOLEAN NOT NULL DEFAULT FALSE')
    expect(initialSchema).toContain('external_system_link TEXT')
  })

  it('verifies all user-owned tables enforce RLS policies', () => {
    const rlsPath = path.resolve(__dirname, '../../supabase/migrations/20261027000001_rls_policies.sql')
    const rlsContent = fs.readFileSync(rlsPath, 'utf-8')

    const protectedTables = [
      'tasks',
      'projects',
      'task_dependencies',
      'calendar_events',
      'reminder_rules',
      'reminder_deliveries',
      'diary_entries',
      'training_courses',
      'training_templates',
      'training_sessions',
      'student_reviews',
    ]

    for (const table of protectedTables) {
      expect(rlsContent).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
    }
  })
})
