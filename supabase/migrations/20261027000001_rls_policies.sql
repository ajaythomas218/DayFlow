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
