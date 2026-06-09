-- ============================================================================
-- Migration 0163: advisor-0029 lockdown — notification + trigger RPCs (WS-C)
-- Date: 2026-06-05
--
-- Live advisor lint 0029 flags every SECURITY DEFINER function that the
-- `authenticated` role can call directly via /rest/v1/rpc/<name>. This closes
-- the entries that can be locked down SAFELY with a pure grant change (no body
-- rewrite, so no risk of regressing a live function definition that may differ
-- from the repo — see the migration-drift work, WS-F):
--
--   * create_notification — has NO internal auth.uid() check (it inserts a
--     notification row for whatever p_user_id is passed), so any signed-in user
--     could spoof e.g. a "Payment Released" notification to any other user.
--     It is already called via the service-role client (createNotification),
--     which this migration makes mandatory. => revoke from authenticated.
--   * handle_new_user — a trigger function with no legitimate REST caller.
--     => revoke from authenticated.
--
-- The remaining 0029 entries are the SELF-GUARDED money/booking RPCs
-- (confirm_booking, mark_booking_complete, wallet_withdraw_*, charge_sos_fee,
-- archive_offer_*, request_account_deletion). They authorise on auth.uid()
-- internally, so calling them directly grants no extra power. Clearing their
-- lint means dropping + recreating each with an explicit actor parameter and
-- routing every caller via the service role — a larger, money-path change that
-- must be built from the LIVE function definitions and runtime-tested. Tracked
-- as a follow-up, not done blind here.
--
-- service_role keeps EXECUTE on create_notification so the admin-client path
-- works.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, public.notification_type, text)
    FROM authenticated, anon, public;
GRANT  EXECUTE ON FUNCTION public.create_notification(uuid, text, text, public.notification_type, text)
    TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user()
    FROM authenticated, anon, public;
