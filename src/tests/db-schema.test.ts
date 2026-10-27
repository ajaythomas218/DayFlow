import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Database Architecture & Constraint Integrity', () => {
  const schemaFile = path.resolve(__dirname, '../../supabase/migrations/20261027000000_initial_schema.sql')
  const schemaContent = fs.readFileSync(schemaFile, 'utf-8')

  it('separates scheduled time from deadline on tasks table', () => {
    expect(schemaContent).toContain('deadline_at TIMESTAMPTZ')
    expect(schemaContent).toContain('scheduled_start_at TIMESTAMPTZ')
    expect(schemaContent).toContain('scheduled_end_at TIMESTAMPTZ')
    expect(schemaContent).toContain('is_time_blocked BOOLEAN NOT NULL DEFAULT FALSE')
  })

  it('enforces scheduled start before scheduled end check constraint', () => {
    expect(schemaContent).toContain('chk_scheduled_time_range')
  })

  it('enforces mutual exclusivity on calendar_event_mappings target', () => {
    expect(schemaContent).toContain('chk_mapping_target')
  })

  it('enforces hex color constraint on projects table', () => {
    expect(schemaContent).toContain("color_hex ~ '^#[0-9A-Fa-f]{6}$'")
  })

  it('maintains reschedule audit history table', () => {
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS public.task_reschedule_history')
    expect(schemaContent).toContain('previous_scheduled_start TIMESTAMPTZ')
    expect(schemaContent).toContain('new_scheduled_start TIMESTAMPTZ')
  })

  it('keeps student reviews strictly isolated without risk scoring', () => {
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS public.student_reviews')
    expect(schemaContent).toContain('external_risk_check_prompted BOOLEAN')
    expect(schemaContent).toContain('external_system_link TEXT')
    // Ensure no risk algorithm table or column exists
    expect(schemaContent).not.toContain('student_risk_score')
  })
})
