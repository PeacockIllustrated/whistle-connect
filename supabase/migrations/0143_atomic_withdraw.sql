-- ============================================================================
-- Migration 0143: Atomic withdraw — pre-record intent before Stripe transfer
-- Date: 2026-04-29
--
-- Background: the existing requestWithdrawal flow calls
-- stripe.transfers.create() THEN wallet_withdraw RPC. If the RPC fails
-- after Stripe has accepted the transfer, money has left the platform
-- but the wallet balance is unchanged — the user could withdraw again
-- and double-claim. The current code path even acknowledges this by
-- returning "Withdrawal partially processed. Please contact support."
--
-- This is a money-loss bug. Fix is the standard pre-record-intent
-- pattern from payment systems:
--
--   begin    → debit balance, hold in pending_withdrawal_pence,
--              insert withdrawal_requests row with status='pending'
--   stripe   → transfers.create with idempotencyKey = request.id
--   finalise → on stripe success: move pending → wallet_transactions,
--              status='completed', stripe_transfer_id recorded
--   cancel   → on stripe failure: refund pending → balance,
--              status='failed', error recorded
--
-- The reconcile cron (extended in a follow-up commit) sweeps requests
-- stuck in 'pending' for >1h — covers the case where the request was
-- created but the application server died before either finalise or
-- cancel ran.
-- ============================================================================

-- 1. Add pending_withdrawal_pence to wallets. Held funds are subtracted
--    from balance_pence at the begin step, so the user can't withdraw the
--    same money twice; pending_withdrawal_pence is just an audit-friendly
--    breakdown of where the money went.
ALTER TABLE wallets
    ADD COLUMN IF NOT EXISTS pending_withdrawal_pence INTEGER NOT NULL DEFAULT 0
        CHECK (pending_withdrawal_pence >= 0);

-- 2. Withdrawal request audit table.
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    wallet_id             UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
    amount_pence          INTEGER NOT NULL CHECK (amount_pence > 0),
    status                TEXT NOT NULL CHECK (status IN ('pending','completed','failed','cancelled')),
    stripe_transfer_id    TEXT,
    error                 TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finalised_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id_created_at
    ON withdrawal_requests (user_id, created_at DESC);

-- Partial index for the reconcile sweep — only the rows that need attention.
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_pending
    ON withdrawal_requests (created_at)
    WHERE status = 'pending';

ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own withdrawal_requests"
    ON withdrawal_requests FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all withdrawal_requests"
    ON withdrawal_requests FOR SELECT
    USING (public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 3. wallet_withdraw_begin — atomic balance hold
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.wallet_withdraw_begin(
    p_user_id      UUID,
    p_amount_pence INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_wallet        wallets%ROWTYPE;
    v_request_id    UUID;
BEGIN
    IF p_amount_pence <= 0 THEN
        RETURN json_build_object('error', 'Amount must be positive');
    END IF;

    -- Authz: only the wallet owner (or service role bypass) can begin a
    -- withdraw. SECURITY DEFINER means we MUST self-check.
    IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
        RETURN json_build_object('error', 'Unauthorized');
    END IF;

    SELECT * INTO v_wallet
    FROM wallets WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Wallet not found');
    END IF;

    IF v_wallet.balance_pence < p_amount_pence THEN
        RETURN json_build_object('error', 'Insufficient funds');
    END IF;

    -- Hold the funds: move balance → pending. Single statement, transactional.
    UPDATE wallets
    SET balance_pence            = balance_pence            - p_amount_pence,
        pending_withdrawal_pence = pending_withdrawal_pence + p_amount_pence
    WHERE id = v_wallet.id;

    INSERT INTO withdrawal_requests (user_id, wallet_id, amount_pence, status)
    VALUES (p_user_id, v_wallet.id, p_amount_pence, 'pending')
    RETURNING id INTO v_request_id;

    RETURN json_build_object(
        'success',     TRUE,
        'request_id',  v_request_id,
        'new_balance', v_wallet.balance_pence - p_amount_pence
    );
END;
$$;

-- Match the rest of the wallet RPC family — authenticated callers only.
REVOKE EXECUTE ON FUNCTION public.wallet_withdraw_begin(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wallet_withdraw_begin(UUID, INTEGER) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. wallet_withdraw_finalise — Stripe transfer succeeded
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.wallet_withdraw_finalise(
    p_request_id        UUID,
    p_stripe_transfer_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_request   withdrawal_requests%ROWTYPE;
    v_wallet    wallets%ROWTYPE;
BEGIN
    SELECT * INTO v_request
    FROM withdrawal_requests WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Withdrawal request not found');
    END IF;

    IF v_request.status = 'completed' THEN
        -- Idempotent — finalising an already-completed request is a no-op.
        RETURN json_build_object('success', TRUE, 'already_completed', TRUE);
    END IF;

    IF v_request.status != 'pending' THEN
        RETURN json_build_object(
            'error',
            'Cannot finalise — request is in status ' || v_request.status
        );
    END IF;

    -- Authz: only the request's owner (or service role) can finalise.
    IF auth.uid() IS NOT NULL AND auth.uid() != v_request.user_id THEN
        RETURN json_build_object('error', 'Unauthorized');
    END IF;

    SELECT * INTO v_wallet
    FROM wallets WHERE id = v_request.wallet_id
    FOR UPDATE;

    -- Move pending → committed: drop the hold, no balance change (already
    -- decremented at begin), record the transaction, mark request done.
    UPDATE wallets
    SET pending_withdrawal_pence = pending_withdrawal_pence - v_request.amount_pence
    WHERE id = v_wallet.id;

    INSERT INTO wallet_transactions (
        wallet_id, type, amount_pence, direction, balance_after_pence,
        reference_type, reference_id, stripe_transfer_id, description
    ) VALUES (
        v_wallet.id, 'withdrawal', v_request.amount_pence, 'debit',
        v_wallet.balance_pence,
        'withdrawal_request', v_request.id::TEXT,
        p_stripe_transfer_id,
        'Withdrawal of £' || (v_request.amount_pence / 100.0)::TEXT || ' to bank'
    );

    UPDATE withdrawal_requests
    SET status              = 'completed',
        stripe_transfer_id  = p_stripe_transfer_id,
        finalised_at        = NOW()
    WHERE id = p_request_id;

    RETURN json_build_object('success', TRUE);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.wallet_withdraw_finalise(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wallet_withdraw_finalise(UUID, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. wallet_withdraw_cancel — Stripe transfer failed (or pre-Stripe abort)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.wallet_withdraw_cancel(
    p_request_id UUID,
    p_error      TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_request   withdrawal_requests%ROWTYPE;
BEGIN
    SELECT * INTO v_request
    FROM withdrawal_requests WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Withdrawal request not found');
    END IF;

    IF v_request.status IN ('failed', 'cancelled') THEN
        RETURN json_build_object('success', TRUE, 'already_cancelled', TRUE);
    END IF;

    IF v_request.status = 'completed' THEN
        RETURN json_build_object(
            'error',
            'Cannot cancel — request already completed (transfer ' || v_request.stripe_transfer_id || ')'
        );
    END IF;

    IF auth.uid() IS NOT NULL AND auth.uid() != v_request.user_id THEN
        RETURN json_build_object('error', 'Unauthorized');
    END IF;

    -- Refund the hold: move pending → balance.
    UPDATE wallets
    SET balance_pence            = balance_pence            + v_request.amount_pence,
        pending_withdrawal_pence = pending_withdrawal_pence - v_request.amount_pence
    WHERE id = v_request.wallet_id;

    UPDATE withdrawal_requests
    SET status        = 'failed',
        error         = p_error,
        finalised_at  = NOW()
    WHERE id = p_request_id;

    RETURN json_build_object('success', TRUE);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.wallet_withdraw_cancel(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wallet_withdraw_cancel(UUID, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. The legacy wallet_withdraw RPC stays in place (unused by new code) —
--    don't drop it in the same migration as the refactor in case rollback
--    is needed. Drop in a follow-up after Phase 2 confirms the new flow.
-- ----------------------------------------------------------------------------
