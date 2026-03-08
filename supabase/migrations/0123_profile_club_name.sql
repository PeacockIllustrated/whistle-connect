-- ============================================================================
-- Migration 0123: Add club_name to profiles
--
-- Allows coaches to store their club name on their profile, shown in messages
-- so referees can identify which club a coach represents.
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS club_name TEXT DEFAULT NULL;
