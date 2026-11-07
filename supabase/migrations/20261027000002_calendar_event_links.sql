-- ==============================================================================
-- WORKDAY OS — PHASE 3 ADDITIVE MIGRATION: CALENDAR EVENT ASSOCIATIONS
-- Adds optional foreign key associations from calendar_events to projects and tasks.
-- ==============================================================================

ALTER TABLE public.calendar_events
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_project_id ON public.calendar_events(project_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_task_id ON public.calendar_events(task_id);

