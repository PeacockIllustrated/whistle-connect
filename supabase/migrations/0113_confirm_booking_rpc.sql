-- ============================================================================
-- Migration 0113: Atomic confirm_booking RPC function
--
-- Wraps the critical 3-step sequence (accept offer → create assignment →
-- update booking status) in a single PostgreSQL transaction so partial
-- failures can't leave data in an inconsistent state.
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
BEGIN
    -- 1. Get and validate the offer
    SELECT booking_id, referee_id, status
    INTO v_booking_id, v_referee_id, v_offer_status
    FROM booking_offers
    WHERE id = p_offer_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Offer not found');
    END IF;

    IF v_offer_status != 'accepted_priced' THEN
        RETURN json_build_object('error', 'Offer is not in accepted_priced status');
    END IF;

    -- 2. Verify the booking exists and get coach_id
    SELECT coach_id INTO v_coach_id
    FROM bookings
    WHERE id = v_booking_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Booking not found');
    END IF;

    -- Verify the calling user is the coach (auth.uid() is set by Supabase)
    IF v_coach_id != auth.uid() THEN
        RETURN json_build_object('error', 'Unauthorized');
    END IF;

    -- 3. Atomic transaction: all three steps succeed or all fail
    -- Step 1: Accept the offer
    UPDATE booking_offers
    SET status = 'accepted'
    WHERE id = p_offer_id;

    -- Step 2: Create the assignment
    INSERT INTO booking_assignments (booking_id, referee_id)
    VALUES (v_booking_id, v_referee_id);

    -- Step 3: Confirm the booking
    UPDATE bookings
    SET status = 'confirmed'
    WHERE id = v_booking_id;

    RETURN json_build_object(
        'success', true,
        'booking_id', v_booking_id,
        'referee_id', v_referee_id
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION confirm_booking(UUID) TO authenticated;
