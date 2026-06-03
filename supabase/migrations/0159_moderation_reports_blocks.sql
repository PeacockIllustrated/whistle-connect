-- ============================================================================
-- Migration 0159: User-generated content moderation (reports + blocks)
-- Date: 2026-06-03
--
-- Apple Guideline 1.2 requires apps with user-generated content (here: the 1:1
-- booking message threads) to let users (a) report objectionable content/users,
-- (b) block abusive users, and (c) give moderators a way to act on reports /
-- remove content. This migration adds the two storage tables plus a soft-delete
-- column on messages so a moderator can remove a single offending message
-- without destroying the thread audit trail.
--
--   blocked_users  — directional block list. A blocker may only see/manage their
--                    own rows (RLS scoped to blocker_id = auth.uid()).
--   reports        — moderation queue. The reporter inserts + reads their own;
--                    admins (profiles.role='admin') read + update everything.
--   messages.deleted_at — soft content removal by a moderator.
--
-- A SECURITY DEFINER helper `users_are_blocked` lets the send-message server
-- action test for a block in EITHER direction without exposing the counterparty
-- side of the block list to the caller (mirrors is_thread_participant /
-- check_is_booking_referee). search_path is pinned and anon/PUBLIC EXECUTE is
-- revoked, per the 0155 invariant. No anon access on any object here.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. blocked_users — directional "blocker has blocked blocked" rows.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_block_pair UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON public.blocked_users(blocked_id);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- A user may only see, create, and remove their OWN blocks.
CREATE POLICY "Users can view own blocks"
    ON public.blocked_users FOR SELECT
    USING (auth.uid() = blocker_id);

CREATE POLICY "Users can create own blocks"
    ON public.blocked_users FOR INSERT
    WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can delete own blocks"
    ON public.blocked_users FOR DELETE
    USING (auth.uid() = blocker_id);

-- ----------------------------------------------------------------------------
-- 2. reports — moderation queue for objectionable content / users.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reported_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    thread_id UUID REFERENCES public.threads(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'resolved', 'dismissed')),
    resolution_note TEXT,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON public.reports(reported_user_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Reporter may file a report (as themselves) and read the reports they filed.
CREATE POLICY "Reporters can create reports"
    ON public.reports FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Reporters can view own reports"
    ON public.reports FOR SELECT
    USING (auth.uid() = reporter_id);

-- Admins (profiles.role='admin') see and triage every report.
CREATE POLICY "Admins can view all reports"
    ON public.reports FOR SELECT
    USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update reports"
    ON public.reports FOR UPDATE
    USING (is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 3. messages.deleted_at — soft content removal by a moderator. Nullable; the
--    body is also overwritten in the admin action so removed text never renders.
-- ----------------------------------------------------------------------------
ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ----------------------------------------------------------------------------
-- 4. users_are_blocked(a, b) — SECURITY DEFINER so a server action can test for
--    a block in EITHER direction without the caller being able to read the
--    counterparty's block rows directly. search_path pinned (0155 invariant).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.users_are_blocked(p_user_a UUID, p_user_b UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.blocked_users
        WHERE (blocker_id = p_user_a AND blocked_id = p_user_b)
           OR (blocker_id = p_user_b AND blocked_id = p_user_a)
    );
$$ LANGUAGE SQL STABLE;

-- App calls this only from the cookie client (authenticated) and the admin
-- client (service_role). Keep anon/PUBLIC off (0155 invariant).
REVOKE EXECUTE ON FUNCTION public.users_are_blocked(UUID, UUID) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.users_are_blocked(UUID, UUID) TO authenticated, service_role;
