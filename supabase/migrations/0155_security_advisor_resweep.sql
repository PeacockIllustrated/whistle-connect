-- ============================================================================
-- Migration 0155: Security advisor re-sweep
-- Date: 2026-05-15
--
-- Re-applies the function-level hardening from migration 0138. Later
-- migrations that used CREATE OR REPLACE FUNCTION / CREATE FUNCTION silently
-- regressed two protections, because Postgres resets per-function config and
-- re-grants default EXECUTE to PUBLIC on every (re)create:
--
--   - search_path went back to NULL (mutable) on:
--       confirm_booking            (0150_confirm_booking_accepts_price)
--       archive_offer_as_coach     (0151_offer_per_user_archive)
--       archive_offer_as_referee   (0151_offer_per_user_archive)
--       escrow_release             (0144_dual_completion_confirmation)
--   - anon / PUBLIC regained EXECUTE on the money + booking RPCs, including
--     functions added after 0138 and never covered by it:
--       wallet_withdraw_begin / _cancel / _finalise  (0143_atomic_withdraw)
--       mark_booking_complete                         (0144_dual_completion)
--       charge_sos_fee                                (0154_sos_premium_fee)
--       confirm_booking, archive_offer_as_coach/referee (recreated)
--
-- Lints addressed (live advisor, 2026-05-15):
--   0011 — function_search_path_mutable
--   0028 — anon_security_definer_function_executable
--
-- This migration is idempotent and convention-identical to 0138. It only
-- touches anon / PUBLIC EXECUTE and per-function search_path. It does NOT
-- alter `authenticated` or `service_role` grants, so the RLS-helper grants
-- restored by migration 0140 and all app-context RPC calls (cookie client =
-- `authenticated`, admin client = `service_role`) are preserved.
--
-- Out of scope (accepted, same stance as 0138):
--   0013/0014 — PostGIS extension + spatial_ref_sys in `public`. Extension-
--               owned objects can't be ALTERed by the migration role
--               ("must be owner"); spatial_ref_sys is a static SRID lookup
--               with no sensitive data. Moving PostGIS is its own PR.
--   0029 — authenticated_security_definer_function_executable. Tightening
--               this without per-function auth.uid() guards risks breaking
--               server actions; tracked as a documented follow-up.
--   Auth leaked-password protection — project setting, toggle in dashboard.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Pin search_path on every SECURITY DEFINER function in `public` that we
--    own (skip extension-owned, e.g. PostGIS st_estimatedextent). Idempotent:
--    re-pins the regressed functions and is a no-op for already-pinned ones.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    fn record;
BEGIN
    FOR fn IN
        SELECT p.proname, oidvectortypes(p.proargtypes) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prosecdef = TRUE
          AND NOT EXISTS (
              SELECT 1 FROM pg_depend d
              WHERE d.objid = p.oid
                AND d.deptype = 'e'
          )
    LOOP
        EXECUTE format(
            'ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp',
            fn.proname, fn.args
        );
    END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- 2. REVOKE EXECUTE from anon AND PUBLIC on every SECURITY DEFINER function in
--    `public` that we own. No SECURITY DEFINER RPC in this app is ever called
--    from an unauthenticated context — server actions use the cookie client
--    (`authenticated`) or the admin client (`service_role`). Revoking PUBLIC
--    as well closes the inherited-grant path (the advisor showed `=X` /
--    PUBLIC EXECUTE on archive_offer_* and confirm_booking).
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    fn record;
BEGIN
    FOR fn IN
        SELECT p.proname, oidvectortypes(p.proargtypes) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prosecdef = TRUE
          AND NOT EXISTS (
              SELECT 1 FROM pg_depend d
              WHERE d.objid = p.oid
                AND d.deptype = 'e'
          )
    LOOP
        EXECUTE format(
            'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, PUBLIC',
            fn.proname, fn.args
        );
    END LOOP;
END
$$;
