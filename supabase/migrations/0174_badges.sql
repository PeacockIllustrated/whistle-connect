-- ============================================================================
-- Migration 0174: badges — achievements foundation
-- Date: 2026-06-14
--
-- Data foundation for in-app achievements/badges shown on the account page.
-- Two tables:
--   * badges       — the catalogue (reference data). Public-read (anon +
--                    authenticated SELECT), writes only via service-role.
--                    Mirrors the public-read posture of wc_teams (0169).
--   * user_badges  — which user earned which badge + when. A user can read
--                    their OWN rows; writes are service-role only (awarding
--                    runs server-side).
--
-- No SECURITY DEFINER functions: awarding is done by the service-role client
-- (src/lib/badges.ts awardBadge), so there's no new authenticated-callable
-- surface. Event-driven awarding (first match, ten matches, …) is a follow-up;
-- this migration only lays the schema + seeds the catalogue.
--
-- Numbered 0174 to avoid colliding with 0173 (engagement_notifications) which
-- is in flight on a separate branch.
-- ============================================================================

-- 1. Catalogue -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.badges (
    code        TEXT        PRIMARY KEY,
    name        TEXT        NOT NULL,
    description TEXT        NOT NULL,
    icon        TEXT        NOT NULL,                 -- lucide icon name (mapped in UI)
    tier        TEXT        NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold')),
    category    TEXT        NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'coach', 'referee')),
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    active      BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

-- Public read: the catalogue is non-sensitive reference data.
REVOKE ALL ON public.badges FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.badges TO anon, authenticated;
DROP POLICY IF EXISTS "badges readable by everyone" ON public.badges;
CREATE POLICY "badges readable by everyone" ON public.badges FOR SELECT USING (true);

-- 2. Earned badges -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_badges (
    user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    badge_code TEXT        NOT NULL REFERENCES public.badges(code) ON DELETE CASCADE,
    earned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, badge_code)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges (user_id);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- A user can read their own earned badges; writes are service-role only.
REVOKE ALL ON public.user_badges FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.user_badges TO authenticated;
DROP POLICY IF EXISTS "own badges readable" ON public.user_badges;
CREATE POLICY "own badges readable" ON public.user_badges FOR SELECT USING (auth.uid() = user_id);

-- 3. Seed catalogue ------------------------------------------------------------
INSERT INTO public.badges (code, name, description, icon, tier, category, sort_order) VALUES
    ('welcome',          'Welcome aboard', 'Joined the Whistle Connect community',     'PartyPopper',  'bronze', 'general',  10),
    ('profile_complete', 'All set',        'Completed your profile',                    'CheckCircle2', 'bronze', 'general',  20),
    ('first_booking',    'First booking',  'Created your first booking',                'CalendarCheck','bronze', 'coach',    30),
    ('fa_verified',      'FA Verified',    'Verified your FA registration',             'BadgeCheck',   'silver', 'referee',  40),
    ('first_match',      'First whistle',  'Refereed your first completed match',       'Flag',         'bronze', 'referee',  50),
    ('ten_matches',      'Ten up',         'Completed ten matches',                     'Medal',        'silver', 'referee',  60),
    ('reliable',         'Mr Reliable',    'Maintained a strong reliability score',     'ShieldCheck',  'gold',   'referee',  70),
    ('century',          'Centurion',      'Completed one hundred matches',             'Trophy',       'gold',   'referee',  80)
ON CONFLICT (code) DO NOTHING;
