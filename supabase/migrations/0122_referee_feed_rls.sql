-- ============================================================================
-- Migration 0122: Allow referees to view pending/offered bookings
--
-- The referee match feed RPC (SECURITY DEFINER) can find nearby bookings,
-- but expressInterest() needs to SELECT the booking directly before creating
-- an offer. Without this policy, RLS blocks the read because no offer exists
-- yet for that referee.
--
-- This policy lets any authenticated referee view bookings that are still
-- open for interest (pending or offered status, not soft-deleted).
-- ============================================================================

CREATE POLICY "referees can view available bookings"
ON bookings FOR SELECT
USING (
    deleted_at IS NULL
    AND status IN ('pending', 'offered')
    AND auth.uid() IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'referee'
    )
);
