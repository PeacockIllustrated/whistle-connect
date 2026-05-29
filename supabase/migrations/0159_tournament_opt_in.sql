-- ============================================================================
-- Migration 0159: Tournament opt-in for referees
-- Date: 2026-05-26
--
-- Mirrors 0004 (central_venue_opt_in). Tournament bookings are a tighter
-- commitment than a single match — a referee signs up for a whole day at one
-- venue, often across multiple age groups. Refs should be able to opt in
-- specifically, separate from central-venue opt-in, so the search query for
-- a tournament booking only surfaces refs who've explicitly agreed to that
-- workload.
--
-- searchRefereesForBooking filters on this column when booking_type =
-- 'tournament' (separate edit in src/app/app/bookings/actions.ts).
--
-- Additive only — column defaults to FALSE so existing refs stay opted out
-- until they tick the box on /app/availability. Rollback is risk-free.
-- ============================================================================

ALTER TABLE referee_profiles
    ADD COLUMN IF NOT EXISTS tournament_opt_in BOOLEAN NOT NULL DEFAULT FALSE;
