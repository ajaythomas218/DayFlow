-- ==============================================================================
-- WORKDAY OS — DATABASE MIGRATION: INITIAL SCHEMA
-- Migration: 20261027000000_initial_schema.sql
-- Description: Core 21 Relational Tables, Constraints, Indexes & Triggers
-- ==============================================================================

-- Enable essential extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Automatic updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. PROFILES & USER SETTINGS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    email TEXT NOT NULL,
    avatar_url TEXT,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    default_task_duration_minutes INT NOT NULL DEFAULT 30 CHECK (default_task_duration_minutes > 0),
    auto_sync_tasks_to_calendar BOOLEAN NOT NULL DEFAULT FALSE,
    default_calendar_id TEXT,
    week_start_day INT NOT NULL DEFAULT 1 CHECK (week_start_day BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday
    theme_preference TEXT NOT NULL DEFAULT 'dark' CHECK (theme_preference IN ('dark', 'light', 'system')),
    notification_web_push BOOLEAN NOT NULL DEFAULT TRUE,
    notification_in_app BOOLEAN NOT NULL DEFAULT TRUE,
    notification_email BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ------------------------------------------------------------------------------
-- 2. PROJECTS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
    description TEXT,
    color_hex TEXT NOT NULL DEFAULT '#8B7CFF' CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('backlog', 'active', 'on_hold', 'completed', 'archived')),
    target_completion_date DATE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_status ON public.projects(user_id, status);

CREATE TRIGGER set_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ------------------------------------------------------------------------------
-- 3. TASKS & RESCHEDULE HISTORY
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    parent_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'p3' CHECK (priority IN ('p1', 'p2', 'p3', 'p4')),
    
    deadline_at TIMESTAMPTZ,
    scheduled_start_at TIMESTAMPTZ,
    scheduled_end_at TIMESTAMPTZ,
    is_time_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    
    recurrence_rule TEXT,
    recurrence_parent_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    
    estimated_duration_minutes INT CHECK (estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0),
    completed_at TIMESTAMPTZ,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_scheduled_time_range CHECK (
        (scheduled_start_at IS NULL AND scheduled_end_at IS NULL) OR
        (scheduled_start_at IS NOT NULL AND scheduled_end_at IS NOT NULL AND scheduled_end_at > scheduled_start_at)
    )
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON public.tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_deadline ON public.tasks(user_id, deadline_at) WHERE status != 'completed';
CREATE INDEX IF NOT EXISTS idx_tasks_user_scheduled ON public.tasks(user_id, scheduled_start_at) WHERE scheduled_start_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);

CREATE TRIGGER set_tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS public.task_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocking_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    dependent_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_no_self_dependency CHECK (blocking_task_id != dependent_task_id),
    CONSTRAINT uq_task_dependency UNIQUE (blocking_task_id, dependent_task_id)
);

CREATE TABLE IF NOT EXISTS public.task_reschedule_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    previous_scheduled_start TIMESTAMPTZ,
    new_scheduled_start TIMESTAMPTZ,
    previous_deadline TIMESTAMPTZ,
    new_deadline TIMESTAMPTZ,
    reason TEXT,
    rescheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reschedule_task_id ON public.task_reschedule_history(task_id);

-- ------------------------------------------------------------------------------
-- 4. CALENDAR EVENTS (MEETINGS & APPOINTMENTS)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
    description TEXT,
    location TEXT,
    event_type TEXT NOT NULL DEFAULT 'meeting' CHECK (event_type IN ('meeting', 'appointment', 'focus_block', 'reminder_block', 'external')),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
    meeting_url TEXT,
    attendees JSONB DEFAULT '[]'::jsonb,
    recurrence_rule TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_event_time_range CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_range ON public.calendar_events(user_id, start_time, end_time);

CREATE TRIGGER set_calendar_events_updated_at
    BEFORE UPDATE ON public.calendar_events
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ------------------------------------------------------------------------------
-- 5. GOOGLE CALENDAR CONNECTIONS & MAPPINGS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.calendar_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'google' CHECK (provider = 'google'),
    account_email TEXT NOT NULL,
    encrypted_access_token TEXT NOT NULL,
    encrypted_refresh_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ NOT NULL,
    scopes TEXT[] NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_provider_account UNIQUE (user_id, provider, account_email)
);

CREATE TABLE IF NOT EXISTS public.calendar_event_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    calendar_connection_id UUID NOT NULL REFERENCES public.calendar_connections(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    calendar_event_id UUID REFERENCES public.calendar_events(id) ON DELETE CASCADE,
    google_calendar_id TEXT NOT NULL,
    google_event_id TEXT NOT NULL,
    etag TEXT,
    sync_direction TEXT NOT NULL DEFAULT 'bidirectional' CHECK (sync_direction IN ('bidirectional', 'push_only', 'pull_only')),
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sync_status TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending_push', 'pending_pull', 'conflict', 'orphaned')),
    CONSTRAINT chk_mapping_target CHECK (
        (task_id IS NOT NULL AND calendar_event_id IS NULL) OR
        (task_id IS NULL AND calendar_event_id IS NOT NULL)
    ),
    CONSTRAINT uq_google_event UNIQUE (calendar_connection_id, google_calendar_id, google_event_id)
);

CREATE INDEX IF NOT EXISTS idx_mappings_task ON public.calendar_event_mappings(task_id);
CREATE INDEX IF NOT EXISTS idx_mappings_event ON public.calendar_event_mappings(calendar_event_id);

CREATE TABLE IF NOT EXISTS public.calendar_sync_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_connection_id UUID NOT NULL REFERENCES public.calendar_connections(id) ON DELETE CASCADE,
    google_calendar_id TEXT NOT NULL,
    sync_token TEXT,
    channel_id TEXT,
    resource_id TEXT,
    channel_expiration TIMESTAMPTZ,
    last_successful_sync TIMESTAMPTZ,
    last_error_message TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_connection_calendar UNIQUE (calendar_connection_id, google_calendar_id)
);

CREATE TRIGGER set_calendar_sync_state_updated_at
    BEFORE UPDATE ON public.calendar_sync_state
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ------------------------------------------------------------------------------
-- 6. REMINDER RULES & DELIVERIES
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.reminder_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    calendar_event_id UUID REFERENCES public.calendar_events(id) ON DELETE CASCADE,
    offset_minutes INT NOT NULL,
    is_relative_to_start BOOLEAN NOT NULL DEFAULT TRUE,
    channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'web_push', 'google_calendar')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_reminder_target CHECK (
        (task_id IS NOT NULL AND calendar_event_id IS NULL) OR
        (task_id IS NULL AND calendar_event_id IS NOT NULL)
    ),
    CONSTRAINT uq_reminder_rule UNIQUE (task_id, calendar_event_id, offset_minutes, channel)
);

CREATE TABLE IF NOT EXISTS public.reminder_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reminder_rule_id UUID NOT NULL REFERENCES public.reminder_rules(id) ON DELETE CASCADE,
    scheduled_for TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'failed', 'cancelled', 'dismissed')),
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_pending ON public.reminder_deliveries(status, scheduled_for) WHERE status = 'scheduled';

-- ------------------------------------------------------------------------------
-- 7. DAILY DIARY & TASK LINKS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.diary_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    morning_intentions TEXT,
    evening_reflection TEXT,
    energy_level INT CHECK (energy_level BETWEEN 1 AND 5),
    mood_rating INT CHECK (mood_rating BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_diary_date UNIQUE (user_id, entry_date)
);

CREATE TRIGGER set_diary_entries_updated_at
    BEFORE UPDATE ON public.diary_entries
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS public.diary_task_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diary_entry_id UUID NOT NULL REFERENCES public.diary_entries(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    is_focus_task BOOLEAN NOT NULL DEFAULT FALSE,
    reflection_note TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_diary_task UNIQUE (diary_entry_id, task_id)
);

-- ------------------------------------------------------------------------------
-- 8. TRAINING MODULES (COURSES, TEMPLATES, SESSIONS)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.training_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
    description TEXT,
    category TEXT,
    target_hours NUMERIC(5,2),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_training_courses_updated_at
    BEFORE UPDATE ON public.training_courses
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS public.training_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
    template_name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_training_templates_updated_at
    BEFORE UPDATE ON public.training_templates
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS public.training_template_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.training_templates(id) ON DELETE CASCADE,
    task_title TEXT NOT NULL,
    estimated_duration_minutes INT DEFAULT 15,
    sort_order INT NOT NULL DEFAULT 0,
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.training_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.training_templates(id) ON DELETE SET NULL,
    session_title TEXT NOT NULL,
    scheduled_start TIMESTAMPTZ NOT NULL,
    actual_duration_minutes INT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_training_sessions_updated_at
    BEFORE UPDATE ON public.training_sessions
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ------------------------------------------------------------------------------
-- 9. STUDENT ASSIGNMENT REVIEWS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.student_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_identifier TEXT NOT NULL,
    assignment_title TEXT NOT NULL,
    submission_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'completed', 'needs_follow_up')),
    feedback_notes TEXT,
    score_or_grade TEXT,
    follow_up_due_at TIMESTAMPTZ,
    follow_up_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    external_risk_check_prompted BOOLEAN NOT NULL DEFAULT FALSE,
    external_system_link TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_reviews_status ON public.student_reviews(user_id, status);

CREATE TRIGGER set_student_reviews_updated_at
    BEFORE UPDATE ON public.student_reviews
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ------------------------------------------------------------------------------
-- 10. ACTIVITY LOGS & BACKGROUND JOBS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS public.background_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'dead_letter')),
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_queue ON public.background_jobs(status, next_run_at) WHERE status IN ('queued', 'failed');

CREATE TRIGGER set_background_jobs_updated_at
    BEFORE UPDATE ON public.background_jobs
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
