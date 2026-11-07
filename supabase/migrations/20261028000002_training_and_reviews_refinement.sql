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

