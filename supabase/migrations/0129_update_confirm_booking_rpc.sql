-- ============================================================================
-- Migration 0129: Update confirm_booking to include escrow hold
--
-- Replaces the existing confirm_booking RPC to add wallet balance check
-- and escrow hold as part of the atomic booking confirmation.
-- ============================================================================

CREATE OR REPLACE FUNCTION confirm_booking(p_offer_id UUID)
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

    IF v_offer_status != 'accepted_priced' THEN
        RETURN json_build_object('error', 'Offer is not in accepted_priced status');
    END IF;

    IF v_price_pence IS NULL OR v_price_pence <= 0 THEN
        RETURN json_build_object('error', 'Offer has no valid price');
    END IF;

    -- 2. Verify the booking exists and get coach_id
    SELECT coach_id INTO v_coach_id
    FROM bookings
    WHERE id = v_booking_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Booking not found');
    END IF;

    -- Verify the calling user is the coach
    IF v_coach_id != auth.uid() THEN
        RETURN json_build_object('error', 'Unauthorized');
    END IF;

    -- 3. ESCROW: Lock wallet and check balance
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

    IF v_wallet.balance_pence < v_price_pence THEN
        RETURN json_build_object(
            'error', 'Insufficient funds',
            'code', 'INSUFFICIENT_FUNDS',
            'balance_pence', v_wallet.balance_pence,
            'required_pence', v_price_pence,
            'shortfall_pence', v_price_pence - v_wallet.balance_pence
        );
    END IF;

    -- 4. ESCROW: Move funds from balance to escrow
    v_new_balance := v_wallet.balance_pence - v_price_pence;
    v_new_escrow := v_wallet.escrow_pence + v_price_pence;

    UPDATE wallets
    SET balance_pence = v_new_balance,
        escrow_pence = v_new_escrow
    WHERE id = v_wallet.id;

    -- Record escrow transaction
    INSERT INTO wallet_transactions (
        wallet_id, type, amount_pence, direction, balance_after_pence,
        reference_type, reference_id, description
    ) VALUES (
        v_wallet.id, 'escrow_hold', v_price_pence, 'debit', v_new_balance,
        'booking', v_booking_id::TEXT,
        'Funds held in escrow for booking confirmation'
    );

    -- 5. Original atomic transaction: accept offer → create assignment → confirm booking
    UPDATE booking_offers
    SET status = 'accepted'
    WHERE id = p_offer_id;

    INSERT INTO booking_assignments (booking_id, referee_id)
    VALUES (v_booking_id, v_referee_id);

    UPDATE bookings
    SET status = 'confirmed',
        escrow_amount_pence = v_price_pence
    WHERE id = v_booking_id;

    RETURN json_build_object(
        'success', true,
        'booking_id', v_booking_id,
        'referee_id', v_referee_id,
        'escrow_amount_pence', v_price_pence,
        'wallet_balance_pence', v_new_balance
    );
END;
$$;
