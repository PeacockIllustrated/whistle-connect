-- ============================================================================
-- Migration 0137: Platform booking fee (£0.99 per booking)
--
-- 1. Seed platform_settings with booking_fee_pence (default 99)
-- 2. Update confirm_booking RPC to accept p_platform_fee_pence and hold
--    (price_pence + platform_fee) in escrow. The booking_offers.price_pence
--    column continues to represent the referee's gross payout — only the
--    coach's escrowed amount and bookings.escrow_amount_pence are inflated.
-- 3. On escrow_release the same platform fee is passed through, so the ref
--    receives price_pence and the platform records the fee.
-- ============================================================================

-- 1. Seed booking_fee_pence (default £0.99)
INSERT INTO platform_settings (key, value, description)
VALUES (
    'booking_fee_pence',
    '99',
    'Platform booking fee added to each confirmed booking (in pence). Default: 99 (£0.99). Coach pays this on top of match fee + travel; referee does not see it deducted.'
)
ON CONFLICT (key) DO NOTHING;

-- 2. Update confirm_booking to add the platform fee on top of price_pence
CREATE OR REPLACE FUNCTION confirm_booking(
    p_offer_id UUID,
    p_platform_fee_pence INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking_id UUID;
    v_referee_id UUID;
    v_coach_id UUID;
    v_offer_status TEXT;
    v_price_pence INTEGER;
    v_total_pence INTEGER;
    v_wallet wallets%ROWTYPE;
    v_new_balance INTEGER;
    v_new_escrow INTEGER;
BEGIN
    -- 1. Get and validate the offer
    SELECT booking_id, referee_id, status, price_pence
    INTO v_booking_id, v_referee_id, v_offer_status, v_price_pence
    FROM booking_offers
    WHERE id = p_offer_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Offer not found');
    END IF;

    IF v_offer_status NOT IN ('sent', 'accepted_priced') THEN
        RETURN json_build_object('error', 'Offer is not in a confirmable status');
    END IF;

    IF v_price_pence IS NULL OR v_price_pence <= 0 THEN
        RETURN json_build_object('error', 'Offer has no valid price');
    END IF;

    IF p_platform_fee_pence IS NULL OR p_platform_fee_pence < 0 THEN
        p_platform_fee_pence := 0;
    END IF;

    v_total_pence := v_price_pence + p_platform_fee_pence;

    -- 2. Verify booking and authorize caller
    SELECT coach_id INTO v_coach_id
    FROM bookings
    WHERE id = v_booking_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Booking not found');
    END IF;

    IF auth.uid() != v_referee_id AND auth.uid() != v_coach_id THEN
        RETURN json_build_object('error', 'Unauthorized');
    END IF;

    -- 3. Lock coach wallet and check balance against (price + fee)
    SELECT * INTO v_wallet
    FROM wallets
    WHERE user_id = v_coach_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'error', 'No wallet found. Please top up your wallet before confirming.',
            'code', 'NO_WALLET'
        );
    END IF;

    IF v_wallet.balance_pence < v_total_pence THEN
        RETURN json_build_object(
            'error', 'Insufficient funds',
            'code', 'INSUFFICIENT_FUNDS',
            'balance_pence', v_wallet.balance_pence,
            'required_pence', v_total_pence,
            'shortfall_pence', v_total_pence - v_wallet.balance_pence
        );
    END IF;

    -- 4. Move (price + fee) into escrow
    v_new_balance := v_wallet.balance_pence - v_total_pence;
    v_new_escrow := v_wallet.escrow_pence + v_total_pence;

    UPDATE wallets
    SET balance_pence = v_new_balance,
        escrow_pence = v_new_escrow
    WHERE id = v_wallet.id;

    INSERT INTO wallet_transactions (
        wallet_id, type, amount_pence, direction, balance_after_pence,
        reference_type, reference_id, description
    ) VALUES (
        v_wallet.id, 'escrow_hold', v_total_pence, 'debit', v_new_balance,
        'booking', v_booking_id::TEXT,
        CASE
            WHEN p_platform_fee_pence > 0
            THEN format('Funds held in escrow (£%s match + £%s booking fee)',
                        round(v_price_pence::NUMERIC / 100, 2),
                        round(p_platform_fee_pence::NUMERIC / 100, 2))
            ELSE 'Funds held in escrow for booking confirmation'
        END
    );

    -- 5. Accept offer → create assignment → confirm booking
    UPDATE booking_offers
    SET status = 'accepted'
    WHERE id = p_offer_id;

    INSERT INTO booking_assignments (booking_id, referee_id)
    VALUES (v_booking_id, v_referee_id);

    UPDATE bookings
    SET status = 'confirmed',
        escrow_amount_pence = v_total_pence
    WHERE id = v_booking_id;

    RETURN json_build_object(
        'success', true,
        'booking_id', v_booking_id,
        'referee_id', v_referee_id,
        'price_pence', v_price_pence,
        'platform_fee_pence', p_platform_fee_pence,
        'escrow_amount_pence', v_total_pence,
        'wallet_balance_pence', v_new_balance
    );
END;
$$;

-- Re-grant execute (signature changed → must be re-applied)
GRANT EXECUTE ON FUNCTION confirm_booking(UUID, INTEGER) TO authenticated;
