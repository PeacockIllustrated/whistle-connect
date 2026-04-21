-- ============================================================================
-- Migration 0136: Fully atomic confirm_booking
--
-- Problem: After 0111 tightened RLS on threads, thread_participants and
-- booking_offers, the post-RPC steps inside acceptOffer() silently failed
-- because the referee couldn't:
--   * update competing referees' offers (RLS: referee_id = auth.uid())
--   * insert a thread (RLS requires coach-of-booking)
--   * insert thread participants (RLS requires coach or existing participant)
--   * insert a system message (RLS requires thread participant)
--
-- Symptom for users: booking "accepts" but no chat thread appears, competing
-- offers stay visible to other referees, and the experience feels broken.
-- Also surfaces the raw Postgres "row-level security" error if any call path
-- doesn't swallow the error silently.
--
-- Fix: Fold all post-acceptance writes into the SECURITY DEFINER RPC so the
-- whole thing commits atomically with elevated privileges. No more RLS gaps.
-- ============================================================================

CREATE OR REPLACE FUNCTION confirm_booking(p_offer_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking_id         UUID;
    v_referee_id         UUID;
    v_coach_id           UUID;
    v_offer_status       TEXT;
    v_price_pence        INTEGER;
    v_wallet             wallets%ROWTYPE;
    v_new_balance        INTEGER;
    v_new_escrow         INTEGER;
    v_thread_id          UUID;
    v_thread_title       TEXT;
    v_ground_name        TEXT;
    v_location_postcode  TEXT;
    v_match_date         DATE;
BEGIN
    -- 1. Load and validate the offer
    SELECT booking_id, referee_id, status, price_pence
    INTO   v_booking_id, v_referee_id, v_offer_status, v_price_pence
    FROM   booking_offers
    WHERE  id = p_offer_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Offer not found');
    END IF;

    -- Accept from 'sent' (coach already priced it) or legacy 'accepted_priced'
    IF v_offer_status NOT IN ('sent', 'accepted_priced') THEN
        RETURN json_build_object('error', 'Offer is not in a confirmable status');
    END IF;

    IF v_price_pence IS NULL OR v_price_pence <= 0 THEN
        RETURN json_build_object('error', 'Offer has no valid price');
    END IF;

    -- 2. Load booking details
    SELECT coach_id, ground_name, location_postcode, match_date
    INTO   v_coach_id, v_ground_name, v_location_postcode, v_match_date
    FROM   bookings
    WHERE  id = v_booking_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Booking not found');
    END IF;

    -- Only the referee (new flow) or the coach (legacy) can confirm
    IF auth.uid() != v_referee_id AND auth.uid() != v_coach_id THEN
        RETURN json_build_object('error', 'Unauthorized');
    END IF;

    -- 3. Escrow: lock the coach's wallet and check balance
    SELECT * INTO v_wallet
    FROM   wallets
    WHERE  user_id = v_coach_id
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

    -- 4. Escrow: move the funds
    v_new_balance := v_wallet.balance_pence - v_price_pence;
    v_new_escrow  := v_wallet.escrow_pence + v_price_pence;

    UPDATE wallets
    SET    balance_pence = v_new_balance,
           escrow_pence  = v_new_escrow
    WHERE  id = v_wallet.id;

    INSERT INTO wallet_transactions (
        wallet_id, type, amount_pence, direction, balance_after_pence,
        reference_type, reference_id, description
    ) VALUES (
        v_wallet.id, 'escrow_hold', v_price_pence, 'debit', v_new_balance,
        'booking', v_booking_id::TEXT,
        'Funds held in escrow for booking confirmation'
    );

    -- 5. Accept this offer
    UPDATE booking_offers
    SET    status = 'accepted',
           responded_at = NOW()
    WHERE  id = p_offer_id;

    -- 6. Withdraw all competing live offers on this booking
    --    (previously this silently failed under RLS because the referee
    --     couldn't update other referees' offers — now bypassed by DEFINER)
    UPDATE booking_offers
    SET    status = 'withdrawn'
    WHERE  booking_id = v_booking_id
      AND  id != p_offer_id
      AND  status IN ('sent', 'accepted_priced');

    -- 7. Create the assignment (one per booking)
    INSERT INTO booking_assignments (booking_id, referee_id)
    VALUES (v_booking_id, v_referee_id)
    ON CONFLICT (booking_id) DO NOTHING;

    -- 8. Flip the booking to confirmed
    UPDATE bookings
    SET    status = 'confirmed',
           escrow_amount_pence = v_price_pence
    WHERE  id = v_booking_id;

    -- 9. Ensure a thread exists for this booking
    SELECT id INTO v_thread_id
    FROM   threads
    WHERE  booking_id = v_booking_id;

    IF v_thread_id IS NULL THEN
        v_thread_title := 'Booking: ' || COALESCE(v_ground_name, v_location_postcode, 'match');
        INSERT INTO threads (booking_id, title)
        VALUES (v_booking_id, v_thread_title)
        RETURNING id INTO v_thread_id;
    END IF;

    -- 10. Ensure both parties are thread participants
    INSERT INTO thread_participants (thread_id, profile_id)
    VALUES (v_thread_id, v_coach_id)
    ON CONFLICT (thread_id, profile_id) DO NOTHING;

    INSERT INTO thread_participants (thread_id, profile_id)
    VALUES (v_thread_id, v_referee_id)
    ON CONFLICT (thread_id, profile_id) DO NOTHING;

    -- 11. Post the "Booking confirmed" system message
    INSERT INTO messages (thread_id, sender_id, kind, body)
    VALUES (
        v_thread_id,
        NULL,
        'system',
        'Booking confirmed. Use chat to finalise details.'
    );

    RETURN json_build_object(
        'success',              true,
        'booking_id',           v_booking_id,
        'referee_id',           v_referee_id,
        'thread_id',            v_thread_id,
        'escrow_amount_pence',  v_price_pence,
        'wallet_balance_pence', v_new_balance
    );
END;
$$;
