-- ============================================================================
-- Migration 0140: Restore EXECUTE on RLS helper functions to `authenticated`
-- Date: 2026-04-29
--
-- Fixes a regression introduced by 0138/0139.
--
-- The "internal helper" REVOKE in those migrations was correct in spirit
-- (these functions shouldn't be reachable as RPCs at /rest/v1/rpc) but
-- broke a hard requirement: when an `authenticated` user runs an INSERT /
-- UPDATE / SELECT against a table whose RLS policy expression calls one of
-- these helpers, PostgreSQL evaluates the policy expression IN THE
-- CALLING USER'S CONTEXT — even for SECURITY DEFINER functions. The
-- caller therefore needs the EXECUTE privilege.
--
-- Symptom: booking creation failed with
--   "Function Denied: check_is_booking_coach"
-- because the RLS policy on booking_offers (migration 0136) calls it.
--
-- Affected RLS-helper functions:
--   - check_is_booking_coach(uuid, uuid)
--     Used by booking_offers / booking_assignments / threads /
--     thread_participants INSERT policies (0111, 0136).
--   - check_is_booking_referee(uuid, uuid)
--     Available for use in messaging policies.
--   - is_thread_participant(uuid, uuid)
--     Used by threads / thread_participants / messages SELECT + INSERT
--     policies (0002).
--   - is_admin(uuid)
--     Used by admin SELECT / UPDATE policies on bookings, referee_profiles,
--     badges (0002).
--   - user_can_view_booking(uuid, uuid)
--     Available helper, may be used by future policies.
--   - get_user_role(uuid)
--     Helper, may be referenced.
--
-- Anon EXECUTE remains revoked. These functions still aren't reachable
-- without a session.
--
-- Cost: re-introduces the advisor's
-- `authenticated_security_definer_function_executable` lint for these
-- six functions. That's an accepted tradeoff — the alternative (moving
-- the helpers to a private schema) is a wider refactor for a later PR.
-- ============================================================================

DO $$
DECLARE
    fn record;
    rls_helpers text[] := ARRAY[
        'check_is_booking_coach',
        'check_is_booking_referee',
        'is_thread_participant',
        'is_admin',
        'user_can_view_booking',
        'get_user_role'
    ];
BEGIN
    FOR fn IN
        SELECT n.nspname, p.proname, oidvectortypes(p.proargtypes) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = ANY(rls_helpers)
    LOOP
        EXECUTE format(
            'GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',
            fn.proname, fn.args
        );
    END LOOP;
END
$$;
