-- ==============================================================================
-- WORKDAY OS — PHASE 5 MIGRATION: GOOGLE CALENDAR SYNC PREFERENCES
-- Additive changes for per-item sync overrides and user defaults
-- ==============================================================================

-- 1. Add per-item sync overrides to tasks and calendar_events
ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS sync_with_google BOOLEAN DEFAULT NULL;

ALTER TABLE public.calendar_events
    ADD COLUMN IF NOT EXISTS sync_with_google BOOLEAN DEFAULT NULL;

-- 2. Add event auto-sync default preference to user_settings
ALTER TABLE public.user_settings
    ADD COLUMN IF NOT EXISTS auto_sync_events_to_calendar BOOLEAN NOT NULL DEFAULT TRUE;

-- 3. Add remote_updated_at to calendar_event_mappings for true timestamp conflict policy
ALTER TABLE public.calendar_event_mappings
    ADD COLUMN IF NOT EXISTS remote_updated_at TIMESTAMPTZ;

-- 4. Enforce 1:1 unique mapping per connection for local items
CREATE UNIQUE INDEX IF NOT EXISTS uq_mappings_conn_event
    ON public.calendar_event_mappings(calendar_connection_id, calendar_event_id)
    WHERE calendar_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mappings_conn_task
    ON public.calendar_event_mappings(calendar_connection_id, task_id)
    WHERE task_id IS NOT NULL;

-- 5. Add concurrency lock and sync metric tracking to calendar_sync_state
ALTER TABLE public.calendar_sync_state
    ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
    ADD COLUMN IF NOT EXISTS sync_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_pushed_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_pulled_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_conflict_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sync_state_lock
    ON public.calendar_sync_state(calendar_connection_id, sync_status);

-- 6. Additional performance indexes for sync mapping lookups
CREATE INDEX IF NOT EXISTS idx_mappings_lookup
    ON public.calendar_event_mappings(calendar_connection_id, google_calendar_id, google_event_id);

CREATE INDEX IF NOT EXISTS idx_mappings_user_status
    ON public.calendar_event_mappings(user_id, sync_status);

