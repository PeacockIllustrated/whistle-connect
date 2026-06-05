-- ============================================================================
-- Migration 0160: Add tournament_opt_in to referee_profiles
--
-- Referees can already opt in to multi-game CENTRAL VENUE bookings via
-- central_venue_opt_in (migration 0004). Tournaments are a separate booking
-- type (0153) and a referee may want to cover central-venue days but not
-- full tournament days (or vice-versa) — they are a different commitment.
--
-- This adds a parallel, independent opt-in. Defaults to false: a referee
-- explicitly opts in, exactly like the central-venue flag. Existing rows get
-- false (not surfaced for tournament searches until they opt in). The coach
-- tournament search filters on this column; see searchRefereesForBooking.
-- ============================================================================

ALTER TABLE public.referee_profiles
    ADD COLUMN IF NOT EXISTS tournament_opt_in BOOLEAN DEFAULT false NOT NULL;
