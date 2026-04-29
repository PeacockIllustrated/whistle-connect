-- ============================================================================
-- Migration 0139: Finish the security advisor sweep
-- Date: 2026-04-29
--
-- 0138 used REVOKE EXECUTE FROM anon / authenticated, which is necessary but
-- not sufficient: PostgreSQL grants EXECUTE to PUBLIC by default on every
-- function created without explicit grants. The advisor still flagged 26
-- anon + 26 authenticated SECDEF functions because PUBLIC includes anon and
-- authenticated.
--
-- This migration:
--   1. REVOKE EXECUTE ... FROM PUBLIC on every function in public that we
--      own (skipping extension-owned PostGIS helpers). This removes the
--      implicit grant that was undermining 0138.
--   2. Re-GRANT EXECUTE ... TO authenticated explicitly on the user-callable
--      RPCs that actually need it from a user-context client. Service role
--      keeps its grant separately and bypasses anyway.
--   3. Pin search_path on the 4 remaining SECURITY INVOKER trigger / helper
--      functions that 0138's prosecdef = TRUE filter excluded.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. REVOKE EXECUTE FROM PUBLIC on every non-extension function in public
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    fn record;
BEGIN
    FOR fn IN
        SELECT n.nspname, p.proname, oidvectortypes(p.proargtypes) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND NOT EXISTS (
              SELECT 1 FROM pg_depend d
              WHERE d.objid = p.oid
                AND d.deptype = 'e'
          )
    LOOP
        EXECUTE format(
            'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC',
            fn.proname, fn.args
        );
    END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- 2. Re-grant authenticated EXECUTE on the seven user-callable RPCs.
--    These are called from server actions or API routes via a user-context
--    Supabase client and must remain reachable to authenticated callers.
--    Anon does not get a grant.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    fn record;
    user_rpcs text[] := ARRAY[
        'confirm_booking',
        'claim_sos_booking',
        'create_notification',
        'find_bookings_near_referee',
        'find_referees_within_radius',
        'escrow_refund',
        'wallet_withdraw'
    ];
BEGIN
    FOR fn IN
        SELECT n.nspname, p.proname, oidvectortypes(p.proargtypes) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = ANY(user_rpcs)
    LOOP
        EXECUTE format(
            'GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',
            fn.proname, fn.args
        );
    END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- 3. Pin search_path on remaining SECURITY INVOKER trigger / helper functions
--    that 0138 missed (prosecdef = TRUE filter excluded them). Closes lint
--    0011 for these.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    fn record;
    remaining_fns text[] := ARRAY[
        'prevent_transaction_mutation',
        'update_updated_at',
        'update_wallet_updated_at',
        'compute_location_point'
    ];
BEGIN
    FOR fn IN
        SELECT n.nspname, p.proname, oidvectortypes(p.proargtypes) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = ANY(remaining_fns)
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
