-- ============================================================================
-- Migration 0169: World Cup tracker + sweepstake feature tables
-- Date: 2026-06-11
--
-- A free, public companion tool for the 2026 World Cup (48 teams, 12 groups,
-- 104 matches). Two surfaces:
--   * Public tracker — anyone reads wc_teams / wc_matches (no account).
--   * Sweepstake — an organiser (any signed-in account, incl. a generic
--     World-Cup signup from 0168) creates a pool, the 48 teams are drawn out to
--     named participants, and a live leaderboard tracks who's winning.
--
-- Fully isolated from bookings / offers / wallet / escrow — nothing here touches
-- money or the FA-trial booking flow. Tournament data is written ONLY by the
-- service-role cron (no client write policies); sweepstake rows are
-- organiser-scoped via RLS, with the public share page + claim flow reading
-- through the service-role admin client (same pattern as parent-consent /
-- fa-verify token pages).
-- ============================================================================

-- ── Tournament data (public read, service-role write) ─────────────────────

-- A team in the tournament. Natural key = FIFA 3-letter code (e.g. 'BRA').
-- country_code is ISO 3166 alpha-2 lower-case (e.g. 'br') for flag images — we
-- render flags as images, never emoji (project UI convention).
CREATE TABLE IF NOT EXISTS public.wc_teams (
    code         text PRIMARY KEY,
    name         text NOT NULL,
    country_code text,
    group_letter text CHECK (group_letter IS NULL OR group_letter ~ '^[A-L]$'),
    -- Furthest stage the team has reached: drives sweepstake points. Order:
    -- group < r32 < r16 < qf < sf < final < champion.
    stage        text NOT NULL DEFAULT 'group'
        CHECK (stage IN ('group', 'r32', 'r16', 'qf', 'sf', 'final', 'champion')),
    eliminated   boolean NOT NULL DEFAULT false,
    -- Group-stage standings (for the tracker's group tables).
    played       int NOT NULL DEFAULT 0,
    won          int NOT NULL DEFAULT 0,
    drawn        int NOT NULL DEFAULT 0,
    lost         int NOT NULL DEFAULT 0,
    goals_for    int NOT NULL DEFAULT 0,
    goals_against int NOT NULL DEFAULT 0,
    group_points int NOT NULL DEFAULT 0,
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wc_teams_group ON public.wc_teams(group_letter);

-- A single fixture. external_id dedupes upserts from the results feed.
CREATE TABLE IF NOT EXISTS public.wc_matches (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id     text UNIQUE,
    stage           text NOT NULL DEFAULT 'group'
        CHECK (stage IN ('group', 'r32', 'r16', 'qf', 'sf', 'third_place', 'final')),
    group_letter    text CHECK (group_letter IS NULL OR group_letter ~ '^[A-L]$'),
    match_number    int,
    home_team_code  text REFERENCES public.wc_teams(code) ON DELETE SET NULL,
    away_team_code  text REFERENCES public.wc_teams(code) ON DELETE SET NULL,
    -- Knockout fixtures may have placeholder labels before teams are known.
    home_label      text,
    away_label      text,
    home_score      int,
    away_score      int,
    -- Penalty-shootout result, when applicable.
    home_pens       int,
    away_pens       int,
    winner_team_code text REFERENCES public.wc_teams(code) ON DELETE SET NULL,
    status          text NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'live', 'finished')),
    kickoff_at      timestamptz,
    venue           text,
    -- Reserved for future rich stats (possession / shots / scorers) without a
    -- migration — see CLAUDE.md note on the football-data.org free-tier limits.
    stats           jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wc_matches_stage ON public.wc_matches(stage);
CREATE INDEX IF NOT EXISTS idx_wc_matches_kickoff ON public.wc_matches(kickoff_at);
CREATE INDEX IF NOT EXISTS idx_wc_matches_group ON public.wc_matches(group_letter);

-- ── Sweepstakes (organiser-scoped) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.wc_sweepstakes (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organiser_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name          text NOT NULL,
    -- Short public-link slug (generated app-side). Lets anyone view the live
    -- leaderboard + claim a spot without an account.
    share_id      text NOT NULL UNIQUE,
    teams_per_player int,
    -- Points-per-stage override; NULL ⇒ app default scoring.
    scoring       jsonb,
    status        text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'drawn', 'complete')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wc_sweepstakes_organiser ON public.wc_sweepstakes(organiser_id);
CREATE INDEX IF NOT EXISTS idx_wc_sweepstakes_share ON public.wc_sweepstakes(share_id);

-- One participant (a name). May later be claimed by a real account via the
-- claim_token link, turning a casual entrant into a Whistle Connect user.
CREATE TABLE IF NOT EXISTS public.wc_sweepstake_entries (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sweepstake_id  uuid NOT NULL REFERENCES public.wc_sweepstakes(id) ON DELETE CASCADE,
    participant_name text NOT NULL,
    claimed_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    claim_token    uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wc_entries_sweepstake ON public.wc_sweepstake_entries(sweepstake_id);
CREATE INDEX IF NOT EXISTS idx_wc_entries_claimed_by ON public.wc_sweepstake_entries(claimed_by);
CREATE INDEX IF NOT EXISTS idx_wc_entries_claim_token ON public.wc_sweepstake_entries(claim_token);

-- The teams drawn to each entry (an entry can hold several when players < 48).
CREATE TABLE IF NOT EXISTS public.wc_sweepstake_entry_teams (
    sweepstake_id uuid NOT NULL REFERENCES public.wc_sweepstakes(id) ON DELETE CASCADE,
    entry_id      uuid NOT NULL REFERENCES public.wc_sweepstake_entries(id) ON DELETE CASCADE,
    team_code     text NOT NULL REFERENCES public.wc_teams(code) ON DELETE CASCADE,
    PRIMARY KEY (entry_id, team_code)
);

CREATE INDEX IF NOT EXISTS idx_wc_entry_teams_sweepstake ON public.wc_sweepstake_entry_teams(sweepstake_id);
-- A team can only be drawn once per sweepstake.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wc_entry_team_per_sweepstake
    ON public.wc_sweepstake_entry_teams(sweepstake_id, team_code);

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.wc_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wc_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wc_sweepstakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wc_sweepstake_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wc_sweepstake_entry_teams ENABLE ROW LEVEL SECURITY;

-- Tournament data: world-readable. Writes only via service-role (cron/seed),
-- which bypasses RLS — so no write policies exist (deny-by-default).
CREATE POLICY "wc_teams public read"
    ON public.wc_teams FOR SELECT
    USING (true);

CREATE POLICY "wc_matches public read"
    ON public.wc_matches FOR SELECT
    USING (true);

-- Sweepstakes: an organiser fully manages their own pools.
CREATE POLICY "wc_sweepstakes organiser all"
    ON public.wc_sweepstakes FOR ALL
    USING (auth.uid() = organiser_id)
    WITH CHECK (auth.uid() = organiser_id);

-- Entries: organiser manages all entries in their pools; a user who has claimed
-- a spot can read their own entry.
CREATE POLICY "wc_entries organiser all"
    ON public.wc_sweepstake_entries FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.wc_sweepstakes s
        WHERE s.id = sweepstake_id AND s.organiser_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.wc_sweepstakes s
        WHERE s.id = sweepstake_id AND s.organiser_id = auth.uid()
    ));

CREATE POLICY "wc_entries claimed read"
    ON public.wc_sweepstake_entries FOR SELECT
    USING (claimed_by = auth.uid());

-- Entry teams: organiser manages; a claimed user reads their own entry's teams.
CREATE POLICY "wc_entry_teams organiser all"
    ON public.wc_sweepstake_entry_teams FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.wc_sweepstakes s
        WHERE s.id = sweepstake_id AND s.organiser_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.wc_sweepstakes s
        WHERE s.id = sweepstake_id AND s.organiser_id = auth.uid()
    ));

CREATE POLICY "wc_entry_teams claimed read"
    ON public.wc_sweepstake_entry_teams FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.wc_sweepstake_entries e
        WHERE e.id = entry_id AND e.claimed_by = auth.uid()
    ));

-- ── Grants ──────────────────────────────────────────────────────────────────
-- anon reads tournament data directly; sweepstake tables are reached by
-- authenticated users (RLS-scoped) or the service-role admin client (public
-- share / claim). No anon grants on sweepstake tables.

GRANT SELECT ON public.wc_teams TO anon, authenticated;
GRANT SELECT ON public.wc_matches TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wc_sweepstakes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wc_sweepstake_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wc_sweepstake_entry_teams TO authenticated;
