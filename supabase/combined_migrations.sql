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
-- ==============================================================================
-- WORKDAY OS — DATABASE MIGRATION: ROW LEVEL SECURITY (RLS) POLICIES
-- Migration: 20261027000001_rls_policies.sql
-- Description: Multi-tenant User Isolation, Table Security Policies & Auth Hooks
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ENABLE ROW LEVEL SECURITY ON ALL USER-OWNED TABLES
-- ------------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_reschedule_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_event_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_template_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. PROFILES & USER SETTINGS POLICIES
-- ------------------------------------------------------------------------------

CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "user_settings_select_own" ON public.user_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_settings_insert_own" ON public.user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_update_own" ON public.user_settings
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 3. PROJECTS POLICIES
-- ------------------------------------------------------------------------------

CREATE POLICY "projects_select_own" ON public.projects
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "projects_insert_own" ON public.projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects_update_own" ON public.projects
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects_delete_own" ON public.projects
    FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 4. TASKS, DEPENDENCIES & RESCHEDULE POLICIES
-- ------------------------------------------------------------------------------

CREATE POLICY "tasks_select_own" ON public.tasks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "tasks_insert_own" ON public.tasks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tasks_update_own" ON public.tasks
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tasks_delete_own" ON public.tasks
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "task_dependencies_select_own" ON public.task_dependencies
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "task_dependencies_insert_own" ON public.task_dependencies
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "task_dependencies_delete_own" ON public.task_dependencies
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "task_reschedule_history_select_own" ON public.task_reschedule_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "task_reschedule_history_insert_own" ON public.task_reschedule_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 5. CALENDAR EVENTS & MAPPINGS POLICIES
-- ------------------------------------------------------------------------------

CREATE POLICY "calendar_events_select_own" ON public.calendar_events
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "calendar_events_insert_own" ON public.calendar_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "calendar_events_update_own" ON public.calendar_events
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "calendar_events_delete_own" ON public.calendar_events
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "calendar_connections_select_own" ON public.calendar_connections
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "calendar_connections_insert_own" ON public.calendar_connections
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "calendar_connections_update_own" ON public.calendar_connections
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "calendar_connections_delete_own" ON public.calendar_connections
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "calendar_event_mappings_select_own" ON public.calendar_event_mappings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "calendar_event_mappings_insert_own" ON public.calendar_event_mappings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "calendar_event_mappings_update_own" ON public.calendar_event_mappings
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "calendar_event_mappings_delete_own" ON public.calendar_event_mappings
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "calendar_sync_state_all_own" ON public.calendar_sync_state
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.calendar_connections cc
            WHERE cc.id = calendar_sync_state.calendar_connection_id
              AND cc.user_id = auth.uid()
        )
    );

-- ------------------------------------------------------------------------------
-- 6. REMINDER RULES & DELIVERIES POLICIES
-- ------------------------------------------------------------------------------

CREATE POLICY "reminder_rules_select_own" ON public.reminder_rules
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "reminder_rules_insert_own" ON public.reminder_rules
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reminder_rules_update_own" ON public.reminder_rules
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reminder_rules_delete_own" ON public.reminder_rules
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "reminder_deliveries_select_own" ON public.reminder_deliveries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "reminder_deliveries_insert_own" ON public.reminder_deliveries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reminder_deliveries_update_own" ON public.reminder_deliveries
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 7. DAILY DIARY POLICIES
-- ------------------------------------------------------------------------------

CREATE POLICY "diary_entries_select_own" ON public.diary_entries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "diary_entries_insert_own" ON public.diary_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "diary_entries_update_own" ON public.diary_entries
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "diary_entries_delete_own" ON public.diary_entries
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "diary_task_links_all_own" ON public.diary_task_links
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.diary_entries de
            WHERE de.id = diary_task_links.diary_entry_id
              AND de.user_id = auth.uid()
        )
    );

-- ------------------------------------------------------------------------------
-- 8. TRAINING MODULES POLICIES
-- ------------------------------------------------------------------------------

CREATE POLICY "training_courses_select_own" ON public.training_courses
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "training_courses_insert_own" ON public.training_courses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "training_courses_update_own" ON public.training_courses
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "training_courses_delete_own" ON public.training_courses
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "training_templates_all_own" ON public.training_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.training_courses tc
            WHERE tc.id = training_templates.course_id
              AND tc.user_id = auth.uid()
        )
    );

CREATE POLICY "training_template_tasks_all_own" ON public.training_template_tasks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.training_templates tt
            JOIN public.training_courses tc ON tc.id = tt.course_id
            WHERE tt.id = training_template_tasks.template_id
              AND tc.user_id = auth.uid()
        )
    );

CREATE POLICY "training_sessions_all_own" ON public.training_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.training_courses tc
            WHERE tc.id = training_sessions.course_id
              AND tc.user_id = auth.uid()
        )
    );

-- ------------------------------------------------------------------------------
-- 9. STUDENT REVIEWS POLICIES
-- ------------------------------------------------------------------------------

CREATE POLICY "student_reviews_select_own" ON public.student_reviews
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "student_reviews_insert_own" ON public.student_reviews
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "student_reviews_update_own" ON public.student_reviews
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "student_reviews_delete_own" ON public.student_reviews
    FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 10. ACTIVITY LOGS & BACKGROUND JOBS
-- ------------------------------------------------------------------------------

CREATE POLICY "activity_logs_select_own" ON public.activity_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "activity_logs_insert_own" ON public.activity_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- background_jobs: Restricted solely to service_role admin execution
-- By default with RLS enabled and no user policies, authenticated users cannot access background_jobs

-- ------------------------------------------------------------------------------
-- 11. AUTOMATIC USER REGISTRATION HOOK
-- ------------------------------------------------------------------------------

-- Function to handle new user onboarding from auth.users into public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_display_name TEXT;
BEGIN
    user_display_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );

    -- Insert into public.profiles
    INSERT INTO public.profiles (id, display_name, email, timezone)
    VALUES (
        NEW.id,
        user_display_name,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC')
    );

    -- Insert default user_settings
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger firing on auth.users row creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- ==============================================================================
-- WORKDAY OS — PHASE 3 ADDITIVE MIGRATION: CALENDAR EVENT ASSOCIATIONS
-- Adds optional foreign key associations from calendar_events to projects and tasks.
-- ==============================================================================

ALTER TABLE public.calendar_events
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_project_id ON public.calendar_events(project_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_task_id ON public.calendar_events(task_id);

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

-- Phase 7: Training Courses, Reusable Checklists, Training Sessions & Student Assignment Reviews Refinements

-- 1. Alter training_courses
ALTER TABLE public.training_courses 
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS personal_notes TEXT;

-- Drop and recreate status check constraint to support 'planned' and 'paused'
ALTER TABLE public.training_courses
  DROP CONSTRAINT IF EXISTS training_courses_status_check;

ALTER TABLE public.training_courses
  ADD CONSTRAINT training_courses_status_check 
  CHECK (status IN ('planned', 'active', 'paused', 'completed', 'archived'));

-- 2. Alter training_templates and training_template_tasks
ALTER TABLE public.training_templates
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.training_template_tasks
  ADD COLUMN IF NOT EXISTS due_offset_days INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS relative_to TEXT NOT NULL DEFAULT 'session_start',
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Alter training_sessions
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS meeting_url TEXT,
  ADD COLUMN IF NOT EXISTS calendar_event_id UUID REFERENCES public.calendar_events(id) ON DELETE SET NULL;

-- 4. Alter tasks for canonical linking
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.training_courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS training_session_id UUID REFERENCES public.training_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checklist_template_task_id UUID REFERENCES public.training_template_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_training_session ON public.tasks(training_session_id);
CREATE INDEX IF NOT EXISTS idx_tasks_course ON public.tasks(course_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_course ON public.training_sessions(course_id);

-- 5. Alter student_reviews
ALTER TABLE public.student_reviews
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.training_courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Drop and recreate student_reviews status check constraint
ALTER TABLE public.student_reviews
  DROP CONSTRAINT IF EXISTS student_reviews_status_check;

ALTER TABLE public.student_reviews
  ADD CONSTRAINT student_reviews_status_check
  CHECK (status IN ('awaiting_review', 'in_review', 'feedback_ready', 'completed', 'pending', 'needs_follow_up'));

CREATE INDEX IF NOT EXISTS idx_student_reviews_course ON public.student_reviews(course_id);
CREATE INDEX IF NOT EXISTS idx_student_reviews_follow_up_due ON public.student_reviews(user_id, follow_up_due_at) WHERE follow_up_due_at IS NOT NULL;

-- Phase 8: Weekly Reviews Schema & RLS Policies

CREATE TABLE IF NOT EXISTS public.weekly_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    reflection_content TEXT,
    wins TEXT,
    challenges TEXT,
    lessons_learned TEXT,
    next_week_priorities TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_weekly_review UNIQUE (user_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_weekly_reviews_user_week ON public.weekly_reviews(user_id, week_start_date DESC);

CREATE TRIGGER set_weekly_reviews_updated_at
    BEFORE UPDATE ON public.weekly_reviews
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- RLS Policies
ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_reviews_select_own" ON public.weekly_reviews
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "weekly_reviews_insert_own" ON public.weekly_reviews
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "weekly_reviews_update_own" ON public.weekly_reviews
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "weekly_reviews_delete_own" ON public.weekly_reviews
    FOR DELETE USING (auth.uid() = user_id);

