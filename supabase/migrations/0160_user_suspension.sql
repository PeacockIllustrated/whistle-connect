-- ============================================================================
-- Migration 0160: Admin user suspension (moderation eject) — Apple 1.2
-- Date: 2026-06-03
--
-- Adds a suspension marker to profiles so admins can eject an abusive user in
-- response to a report. The admin server action sets these columns via the
-- service-role client AND bans the auth.users row (reversible ban_duration), so
-- the suspension takes effect immediately (session killed, re-login refused).
-- sendMessage also checks suspended_at as defense-in-depth for the short window
-- before an existing access token expires.
--
-- Idempotent. No RLS policy is needed: admins mutate these columns through the
-- service-role client (bypasses RLS); no client-facing role may write them.
-- ============================================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS suspended_at     timestamptz,
    ADD COLUMN IF NOT EXISTS suspended_reason text;
