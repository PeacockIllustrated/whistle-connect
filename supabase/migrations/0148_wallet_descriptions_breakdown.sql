-- ============================================================================
-- Migration 0148: Wallet ledger descriptions — split match / travel / fee
--
-- Update confirm_booking and escrow_release to write breakdown descriptions
-- on wallet_transactions, so coaches and referees can see exactly where each
-- pence went. Pure description-string change — no money math, no schema, no
-- signature changes.
-- ============================================================================

-- 1. confirm_booking: split escrow_hold description into match + travel + fee
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
    v_match_fee_pence INTEGER;
    v_travel_cost_pence INTEGER;
    v_total_pence INTEGER;
    v_wallet wallets%ROWTYPE;
    v_new_balance INTEGER;
    v_new_escrow INTEGER;
    v_description TEXT;
BEGIN
    -- 1. Get and validate the offer
    SELECT booking_id, referee_id, status, price_pence, match_fee_pence, travel_cost_pence
    INTO v_booking_id, v_referee_id, v_offer_status, v_price_pence, v_match_fee_pence, v_travel_cost_pence
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

    -- Build human-readable breakdown.
    -- Falls back to the legacy 2-part / 0-part text for old offers without
    -- match_fee_pence / travel_cost_pence (added in migration 0134).
    IF v_match_fee_pence IS NOT NULL
       AND v_travel_cost_pence IS NOT NULL
       AND v_travel_cost_pence > 0
       AND p_platform_fee_pence > 0 THEN
        v_description := format(
            'Funds held in escrow (£%s match + £%s travel + £%s booking fee)',
            round(v_match_fee_pence::NUMERIC / 100, 2),
            round(v_travel_cost_pence::NUMERIC / 100, 2),
            round(p_platform_fee_pence::NUMERIC / 100, 2)
        );
    ELSIF v_match_fee_pence IS NOT NULL
          AND v_travel_cost_pence IS NOT NULL
          AND v_travel_cost_pence > 0 THEN
        v_description := format(
            'Funds held in escrow (£%s match + £%s travel)',
            round(v_match_fee_pence::NUMERIC / 100, 2),
            round(v_travel_cost_pence::NUMERIC / 100, 2)
        );
    ELSIF p_platform_fee_pence > 0 THEN
        v_description := format(
            'Funds held in escrow (£%s match + £%s booking fee)',
            round(v_price_pence::NUMERIC / 100, 2),
            round(p_platform_fee_pence::NUMERIC / 100, 2)
        );
    ELSE
        v_description := 'Funds held in escrow for booking confirmation';
    END IF;

    INSERT INTO wallet_transactions (
        wallet_id, type, amount_pence, direction, balance_after_pence,
        reference_type, reference_id, description
    ) VALUES (
        v_wallet.id, 'escrow_hold', v_total_pence, 'debit', v_new_balance,
        'booking', v_booking_id::TEXT,
        v_description
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


-- 2. escrow_release: split referee credit description into match + travel
CREATE OR REPLACE FUNCTION escrow_release(
    p_booking_id UUID,
    p_platform_fee_pence INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking RECORD;
    v_coach_wallet wallets%ROWTYPE;
    v_referee_wallet wallets%ROWTYPE;
    v_referee_amount INTEGER;
    v_new_coach_escrow INTEGER;
    v_new_referee_balance INTEGER;
    v_match_fee_pence INTEGER;
    v_travel_cost_pence INTEGER;
    v_ref_description TEXT;
BEGIN
    SELECT b.id, b.coach_id, b.escrow_amount_pence, b.escrow_released_at,
           ba.referee_id
    INTO v_booking
    FROM bookings b
    JOIN booking_assignments ba ON ba.booking_id = b.id
    WHERE b.id = p_booking_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Booking or assignment not found');
    END IF;

    IF v_booking.escrow_released_at IS NOT NULL THEN
        RETURN json_build_object('error', 'Escrow already released for this booking');
    END IF;

    IF v_booking.escrow_amount_pence IS NULL OR v_booking.escrow_amount_pence <= 0 THEN
        RETURN json_build_object('error', 'No escrow amount on this booking');
    END IF;

    v_referee_amount := v_booking.escrow_amount_pence - p_platform_fee_pence;
    IF v_referee_amount <= 0 THEN
        RETURN json_build_object('error', 'Platform fee exceeds escrow amount');
    END IF;

    -- Lookup the accepted offer for breakdown text (NULLs for legacy offers).
    SELECT match_fee_pence, travel_cost_pence
    INTO v_match_fee_pence, v_travel_cost_pence
    FROM booking_offers
    WHERE booking_id = p_booking_id AND status = 'accepted'
    LIMIT 1;

    SELECT * INTO v_coach_wallet
    FROM wallets WHERE user_id = v_booking.coach_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Coach wallet not found');
    END IF;

    v_new_coach_escrow := v_coach_wallet.escrow_pence - v_booking.escrow_amount_pence;

    UPDATE wallets
    SET escrow_pence = v_new_coach_escrow
    WHERE id = v_coach_wallet.id;

    INSERT INTO wallet_transactions (
        wallet_id, type, amount_pence, direction, balance_after_pence,
        reference_type, reference_id, description
    ) VALUES (
        v_coach_wallet.id, 'escrow_release', v_booking.escrow_amount_pence, 'debit',
        v_coach_wallet.balance_pence,
        'booking', p_booking_id::TEXT,
        'Escrow released to referee'
    );

    SELECT * INTO v_referee_wallet
    FROM wallets WHERE user_id = v_booking.referee_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO wallets (user_id, balance_pence, escrow_pence)
        VALUES (v_booking.referee_id, 0, 0)
        RETURNING * INTO v_referee_wallet;
    END IF;

    v_new_referee_balance := v_referee_wallet.balance_pence + v_referee_amount;

    UPDATE wallets
    SET balance_pence = v_new_referee_balance
    WHERE id = v_referee_wallet.id;

    -- Build referee description: prefer breakdown when offer recorded the split.
    IF v_match_fee_pence IS NOT NULL
       AND v_travel_cost_pence IS NOT NULL
       AND v_travel_cost_pence > 0 THEN
        v_ref_description := format(
            'Payment received (£%s match + £%s travel)',
            round(v_match_fee_pence::NUMERIC / 100, 2),
            round(v_travel_cost_pence::NUMERIC / 100, 2)
        );
    ELSIF v_match_fee_pence IS NOT NULL THEN
        v_ref_description := format(
            'Payment received (£%s match)',
            round(v_match_fee_pence::NUMERIC / 100, 2)
        );
    ELSE
        v_ref_description := 'Payment received for match';
    END IF;

    INSERT INTO wallet_transactions (
        wallet_id, type, amount_pence, direction, balance_after_pence,
        reference_type, reference_id, description
    ) VALUES (
        v_referee_wallet.id, 'escrow_release', v_referee_amount, 'credit',
        v_new_referee_balance,
        'booking', p_booking_id::TEXT,
        v_ref_description
    );

    IF p_platform_fee_pence > 0 THEN
        INSERT INTO wallet_transactions (
            wallet_id, type, amount_pence, direction, balance_after_pence,
            reference_type, reference_id, description
        ) VALUES (
            v_coach_wallet.id, 'platform_fee', p_platform_fee_pence, 'debit',
            v_coach_wallet.balance_pence,
            'booking', p_booking_id::TEXT,
            'Platform fee'
        );
    END IF;

    UPDATE bookings
    SET escrow_released_at = NOW(),
        status = 'completed'
    WHERE id = p_booking_id;

    RETURN json_build_object(
        'success', true,
        'referee_amount_pence', v_referee_amount,
        'platform_fee_pence', p_platform_fee_pence,
        'booking_id', p_booking_id
    );
END;
$$;
