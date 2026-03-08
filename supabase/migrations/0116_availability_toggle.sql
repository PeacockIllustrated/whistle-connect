-- ============================================================================
-- Migration 0116: Availability Toggle
--
-- Adds a simple is_available boolean to referee_profiles so referees can
-- toggle their availability on/off for the match feed and SOS broadcasts.
-- ============================================================================

-- Add is_available toggle (defaults to false — referees must opt in)
ALTER TABLE referee_profiles
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT false;

-- Index for fast filtering of available referees
CREATE INDEX IF NOT EXISTS idx_referee_available
  ON referee_profiles(is_available) WHERE is_available = true;
