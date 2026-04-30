-- ============================================================================
-- Migration 0146: default new referees to available
-- Date: 2026-04-30
--
-- Today the `is_available` column on `referee_profiles` defaults to `false`,
-- which means a referee who signs up has to remember to flip the toggle on
-- before any coach can find them. That's a bad first-run experience — and
-- worse, it silently makes the platform feel empty to coaches because the
-- referee directory only shows opted-in refs.
--
-- This migration flips the column default to `true`. Future signups (via the
-- `handle_new_user` auth trigger and the explicit `referee_profiles` inserts
-- in src/lib/auth/actions.ts) will land as available without needing the
-- ref to remember to toggle the switch.
--
-- We deliberately do NOT backfill existing rows. Any ref currently sitting
-- on `false` may have actively turned themselves off, and we shouldn't
-- override an explicit choice. They can flip back on from /app/availability
-- if they want.
-- ============================================================================

ALTER TABLE public.referee_profiles
    ALTER COLUMN is_available SET DEFAULT true;
