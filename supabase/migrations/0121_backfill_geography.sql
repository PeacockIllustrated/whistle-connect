-- ============================================================================
-- Migration 0121: Backfill Geography Column
--
-- Existing profiles and bookings may have latitude/longitude values but
-- a NULL location geography column because the trigger only fires on
-- INSERT or UPDATE OF latitude, longitude. This migration backfills
-- the geography point for all rows that have coordinates but no location.
-- ============================================================================

-- Backfill profiles with lat/lon but no geography point
UPDATE profiles
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND location IS NULL;

-- Backfill bookings with lat/lon but no geography point
UPDATE bookings
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND location IS NULL;
