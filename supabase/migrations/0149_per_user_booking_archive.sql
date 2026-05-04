-- ============================================================================
-- Migration 0149: Per-user booking archive
--
-- Coaches and referees each get their own archive flag, distinct from
-- bookings.deleted_at (which is the coach's "withdraw a pre-confirmation
-- booking" soft-delete). Archive is for putting completed/cancelled bookings
-- out of the way without affecting the other party's view.
--
--   bookings.coach_archived_at         — coach has archived (their view only)
--   booking_assignments.archived_at    — referee has archived their assignment
--
-- Existing RLS already permits coach to UPDATE their own bookings and refs to
-- UPDATE their own assignments — no policy changes needed.
-- ============================================================================

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS coach_archived_at TIMESTAMPTZ;

ALTER TABLE booking_assignments
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Partial indexes for the two hot paths: "show me only active bookings" and
-- "show me only my archived ones". Partial because the inverse condition is
-- the common case so we don't want to inflate the index.
CREATE INDEX IF NOT EXISTS idx_bookings_coach_active
    ON bookings (coach_id, match_date DESC)
    WHERE deleted_at IS NULL AND coach_archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_coach_archived
    ON bookings (coach_id, match_date DESC)
    WHERE deleted_at IS NULL AND coach_archived_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_referee_active
    ON booking_assignments (referee_id, booking_id)
    WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_referee_archived
    ON booking_assignments (referee_id, booking_id)
    WHERE archived_at IS NOT NULL;
