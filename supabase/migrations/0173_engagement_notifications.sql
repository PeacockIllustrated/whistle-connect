-- ============================================================================
-- Migration 0173: engagement_notifications — scheduled re-engagement nudges
-- Date: 2026-06-13
--
-- Data foundations for a daily re-engagement cron (/api/cron/engagement) that
-- prompts users to keep using the app. Three pieces:
--
--   * profiles.last_active_at — activity signal for win-back targeting. Touched
--       (throttled to ~hourly) by middleware on every /app request. Backfilled
--       to now() for existing rows via the NOT NULL DEFAULT, so NOBODY is
--       treated as "dormant" until the win-back threshold elapses AFTER this
--       ships — no day-one win-back spike to the whole user base.
--
--   * profiles.reengagement_opt_out — per-user opt-out for re-engagement /
--       marketing nudges. Transactional notifications (booking confirmed,
--       payment released, …) are UNAFFECTED and always send. PECR/GDPR:
--       re-engagement push is marketing and needs an easy, honoured opt-out.
--
--   * engagement_nudges — idempotency + frequency-cap log. The cron CLAIMS a
--       (user_id, nudge_type, period_key) slot BEFORE sending, so a cron that
--       re-runs or overlaps never double-nudges. The composite PK IS the dedupe
--       key (same posture as 0172 rate_limit_counters).
--
-- No SECURITY DEFINER RPCs are added here: the cron does candidate selection
-- with the service-role client + the existing find_bookings_near_referee RPC,
-- so there is no new authenticated-callable surface. The new table is
-- RLS-on / no-policy (service-role only), matching the 0172 posture.
-- ============================================================================

-- 1. Activity signal ----------------------------------------------------------
-- NOT NULL DEFAULT now() backfills every existing row to "active as of this
-- migration", so the win-back segment is empty until DORMANT_DAYS pass.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN public.profiles.last_active_at IS
    'Last time the user was active under /app (throttled ~hourly by middleware). Drives win-back nudge targeting.';

-- 2. Re-engagement opt-out ----------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS reengagement_opt_out BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.reengagement_opt_out IS
    'User opted out of re-engagement / marketing nudges. Transactional notifications are unaffected.';

-- 3. Idempotency / frequency-cap log ------------------------------------------
CREATE TABLE IF NOT EXISTS public.engagement_nudges (
    user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    nudge_type TEXT        NOT NULL,
    period_key TEXT        NOT NULL,
    sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Composite PK = the dedupe key: one (user, type, period) slot can only be
    -- claimed once. INSERT ... (no ON CONFLICT) raising 23505 IS the "already
    -- nudged this period" signal the cron relies on.
    PRIMARY KEY (user_id, nudge_type, period_key)
);

-- Cooldown lookup: "did this user get ANY nudge since <cutoff>?" — the cron
-- pulls one window of rows and builds an in-memory set, so this index keeps
-- that scan cheap as the log grows.
CREATE INDEX IF NOT EXISTS idx_engagement_nudges_sent_at
    ON public.engagement_nudges (sent_at);

-- RLS on, no policies: only the service-role key (which bypasses RLS) can
-- read/write this table. A signed-in user cannot enumerate or tamper with
-- another user's nudge history over /rest/v1.
ALTER TABLE public.engagement_nudges ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.engagement_nudges FROM anon, authenticated, PUBLIC;
