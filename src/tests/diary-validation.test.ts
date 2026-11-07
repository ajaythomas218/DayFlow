import { describe, it, expect } from 'vitest'
import { saveDiaryEntrySchema, toggleFocusTaskSchema } from '@/lib/validations/diary'

describe('Daily Diary & Reflection Input Validations', () => {
  it('validates a complete, valid daily diary entry payload', () => {
    const validPayload = {
      entry_date: '2026-10-28',
      morning_intentions: 'Ship Phase 6 and review all integration tests.',
      journal_content: 'Today was productive. Finished the diary actions and client UI.',
      evening_reflection: 'Great flow state throughout the afternoon.',
      wins: 'All test suites passing with 0 lint errors.',
      challenges: 'Timezone boundary testing near midnight required careful horizon checks.',
      lessons_learned: 'Always derive day ranges from user timezone rather than UTC.',
      tomorrow_plan: 'Prepare summary report and review deployment checks.',
      energy_level: 4,
      mood_rating: 5,
    }

    const result = saveDiaryEntrySchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('allows nullable and optional fields for minimal morning planning', () => {
    const minimalPayload = {
      entry_date: '2026-10-29',
      morning_intentions: 'Keep focus on deep work',
    }

    const result = saveDiaryEntrySchema.safeParse(minimalPayload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.entry_date).toBe('2026-10-29')
      expect(result.data.energy_level).toBeUndefined()
    }
  })

  it('rejects invalid date formats', () => {
    const invalidDates = ['2026/10/28', '28-10-2026', 'yesterday', '2026-1-1', 'invalid']
    for (const d of invalidDates) {
      const res = saveDiaryEntrySchema.safeParse({ entry_date: d })
      expect(res.success).toBe(false)
    }
  })

  it('rejects energy levels and mood ratings out of bounds (1 to 5 only)', () => {
    const outOfBoundsEnergy = [0, 6, -1, 10]
    for (const val of outOfBoundsEnergy) {
      const res = saveDiaryEntrySchema.safeParse({
        entry_date: '2026-10-28',
        energy_level: val,
      })
      expect(res.success).toBe(false)
    }

    const outOfBoundsMood = [0, 6, -2, 7]
    for (const val of outOfBoundsMood) {
      const res = saveDiaryEntrySchema.safeParse({
        entry_date: '2026-10-28',
        mood_rating: val,
      })
      expect(res.success).toBe(false)
    }
  })

  it('validates toggle focus task input with uuid and date', () => {
    const validToggle = {
      entry_date: '2026-10-28',
      task_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      is_focus_task: true,
      reflection_note: 'Crucial deadline item',
    }

    const result = toggleFocusTaskSchema.safeParse(validToggle)
    expect(result.success).toBe(true)
  })

  it('rejects malformed task IDs for focus task toggling', () => {
    const invalidToggle = {
      entry_date: '2026-10-28',
      task_id: 'non-uuid-task-id',
      is_focus_task: true,
    }

    const result = toggleFocusTaskSchema.safeParse(invalidToggle)
    expect(result.success).toBe(false)
  })
})
