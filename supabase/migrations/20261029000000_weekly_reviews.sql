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

