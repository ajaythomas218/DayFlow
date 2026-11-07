-- ==============================================================================
-- WORKDAY OS — PHASE 4 MIGRATION: REMINDER ENGINE & RECURRING SCHEDULES
-- Additive changes for multi-reminders, reliable delivery tracking, and recurrence
-- ==============================================================================

-- 1. Enhance reminder_deliveries with retry state, task/event direct references, and cached content
ALTER TABLE public.reminder_deliveries
    ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS calendar_event_id UUID REFERENCES public.calendar_events(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS body TEXT;

-- Update status constraint to include 'pending' and 'processing'
ALTER TABLE public.reminder_deliveries
    DROP CONSTRAINT IF EXISTS reminder_deliveries_status_check;

ALTER TABLE public.reminder_deliveries
    ADD CONSTRAINT reminder_deliveries_status_check
    CHECK (status IN ('scheduled', 'pending', 'processing', 'sent', 'failed', 'cancelled', 'dismissed'));

-- Allow 'email' channel on reminder_rules
ALTER TABLE public.reminder_rules
    DROP CONSTRAINT IF EXISTS reminder_rules_channel_check;

ALTER TABLE public.reminder_rules
    ADD CONSTRAINT reminder_rules_channel_check
    CHECK (channel IN ('in_app', 'web_push', 'email', 'google_calendar'));

-- 2. Enhance calendar_events with recurrence parent reference
ALTER TABLE public.calendar_events
    ADD COLUMN IF NOT EXISTS recurrence_parent_id UUID REFERENCES public.calendar_events(id) ON DELETE CASCADE;

-- 3. Enhance user_settings with default reminder preferences
ALTER TABLE public.user_settings
    ADD COLUMN IF NOT EXISTS task_default_reminders JSONB DEFAULT '[{"offset_minutes": 15, "reference": "start", "channel": "in_app"}]'::jsonb,
    ADD COLUMN IF NOT EXISTS event_default_reminders JSONB DEFAULT '[{"offset_minutes": 10, "reference": "start", "channel": "in_app"}]'::jsonb,
    ADD COLUMN IF NOT EXISTS reminders_enabled_by_default BOOLEAN NOT NULL DEFAULT TRUE;

-- 4. Create indexes for high-throughput scheduler claims and item lookups
CREATE INDEX IF NOT EXISTS idx_reminder_deliveries_claim
    ON public.reminder_deliveries(status, scheduled_for, next_retry_at)
    WHERE status IN ('scheduled', 'pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_reminder_deliveries_task
    ON public.reminder_deliveries(task_id);

CREATE INDEX IF NOT EXISTS idx_reminder_deliveries_event
    ON public.reminder_deliveries(calendar_event_id);

CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_parent
    ON public.tasks(recurrence_parent_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_recurrence_parent
    ON public.calendar_events(recurrence_parent_id);

-- 5. Atomic function to claim due reminder deliveries with concurrency protection (SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.claim_due_reminder_deliveries(batch_size INT DEFAULT 50)
RETURNS SETOF public.reminder_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH due_jobs AS (
        SELECT id
        FROM public.reminder_deliveries
        WHERE (
            (status IN ('scheduled', 'pending') AND scheduled_for <= NOW())
            OR (status = 'failed' AND next_retry_at IS NOT NULL AND next_retry_at <= NOW() AND attempt_count < max_attempts)
        )
        ORDER BY scheduled_for ASC
        LIMIT batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.reminder_deliveries d
    SET status = 'processing',
        attempt_count = d.attempt_count + 1,
        last_attempt_at = NOW()
    FROM due_jobs
    WHERE d.id = due_jobs.id
    RETURNING d.*;
END;
$$;
