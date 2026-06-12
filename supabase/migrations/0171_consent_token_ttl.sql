-- ============================================================================
-- Migration 0171: Consent / FA-verify token TTL
-- Date: 2026-06-12
--
-- Safeguarding hardening (launch-blocker H1). The parental-consent and
-- FA-verify response tokens were previously valid forever. Combined with the
-- move from a state-mutating GET to an explicit human POST (see
-- /api/parent-consent + /api/fa-verify), we now also bound the token lifetime
-- so a stale link found later (forwarded email, archived inbox) cannot resolve
-- a minor's account.
--
-- Pure DDL: adds a nullable expires_at column to each token table, defaulting
-- to created_at + 14 days for new rows, and backfills existing rows from their
-- created_at. The POST handlers reject (render an "expired" state) when
-- expires_at is in the past. No functions are (re)defined here, so the
-- SECURITY DEFINER search_path / EXECUTE-revoke guard does not apply.
--
-- Reversible: DROP COLUMN public.parental_consents.expires_at;
--             DROP COLUMN public.fa_verification_requests.expires_at;
-- ============================================================================

-- 1. Parental-consent token TTL.
ALTER TABLE public.parental_consents
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Default new rows to 14 days after creation.
ALTER TABLE public.parental_consents
    ALTER COLUMN expires_at SET DEFAULT (now() + interval '14 days');

-- Backfill existing rows from their created_at (fall back to now() if absent).
UPDATE public.parental_consents
SET expires_at = COALESCE(created_at, now()) + interval '14 days'
WHERE expires_at IS NULL;

-- 2. FA-verification token TTL (same shape).
ALTER TABLE public.fa_verification_requests
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE public.fa_verification_requests
    ALTER COLUMN expires_at SET DEFAULT (now() + interval '14 days');

UPDATE public.fa_verification_requests
SET expires_at = COALESCE(created_at, now()) + interval '14 days'
WHERE expires_at IS NULL;
