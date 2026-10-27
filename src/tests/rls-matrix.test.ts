import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Supabase RLS Matrix & Migration Validation', () => {
  const migrationsDir = path.resolve(__dirname, '../../supabase/migrations')
  const schemaFile = path.join(migrationsDir, '20261027000000_initial_schema.sql')
  const rlsFile = path.join(migrationsDir, '20261027000001_rls_policies.sql')

  const expectedTables = [
    'profiles',
    'user_settings',
    'projects',
    'tasks',
    'task_dependencies',
    'task_reschedule_history',
    'calendar_events',
    'calendar_connections',
    'calendar_event_mappings',
    'calendar_sync_state',
    'reminder_rules',
    'reminder_deliveries',
    'diary_entries',
    'diary_task_links',
    'training_courses',
    'training_templates',
    'training_template_tasks',
    'training_sessions',
    'student_reviews',
    'activity_logs',
    'background_jobs',
  ]

  it('contains the initial schema migration file', () => {
    expect(fs.existsSync(schemaFile)).toBe(true)
  })

  it('defines all 21 core tables in the schema migration', () => {
    const content = fs.readFileSync(schemaFile, 'utf-8')
    for (const table of expectedTables) {
      const tableRegex = new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\b`, 'i')
      expect(content).toMatch(tableRegex)
    }
  })

  it('contains the RLS policies migration file', () => {
    expect(fs.existsSync(rlsFile)).toBe(true)
  })

  it('enables Row Level Security on all 21 tables without exception', () => {
    const rlsContent = fs.readFileSync(rlsFile, 'utf-8')
    for (const table of expectedTables) {
      const rlsRegex = new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, 'i')
      expect(rlsContent).toMatch(rlsRegex)
    }
  })

  it('includes the auto-user registration trigger hook', () => {
    const rlsContent = fs.readFileSync(rlsFile, 'utf-8')
    expect(rlsContent).toContain('handle_new_user()')
    expect(rlsContent).toContain('CREATE TRIGGER on_auth_user_created')
  })
})
