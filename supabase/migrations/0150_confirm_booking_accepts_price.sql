-- ============================================================================
-- Migration 0150: confirm_booking accepts optional p_price_pence
--
-- Background: when a referee taps "I'm Available" on the nearby feed,
-- expressInterest (src/app/app/feed/actions.ts) inserts a booking_offers row
-- with status='sent' and price_pence=NULL. The coach then sees an Accept card
-- with a price input, types the fee, and clicks Accept (coachConfirmInterest).
--
-- The previous flow did a JS-side UPDATE to set price_pence before calling
-- confirm_booking. But the only UPDATE policy on booking_offers is
-- "Referees can update own offers" — there is no policy letting the coach
-- update the offer. Postgres RLS silently drops UPDATEs with no matching
-- policy (no error returned), so price_pence stayed NULL and confirm_booking
-- bailed with "Offer has no valid price".
--
-- Fix: thread p_price_pence into confirm_booking. When supplied AND the
-- caller is the booking's coach, the RPC sets the offer's price under
-- SECURITY DEFINER (bypassing RLS) before validation. Existing callers
-- (referee accepting a coach-priced offer) pass NULL and behave as before.
-- ============================================================================

DROP FUNCTION IF EXISTS confirm_booking(UUID, INTEGER);
DROP FUNCTION IF EXISTS confirm_booking(UUID);

CREATE OR REPLACE FUNCTION confirm_booking(
    p_offer_id UUID,
    p_platform_fee_pence INTEGER DEFAULT 0,
    p_price_pence INTEGER DEFAULT NULL
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
    -- 1. Load offer
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

    -- 2. Verify booking and authorize caller before any mutations
    SELECT coach_id INTO v_coach_id
    FROM bookings
    WHERE id = v_booking_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Booking not found');
    END IF;

    IF auth.uid() != v_referee_id AND auth.uid() != v_coach_id THEN
        RETURN json_build_object('error', 'Unauthorized');
    END IF;

    -- 3. Coach-supplied price path: set price on the offer here so we don't
    -- depend on a JS-side UPDATE that RLS would silently drop. Only the
    -- booking's coach may set the price via this parameter.
    IF p_price_pence IS NOT NULL AND auth.uid() = v_coach_id THEN
        IF p_price_pence <= 0 OR p_price_pence > 50000 THEN
            RETURN json_build_object('error', 'Price must be between 1p and £500');
        END IF;
        UPDATE booking_offers
        SET price_pence = p_price_pence
        WHERE id = p_offer_id;
        v_price_pence := p_price_pence;
    END IF;

    IF v_price_pence IS NULL OR v_price_pence <= 0 THEN
        RETURN json_build_object('error', 'Offer has no valid price');
    END IF;

    IF p_platform_fee_pence IS NULL OR p_platform_fee_pence < 0 THEN
        p_platform_fee_pence := 0;
    END IF;

    v_total_pence := v_price_pence + p_platform_fee_pence;

    -- 4. Lock coach wallet and check balance against (price + fee)
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

    -- 5. Move (price + fee) into escrow
    v_new_balance := v_wallet.balance_pence - v_total_pence;
    v_new_escrow := v_wallet.escrow_pence + v_total_pence;

    UPDATE wallets
    SET balance_pence = v_new_balance,
        escrow_pence = v_new_escrow
    WHERE id = v_wallet.id;

    -- Build human-readable breakdown.
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

    -- 6. Accept offer → create assignment → confirm booking
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
