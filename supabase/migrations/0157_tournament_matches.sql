-- ============================================================================
-- Migration 0157: Tournament & central-venue multi-match schedule
-- Date: 2026-05-16
--
-- A tournament/central booking is ONE bookings row booked by ONE referee as a
-- unit (one offer, one escrow hold, one price, one assignment) — unchanged
-- escrow/offer machinery. The per-fixture schedule lives in child
-- tournament_matches rows (descriptive only; not separately bookable/priced).
--
-- Parent booking carries the shared fields (county, match_date, venue,
-- postcode, age_group, format, notes); booking_type distinguishes
-- tournament vs central; tournament_name is set for tournaments, NULL for
-- central. Parent kickoff_time is set to the earliest match time so the
-- feed / notifications / find_bookings_near_referee keep working unchanged.
-- ============================================================================

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS tournament_name text;

CREATE TABLE IF NOT EXISTS public.tournament_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    kickoff_time TIME NOT NULL,
    home_team TEXT,
    away_team TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_booking
    ON public.tournament_matches(booking_id);

-- RLS — mirrors the booking_assignments pattern: anyone who can see the parent
-- booking can read the schedule; only the owning coach can write it. Helper
-- functions are SECURITY DEFINER + granted to `authenticated` (0140), and
-- search_path-pinned (0155).
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Involved parties can view tournament matches"
    ON public.tournament_matches FOR SELECT
    USING (
        public.check_is_booking_coach(booking_id, auth.uid())
        OR public.check_is_booking_referee(booking_id, auth.uid())
        OR public.is_admin(auth.uid())
    );

CREATE POLICY "Owning coach can insert tournament matches"
    ON public.tournament_matches FOR INSERT
    WITH CHECK (public.check_is_booking_coach(booking_id, auth.uid()));

CREATE POLICY "Owning coach can update tournament matches"
    ON public.tournament_matches FOR UPDATE
    USING (public.check_is_booking_coach(booking_id, auth.uid()));

CREATE POLICY "Owning coach can delete tournament matches"
    ON public.tournament_matches FOR DELETE
    USING (public.check_is_booking_coach(booking_id, auth.uid()));
