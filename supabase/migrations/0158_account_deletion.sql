-- ============================================================================
-- Migration 0158: In-app account deletion (App Store / Play Store compliance)
-- Date: 2026-06-03
--
-- Apple Guideline 5.1.1(v) and Google Play both REQUIRE a logged-in user to be
-- able to delete their own account + personal data from inside the app. This
-- migration adds the data-layer half of that: a self-service deletion RPC.
--
-- DESIGN: ANONYMIZE, DO NOT HARD-DELETE.
-- We deliberately do NOT `DELETE FROM profiles` (which would cascade-delete
-- bookings, offers, assignments, wallets, wallet_transactions, withdrawal_
-- requests, disputes, etc. via ON DELETE CASCADE). Those rows are financial /
-- audit records we are legally and operationally required to retain (UK money-
-- movement audit trail, tax, dispute history, escrow ledger immutability — see
-- 0126 wallet_transactions immutability triggers). Instead we strip the
-- personal data from `profiles` (and `referee_profiles`), set `deleted_at`, and
-- the application disables login for the auth.users row (ban + email release in
-- the server action). The transactional ledger stays intact but no longer
-- references a real, contactable person.
--
-- MONEY-SAFE: deletion is BLOCKED while the caller still has value or open
-- commitments in the system — a positive wallet balance, a pending withdrawal,
-- escrow still held against any of their bookings, or active (offered/confirmed)
-- bookings as coach or assigned referee. The user is told to resolve these
-- first. This prevents stranding funds or orphaning a counterparty mid-deal.
--
-- The RPC operates ONLY on auth.uid() — a caller can only delete themselves;
-- there is no id argument to abuse.
-- ============================================================================

-- 1. Soft-delete marker on profiles. Idempotent.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ----------------------------------------------------------------------------
-- 2. request_account_deletion — self-service, anonymize-not-delete.
--    SECURITY DEFINER + pinned search_path to match the 0155 invariant. The
--    function MUST self-check via auth.uid(); there is no id parameter.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id            UUID := auth.uid();
    v_balance_pence      INTEGER;
    v_pending_count      INTEGER;
    v_escrow_count       INTEGER;
    v_active_count       INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to delete your account.';
    END IF;

    -- Blocking condition 1: remaining wallet balance must be withdrawn first.
    -- (pending_withdrawal_pence is already debited from balance_pence at the
    --  begin step — a non-zero pending withdrawal is caught by condition 2.)
    SELECT COALESCE(balance_pence, 0)
    INTO v_balance_pence
    FROM wallets
    WHERE user_id = v_user_id;

    IF COALESCE(v_balance_pence, 0) > 0 THEN
        RAISE EXCEPTION 'Please withdraw your remaining balance before deleting your account.';
    END IF;

    -- Blocking condition 2: any in-flight withdrawal.
    SELECT COUNT(*)
    INTO v_pending_count
    FROM withdrawal_requests
    WHERE user_id = v_user_id
      AND status = 'pending';

    IF v_pending_count > 0 THEN
        RAISE EXCEPTION 'You have a withdrawal in progress — wait for it to complete before deleting your account.';
    END IF;

    -- Blocking condition 3: escrow still held against any booking where the
    -- caller is the coach (money in) or the assigned referee (money owed).
    SELECT COUNT(*)
    INTO v_escrow_count
    FROM bookings b
    LEFT JOIN booking_assignments ba ON ba.booking_id = b.id
    WHERE COALESCE(b.escrow_amount_pence, 0) > 0
      AND b.escrow_released_at IS NULL
      AND (b.coach_id = v_user_id OR ba.referee_id = v_user_id);

    IF v_escrow_count > 0 THEN
        RAISE EXCEPTION 'You have funds held in escrow on a booking — resolve them before deleting your account.';
    END IF;

    -- Blocking condition 4: active commitments (a live deal the other party is
    -- relying on). 'offered' and 'confirmed' are the in-flight states between
    -- both parties; 'completed'/'cancelled'/'draft'/'pending' don't strand a
    -- counterparty.
    SELECT COUNT(*)
    INTO v_active_count
    FROM bookings b
    LEFT JOIN booking_assignments ba ON ba.booking_id = b.id
    WHERE b.status IN ('offered', 'confirmed')
      AND (b.coach_id = v_user_id OR ba.referee_id = v_user_id);

    IF v_active_count > 0 THEN
        RAISE EXCEPTION 'You have active bookings — resolve them before deleting your account.';
    END IF;

    -- All clear. Anonymize the personal data on the profile and mark deleted.
    -- We only null columns that actually exist on profiles (see 0156 + types.ts).
    UPDATE public.profiles
    SET full_name     = 'Deleted user',
        phone         = NULL,
        postcode      = NULL,
        latitude      = NULL,
        longitude     = NULL,
        avatar_url    = NULL,
        club_name     = NULL,
        date_of_birth = NULL,
        deleted_at    = now(),
        updated_at    = now()
    WHERE id = v_user_id;

    -- Strip personal identifiers from the referee profile if one exists.
    -- fa_id is personally identifying (FA registration number); null it and
    -- reset its verification status. Other referee_profiles columns are
    -- non-personal operational state.
    UPDATE public.referee_profiles
    SET fa_id                  = NULL,
        fa_verification_status = 'not_provided'
    WHERE profile_id = v_user_id;
END;
$$;

-- Authenticated callers only — never anon / PUBLIC (0155 invariant).
REVOKE EXECUTE ON FUNCTION public.request_account_deletion() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_account_deletion() TO authenticated;
