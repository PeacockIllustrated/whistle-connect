-- ============================================================================
-- Migration 0131: Data Reconciliation
--
-- Fixes inconsistencies in existing data caused by earlier code bugs:
--   1. Syncs verified boolean with fa_verification_status
--   2. Backfills geography columns from lat/lon
--   3. Withdraws orphaned offers for cancelled/deleted bookings
--   4. Ensures all referee_profiles exist for referee users
--   5. Cleans up expired SOS bookings
-- ============================================================================

-- ── 1. Sync verified ↔ fa_verification_status ──────────────────────────────
-- Referees marked verified=true by admin but still showing 'pending' or
-- 'not_provided' in their profile (the old verifyReferee action only set
-- the boolean, not the enum).

UPDATE referee_profiles
SET fa_verification_status = 'verified'
WHERE verified = true
  AND fa_verification_status IN ('pending', 'not_provided');

-- ── 2. Backfill geography columns ──────────────────────────────────────────
-- Rows with lat/lon but no geography point (trigger only fires on writes).

UPDATE profiles
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND location IS NULL;

UPDATE bookings
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND location IS NULL;

-- ── 3. Withdraw orphaned offers ────────────────────────────────────────────
-- Offers still in 'sent' or 'accepted_priced' for bookings that were
-- cancelled or soft-deleted. These would linger in referee inboxes.

UPDATE booking_offers
SET status = 'withdrawn'
WHERE status IN ('sent', 'accepted_priced')
  AND booking_id IN (
    SELECT id FROM bookings
    WHERE status = 'cancelled' OR deleted_at IS NOT NULL
  );

-- ── 4. Ensure referee_profiles exist ───────────────────────────────────────
-- If the auth trigger failed silently, a referee user might exist in
-- profiles but have no referee_profiles row.

INSERT INTO referee_profiles (profile_id)
SELECT id FROM profiles
WHERE role = 'referee'
  AND id NOT IN (SELECT profile_id FROM referee_profiles)
ON CONFLICT (profile_id) DO NOTHING;

-- ── 5. Expire stale SOS bookings ──────────────────────────────────────────
-- SOS bookings past their expiry that are still in pending/offered status.

UPDATE bookings
SET status = 'cancelled'
WHERE is_sos = true
  AND sos_expires_at IS NOT NULL
  AND sos_expires_at < now()
  AND status IN ('pending', 'offered');

-- ── 6. Clean up duplicate/conflicting assignments ─────────────────────────
-- If a booking somehow got multiple assignments, keep only the latest.

DELETE FROM booking_assignments
WHERE id NOT IN (
    SELECT DISTINCT ON (booking_id) id
    FROM booking_assignments
    ORDER BY booking_id, created_at DESC
);
