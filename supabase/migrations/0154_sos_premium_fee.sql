-- ============================================================================
-- Migration 0154: SOS premium fee — atomic charge RPC
--
-- SOS broadcasts page every nearby available referee with an urgent push
-- notification. To keep that channel meaningful (and prevent spam / accidental
-- creation), we charge a small premium fee per broadcast: £1.99 by default,
-- referenced from the SOS_FEE_PENCE constant in src/lib/constants.ts.
--
-- The fee is debited from the coach's wallet at SOS creation time and is
-- non-refundable, even if no referee accepts. This RPC is the atomic point:
--
--   - locks the wallet row FOR UPDATE so concurrent SOS clicks can't double-spend
--   - validates balance >= amount before debiting
--   - debits and writes a wallet_transactions audit row in the same transaction
--
-- Caller (createSOSBooking) is expected to:
--   1. Insert the booking row first (so we can stamp reference_id on the audit row)
--   2. Call charge_sos_fee(coach_id, amount, booking_id)
--   3. On RPC error: delete the booking and surface an insufficient-balance
--      message to the user. The pre-flight balance check on the JS side makes
--      this rollback path effectively unreachable — it's belt-and-braces.
--
-- ============================================================================

CREATE OR REPLACE FUNCTION public.charge_sos_fee(
    p_user_id      UUID,
    p_amount_pence INTEGER,
    p_booking_id   UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_wallet wallets%ROWTYPE;
BEGIN
    IF p_amount_pence <= 0 THEN
        RETURN json_build_object('error', 'Amount must be positive');
    END IF;

    -- Authz: the wallet owner (or service role bypass) is the only valid caller
    IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
        RETURN json_build_object('error', 'Unauthorized');
    END IF;

    SELECT * INTO v_wallet
    FROM wallets WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'error', 'No wallet — top up to enable SOS',
            'code',  'NO_WALLET'
        );
    END IF;

    IF v_wallet.balance_pence < p_amount_pence THEN
        RETURN json_build_object(
            'error',                'Insufficient wallet balance to broadcast SOS',
            'code',                 'INSUFFICIENT_FUNDS',
            'required_pence',       p_amount_pence,
            'current_balance_pence', v_wallet.balance_pence
        );
    END IF;

    -- Debit the wallet and stamp the audit row atomically.
    UPDATE wallets
    SET balance_pence = balance_pence - p_amount_pence,
        updated_at    = NOW()
    WHERE id = v_wallet.id;

    INSERT INTO wallet_transactions (
        wallet_id,
        type,
        amount_pence,
        direction,
        balance_after_pence,
        reference_type,
        reference_id,
        description
    ) VALUES (
        v_wallet.id,
        'platform_fee',
        p_amount_pence,
        'debit',
        v_wallet.balance_pence - p_amount_pence,
        'sos_booking',
        p_booking_id::TEXT,
        'SOS broadcast premium fee'
    );

    RETURN json_build_object(
        'success',           TRUE,
        'new_balance_pence', v_wallet.balance_pence - p_amount_pence
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.charge_sos_fee(UUID, INTEGER, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.charge_sos_fee(UUID, INTEGER, UUID) TO authenticated;
