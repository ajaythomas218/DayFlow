-- ==============================================================================
-- WORKDAY OS — PHASE 6 MIGRATION: DIARY JOURNAL, CHECKLIST & REFLECTIONS
-- Additive migration for expanded reflection fields and performance indexes
-- ==============================================================================

-- 1. Add journal and reflection fields to diary_entries
ALTER TABLE public.diary_entries
    ADD COLUMN IF NOT EXISTS journal_content TEXT,
    ADD COLUMN IF NOT EXISTS wins TEXT,
    ADD COLUMN IF NOT EXISTS challenges TEXT,
    ADD COLUMN IF NOT EXISTS lessons_learned TEXT,
    ADD COLUMN IF NOT EXISTS tomorrow_plan TEXT;

-- 2. Add performance lookup indexes
CREATE INDEX IF NOT EXISTS idx_diary_entries_user_date
    ON public.diary_entries(user_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_diary_task_links_entry
    ON public.diary_task_links(diary_entry_id);

CREATE INDEX IF NOT EXISTS idx_diary_task_links_task
    ON public.diary_task_links(task_id);

