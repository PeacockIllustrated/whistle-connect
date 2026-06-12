-- ============================================================================
-- Migration 0172: rate_limit_counters — shared-store backstop for email sends
--
-- The in-memory limiter in src/lib/rate-limit.ts is per-lambda: on Vercel each
-- cold-start / instance gets a fresh window, so it does NOT bound the absolute
-- rate of outbound transactional email. An attacker rotating the target address
-- (signup confirmation, password reset, parent-consent, FA-verify, resend) could
-- mail-bomb arbitrary addresses via the Make->Zoho hub without ever tripping the
-- per-instance counter.
--
-- This adds a Postgres-backed fixed-window counter, keyed per recipient, that the
-- email-send paths consult before dispatching. It is a backstop ONLY — the
-- in-memory limiter stays in place as the first (cheap) line of defence.
--
-- The table is service-role only (RLS enabled, NO anon/authenticated policies)
-- and the increment goes through a SECURITY DEFINER RPC so a signed-in user
-- cannot read or tamper with counters over /rest/v1. search_path is pinned and
-- EXECUTE is revoked from anon/PUBLIC (granted to service_role only), matching
-- the project's money/notification RPC posture (0162/0163).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
    key          TEXT        NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    count        INTEGER     NOT NULL DEFAULT 0,
    PRIMARY KEY (key, window_start)
);

-- RLS on, no policies: only the service-role key (which bypasses RLS) can touch
-- this table directly. The RPC below is the only intended write path.
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.rate_limit_counters FROM anon, authenticated, PUBLIC;

-- ----------------------------------------------------------------------------
-- rate_limit_hit(p_key, p_window_seconds, p_max)
--
-- Atomically increments the counter for the CURRENT fixed-window bucket (the
-- window start is floored to a multiple of p_window_seconds since the epoch) and
-- returns TRUE if the caller is now OVER the limit (i.e. this hit should be
-- BLOCKED), FALSE otherwise. The first p_max hits in a window return FALSE; the
-- (p_max + 1)th and beyond return TRUE.
--
-- Single atomic upsert: INSERT ... ON CONFLICT DO UPDATE SET count = count + 1
-- with RETURNING gives us the post-increment count under row lock, so concurrent
-- calls cannot under-count.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
    p_key TEXT,
    p_window_seconds INTEGER,
    p_max INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_window_start TIMESTAMPTZ;
    v_count        INTEGER;
BEGIN
    IF p_key IS NULL OR p_window_seconds IS NULL OR p_window_seconds <= 0 OR p_max IS NULL THEN
        -- Misuse: fail open (do not block) so a bad call can't lock out email.
        RETURN FALSE;
    END IF;

    -- Floor "now" to the start of the current fixed window bucket.
    v_window_start := to_timestamp(
        floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
    );

    INSERT INTO public.rate_limit_counters (key, window_start, count)
    VALUES (p_key, v_window_start, 1)
    ON CONFLICT (key, window_start)
    DO UPDATE SET count = public.rate_limit_counters.count + 1
    RETURNING count INTO v_count;

    RETURN v_count > p_max;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rate_limit_hit(TEXT, INTEGER, INTEGER) FROM anon, authenticated, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rate_limit_hit(TEXT, INTEGER, INTEGER) TO service_role;
