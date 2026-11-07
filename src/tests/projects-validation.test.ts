import { describe, it, expect } from 'vitest'
import { createProjectSchema, updateProjectSchema } from '@/lib/validations/projects'
import { calculateProjectProgress } from '@/lib/calculations'

describe('Project Validation & Derived Progress Logic', () => {
  describe('Project Schema Validation', () => {
    it('validates a valid project creation payload', () => {
      const valid = {
        title: 'Q4 Product Launch',
        description: 'Launching version 2.0 with redesigned task architecture',
        color_hex: '#8B7CFF',
        status: 'active',
        target_completion_date: '2026-12-31',
      }
      const parsed = createProjectSchema.safeParse(valid)
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data.title).toBe('Q4 Product Launch')
        expect(parsed.data.color_hex).toBe('#8B7CFF')
      }
    })

    it('rejects an empty or whitespace-only project title', () => {
      const invalid = {
        title: '   ',
        color_hex: '#8B7CFF',
      }
      const parsed = createProjectSchema.safeParse(invalid)
      expect(parsed.success).toBe(false)
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain('Project title is required')
      }
    })

    it('enforces 6-character hex color code format matching schema constraint', () => {
      const invalidColors = ['red', '#FFF', '#1234567', '8B7CFF', '#ZZZZZZ']
      for (const color of invalidColors) {
        const parsed = createProjectSchema.safeParse({
          title: 'Color Test',
          color_hex: color,
        })
        expect(parsed.success).toBe(false)
      }

      const validColors = ['#8B7CFF', '#22D3EE', '#34D399', '#f87171']
      for (const color of validColors) {
        const parsed = createProjectSchema.safeParse({
          title: 'Color Test',
          color_hex: color,
        })
        expect(parsed.success).toBe(true)
      }
    })

    it('validates project status enums accurately', () => {
      const validStatuses = ['backlog', 'active', 'on_hold', 'completed', 'archived'] as const
      for (const status of validStatuses) {
        const parsed = createProjectSchema.safeParse({
          title: 'Status Test',
          status,
        })
        expect(parsed.success).toBe(true)
      }

      const parsedInvalid = createProjectSchema.safeParse({
        title: 'Status Test',
        status: 'in_progress_invalid',
      })
      expect(parsedInvalid.success).toBe(false)
    })

    it('validates target completion date formatted as YYYY-MM-DD', () => {
      const valid = createProjectSchema.safeParse({
        title: 'Date Test',
        target_completion_date: '2026-11-15',
      })
      expect(valid.success).toBe(true)

      const invalid = createProjectSchema.safeParse({
        title: 'Date Test',
        target_completion_date: '15/11/2026',
      })
      expect(invalid.success).toBe(false)
    })

    it('validates updateProjectSchema requires a valid UUID id', () => {
      const invalid = updateProjectSchema.safeParse({
        id: 'not-a-uuid',
        title: 'Updated title',
      })
      expect(invalid.success).toBe(false)

      const valid = updateProjectSchema.safeParse({
        id: 'a1b2c3d4-e5f6-4a1b-9c2d-3e4f5a6b7c8d',
        title: 'Updated title',
      })
      expect(valid.success).toBe(true)
    })
  })

  describe('Documented Derived Progress Calculation Formula', () => {
    it('returns 0% when a project has zero total tasks', () => {
      expect(calculateProjectProgress(0, 0)).toBe(0)
      expect(calculateProjectProgress(-1, 0)).toBe(0)
    })

    it('calculates rounded percentage for partially completed tasks', () => {
      expect(calculateProjectProgress(10, 4)).toBe(40)
      expect(calculateProjectProgress(3, 1)).toBe(33) // 33.333% -> 33
      expect(calculateProjectProgress(3, 2)).toBe(67) // 66.666% -> 67
    })

    it('returns 100% when all tasks are complete', () => {
      expect(calculateProjectProgress(5, 5)).toBe(100)
      expect(calculateProjectProgress(1, 1)).toBe(100)
    })

    it('clamps values cleanly between 0 and 100', () => {
      expect(calculateProjectProgress(5, 10)).toBe(100)
      expect(calculateProjectProgress(5, -2)).toBe(0)
    })
  })
})

