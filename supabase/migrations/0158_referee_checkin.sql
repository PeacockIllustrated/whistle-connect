-- ============================================================================
-- Migration 0158: Referee check-in at venue (FA-trial evidence)
-- Date: 2026-05-26
--
-- Adds a check-in surface so the assigned referee can confirm "I am at the
-- ground, ready to ref" 30 minutes out from kickoff. Captures:
--   - timestamp of check-in
--   - browser-reported lat/lng + accuracy (geolocation API)
--   - server-computed distance from the booking's venue lat/lng
--   - optional uploaded photo evidence (Supabase Storage)
--
-- Distance is logged (not enforced) — a >500m warning is shown in the UI,
-- but check-in still proceeds. The audit trail is what matters for the FA
-- trial; we are NOT trying to police location.
--
-- Both the coach and the assigned ref can see the check-in status on the
-- booking detail page. The photo bucket is PRIVATE; only those two parties
-- can read it.
--
-- Additive only. All columns are nullable; the existing booking lifecycle
-- is unchanged for bookings with no check-in. Rollback is risk-free.
-- ============================================================================

-- 1. Booking columns
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS referee_checked_in_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS checkin_lat            DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS checkin_lng            DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS checkin_accuracy_m     DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS checkin_distance_m     DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS checkin_evidence_path  TEXT;

-- ----------------------------------------------------------------------------
-- 2. Storage bucket: checkin-evidence
--
-- Private bucket. Path convention enforced by the server action:
--   {bookingId}/{filename}
-- so `(storage.foldername(name))[1]` resolves to the booking UUID and lets
-- us scope RLS to the coach + assigned ref of that specific booking.
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('checkin-evidence', 'checkin-evidence', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Read: only the coach who owns the booking OR an assigned ref on it.
DROP POLICY IF EXISTS "Check-in evidence read for booking parties" ON storage.objects;
CREATE POLICY "Check-in evidence read for booking parties" ON storage.objects
FOR SELECT USING (
    bucket_id = 'checkin-evidence'
    AND EXISTS (
        SELECT 1 FROM bookings b
        LEFT JOIN booking_assignments ba
            ON ba.booking_id = b.id AND ba.referee_id = auth.uid()
        WHERE b.id::text = (storage.foldername(name))[1]
          AND (b.coach_id = auth.uid() OR ba.referee_id IS NOT NULL)
    )
);

-- Insert: only the assigned ref on the booking can upload, and only into
-- the matching folder (preventing a ref from writing into someone else's
-- booking folder).
DROP POLICY IF EXISTS "Check-in evidence insert by assigned ref" ON storage.objects;
CREATE POLICY "Check-in evidence insert by assigned ref" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'checkin-evidence'
    AND EXISTS (
        SELECT 1 FROM booking_assignments ba
        WHERE ba.booking_id::text = (storage.foldername(name))[1]
          AND ba.referee_id = auth.uid()
    )
);

-- Update + Delete: same gate as insert. Lets the ref re-upload if they
-- realise the first photo was unusable, without admin intervention.
DROP POLICY IF EXISTS "Check-in evidence update by assigned ref" ON storage.objects;
CREATE POLICY "Check-in evidence update by assigned ref" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'checkin-evidence'
    AND EXISTS (
        SELECT 1 FROM booking_assignments ba
        WHERE ba.booking_id::text = (storage.foldername(name))[1]
          AND ba.referee_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Check-in evidence delete by assigned ref" ON storage.objects;
CREATE POLICY "Check-in evidence delete by assigned ref" ON storage.objects
FOR DELETE USING (
    bucket_id = 'checkin-evidence'
    AND EXISTS (
        SELECT 1 FROM booking_assignments ba
        WHERE ba.booking_id::text = (storage.foldername(name))[1]
          AND ba.referee_id = auth.uid()
    )
);
