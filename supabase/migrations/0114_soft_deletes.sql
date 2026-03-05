-- ============================================================================
-- Migration 0114: Soft deletes for bookings
--
-- Adds a deleted_at column so bookings are never permanently removed.
-- Existing RLS SELECT policies are updated to exclude soft-deleted rows.
-- ============================================================================

-- 1. Add column (nullable — NULL means not deleted)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Create partial index for fast queries on active bookings
CREATE INDEX IF NOT EXISTS idx_bookings_active
ON bookings (coach_id, status)
WHERE deleted_at IS NULL;

-- 3. Update the coach SELECT policy to exclude soft-deleted bookings
DROP POLICY IF EXISTS "coaches can view own bookings" ON bookings;
CREATE POLICY "coaches can view own bookings"
ON bookings FOR SELECT
USING (
    coach_id = auth.uid()
    AND deleted_at IS NULL
);

-- 4. Update the referee SELECT policy (via offers/assignments) to exclude soft-deleted
DROP POLICY IF EXISTS "referees can view offered bookings" ON bookings;
CREATE POLICY "referees can view offered bookings"
ON bookings FOR SELECT
USING (
    deleted_at IS NULL
    AND (
        EXISTS (
            SELECT 1 FROM booking_offers
            WHERE booking_offers.booking_id = bookings.id
            AND booking_offers.referee_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM booking_assignments
            WHERE booking_assignments.booking_id = bookings.id
            AND booking_assignments.referee_id = auth.uid()
        )
    )
);
