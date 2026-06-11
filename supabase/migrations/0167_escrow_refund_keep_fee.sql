-- ============================================================================
-- Migration 0167: escrow_refund_keep_fee — coach-cancel refund retaining the fee
--
-- Policy: when a COACH cancels a confirmed booking, the platform keeps the
-- booking fee and refunds the rest (match + travel) to the coach. When the
-- REFEREE pulls out, the coach is refunded in full (incl. the fee) — that path
-- keeps using escrow_refund. cancelBooking routes to the right one.
--
-- This mirrors escrow_release's fee realisation exactly: the coach's FULL hold
-- is cleared from escrow_pence, the refundable portion (escrow − fee) is
-- credited back to balance, and the retained fee is written as a platform_fee
-- debit (platform revenue) — so the fee leaves the wallet rather than being
-- stranded in escrow. escrow_amount_pence is nulled (escrow resolved), which
-- also satisfies the reconcile invariants.
--
-- SECURITY DEFINER, search_path pinned, service-role only (a signed-in user must
-- not trigger refunds over /rest/v1/rpc — same posture as escrow_refund, 0162).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.escrow_refund_keep_fee(
    p_booking_id UUID,
    p_fee_pence INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_booking RECORD;
    v_wallet wallets%ROWTYPE;
    v_fee INTEGER;
    v_refund INTEGER;
    v_new_balance INTEGER;
    v_new_escrow INTEGER;
BEGIN
    SELECT id, coach_id, escrow_amount_pence, escrow_released_at
    INTO v_booking
    FROM bookings
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Booking not found');
    END IF;

    IF v_booking.escrow_released_at IS NOT NULL THEN
        RETURN json_build_object('error', 'Escrow already released — cannot refund');
    END IF;

    IF v_booking.escrow_amount_pence IS NULL OR v_booking.escrow_amount_pence <= 0 THEN
        RETURN json_build_object('error', 'No escrow to refund');
    END IF;

    -- Clamp the retained fee to [0, escrow_amount].
    v_fee := COALESCE(p_fee_pence, 0);
    IF v_fee < 0 THEN v_fee := 0; END IF;
    IF v_fee > v_booking.escrow_amount_pence THEN v_fee := v_booking.escrow_amount_pence; END IF;

    v_refund := v_booking.escrow_amount_pence - v_fee;

    SELECT * INTO v_wallet
    FROM wallets WHERE user_id = v_booking.coach_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Coach wallet not found');
    END IF;

    -- Clear the FULL hold from escrow; refund the non-fee portion to balance.
    v_new_balance := v_wallet.balance_pence + v_refund;
    v_new_escrow := v_wallet.escrow_pence - v_booking.escrow_amount_pence;

    UPDATE wallets
    SET balance_pence = v_new_balance,
        escrow_pence = v_new_escrow
    WHERE id = v_wallet.id;

    IF v_refund > 0 THEN
        INSERT INTO wallet_transactions (
            wallet_id, type, amount_pence, direction, balance_after_pence,
            reference_type, reference_id, description
        ) VALUES (
            v_wallet.id, 'escrow_refund', v_refund, 'credit', v_new_balance,
            'booking', p_booking_id::TEXT,
            'Escrow refunded — booking cancelled (booking fee retained)'
        );
    END IF;

    IF v_fee > 0 THEN
        INSERT INTO wallet_transactions (
            wallet_id, type, amount_pence, direction, balance_after_pence,
            reference_type, reference_id, description
        ) VALUES (
            v_wallet.id, 'platform_fee', v_fee, 'debit', v_new_balance,
            'booking', p_booking_id::TEXT,
            'Booking fee retained on coach cancellation'
        );
    END IF;

    -- Escrow fully resolved for this booking.
    UPDATE bookings
    SET escrow_amount_pence = NULL
    WHERE id = p_booking_id;

    RETURN json_build_object(
        'success', true,
        'refunded_pence', v_refund,
        'fee_retained_pence', v_fee,
        'booking_id', p_booking_id
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.escrow_refund_keep_fee(UUID, INTEGER) FROM anon, authenticated, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.escrow_refund_keep_fee(UUID, INTEGER) TO service_role;
