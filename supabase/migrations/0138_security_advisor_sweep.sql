-- ============================================================================
-- Migration 0138: Security advisor sweep
-- Date: 2026-04-29
--
-- Tightens issues flagged by the Supabase security advisor on the live
-- database. Counterpart to migration 0111 which fixed the table-level RLS
-- policies; this migration fixes the function-level exposures.
--
-- Lints addressed:
--   0011 — function_search_path_mutable: pin search_path on every SECURITY
--          DEFINER function in the public schema so they can't be hijacked.
--   0028 — anon_security_definer_function_executable: REVOKE anon EXECUTE
--          on functions that should never be reachable without a session.
--   0029 — authenticated_security_definer_function_executable: REVOKE
--          authenticated EXECUTE on functions that are RLS helpers, trigger
--          handlers, or service-role-only RPCs.
--   0025 — public_bucket_allows_listing: drop the broad "Public Access"
--          policy on storage.objects for the `avatars` bucket. Direct object
--          reads still work because the bucket has `public = true`; we just
--          stop exposing the LIST endpoint.
--
-- Out of scope (flagged for follow-up):
--   0013 + 0014 — PostGIS extension in `public` schema. Moving the
--          extension is invasive (rewrites geo function references) and
--          deserves its own carefully-tested migration.
--   Auth — leaked-password protection toggle is a project setting, not a
--          DDL change. Toggle in the Supabase dashboard.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. REVOKE EXECUTE on internal/trigger/helper functions from anon AND
--    authenticated. These should never be reachable via /rest/v1/rpc.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    fn record;
    -- Functions that are pure RLS helpers, trigger handlers, or service-role
    -- only RPCs. None of these are called from a user-context Supabase client
    -- in the application code (verified via grep on src/).
    internal_fns text[] := ARRAY[
        -- Trigger handlers
        'auto_mark_available_on_slot_insert',
        'compute_location_point',
        'handle_new_user',
        'prevent_transaction_mutation',
        'recalculate_reliability',
        'trigger_recalc_on_booking_complete',
        'trigger_recalc_on_rating',
        'trigger_recalc_on_withdrawal',
        'update_updated_at',
        'update_wallet_updated_at',
        -- RLS helpers (used inside policy bodies, not as user RPCs)
        'is_admin',
        'is_thread_participant',
        'check_is_booking_coach',
        'check_is_booking_referee',
        'user_can_view_booking',
        'get_user_role',
        -- Service-role only RPCs (called via adminClient or RPC chain only)
        'admin_wallet_adjustment',
        'escrow_hold',
        'escrow_release',
        'wallet_top_up'
    ];
BEGIN
    FOR fn IN
        SELECT n.nspname, p.proname, oidvectortypes(p.proargtypes) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = ANY(internal_fns)
    LOOP
        EXECUTE format(
            'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, authenticated',
            fn.proname, fn.args
        );
    END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- 2. REVOKE EXECUTE from anon only on user-callable RPCs. These run in user
--    context and need the authenticated grant retained.
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
            'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon',
            fn.proname, fn.args
        );
    END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- 3. Pin search_path on every SECURITY DEFINER function in public.
--    Prevents search-path-hijack escalation; closes lint 0011.
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
          AND p.prosecdef = TRUE
    LOOP
        EXECUTE format(
            'ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp',
            fn.proname, fn.args
        );
    END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- 4. Avatars storage bucket: drop the broad SELECT policy that lets clients
--    list files. The bucket's `public` flag still permits direct GET requests
--    for known object URLs.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
