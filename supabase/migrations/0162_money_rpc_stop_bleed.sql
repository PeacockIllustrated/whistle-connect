-- ============================================================================
-- Migration 0162: Money RPC hardening — stop the bleeding (premortem WS-B)
-- Date: 2026-06-05
--
-- Live security advisor (lint 0029) confirms every money/booking SECURITY
-- DEFINER function is callable directly by any signed-in user via
-- /rest/v1/rpc/<name>, bypassing the server-action guards. This migration
-- closes the three genuinely exploitable holes and the double-charge bug. The
-- comprehensive 0029 sweep of the self-guarded RPCs is WS-C.
--
--   1. escrow_refund      — no internal auth.uid() check. A signed-in user
--                           could refund any booking's escrow to the coach.
--                           => revoke from authenticated; callers (cancelBooking,
--                           disputes) already / now use the service-role client.
--   2. claim_sos_booking  — no internal auth.uid() check; trusts p_referee_id.
--                           => revoke from authenticated; claimSOSBooking now
--                           runs it via the service-role client with the
--                           referee id pinned to the caller.
--   3. wallet_withdraw     — legacy 4-arg function, superseded by the atomic
--                           wallet_withdraw_begin/finalise/cancel (0143) and
--                           referenced nowhere in the app. => DROP.
--   4. confirm_booking     — overwrote bookings.escrow_amount_pence with no
--                           guard, so confirming a SECOND offer on the same
--                           booking double-charged the coach and created a
--                           duplicate assignment (the per-offer status check
--                           only blocks re-confirming the SAME offer).
--                           => add an already-resolved guard with FOR UPDATE.
--
-- service_role retains EXECUTE so the admin-client paths keep working. Every
-- CREATE OR REPLACE pins search_path and revokes anon/PUBLIC (0155 invariant).
-- ============================================================================

-- 1-3. Lock down the unguarded RPCs and drop the dead legacy withdraw.
REVOKE EXECUTE ON FUNCTION public.escrow_refund(uuid, integer) FROM authenticated, anon, public;
GRANT  EXECUTE ON FUNCTION public.escrow_refund(uuid, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_sos_booking(uuid, uuid, integer) FROM authenticated, anon, public;
GRANT  EXECUTE ON FUNCTION public.claim_sos_booking(uuid, uuid, integer) TO service_role;

DROP FUNCTION IF EXISTS public.wallet_withdraw(uuid, integer, text, text);

-- 4. confirm_booking with an already-resolved guard (double-charge fix).
CREATE OR REPLACE FUNCTION public.confirm_booking(
    p_offer_id UUID,
    p_platform_fee_pence INTEGER DEFAULT 0,
    p_price_pence INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_booking_id UUID;
    v_referee_id UUID;
    v_coach_id UUID;
    v_booking_status TEXT;
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

    -- 2. Verify booking and authorize caller before any mutations. FOR UPDATE
    -- locks the booking row so two concurrent confirmations of DIFFERENT offers
    -- on the same booking serialise here.
    SELECT coach_id, status INTO v_coach_id, v_booking_status
    FROM bookings
    WHERE id = v_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Booking not found');
    END IF;

    -- Already-resolved guard (double-charge fix): a booking can carry several
    -- offers. Once one offer is accepted the booking is 'confirmed' and escrow
    -- is held; confirming a second offer would charge the coach again and
    -- create a duplicate assignment. The per-offer status check above only
    -- blocks re-confirming the SAME offer.
    IF v_booking_status IN ('confirmed', 'completed', 'cancelled') THEN
        RETURN json_build_object(
            'error', 'This booking is no longer awaiting confirmation',
            'code', 'ALREADY_RESOLVED'
        );
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

-- Preserve the 0155 invariant for the recreated SECDEF function: pin grants.
REVOKE EXECUTE ON FUNCTION public.confirm_booking(uuid, integer, integer) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.confirm_booking(uuid, integer, integer) TO authenticated, service_role;
