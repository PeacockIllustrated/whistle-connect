-- ============================================================================
-- Migration 0119: SOS Bookings
--
-- Adds SOS-specific columns and an atomic "first to accept" claim RPC
-- using row-level locking to prevent race conditions.
-- ============================================================================

-- 1. Add SOS columns to bookings (is_sos may already exist from 0115)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS is_sos BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS sos_expires_at TIMESTAMPTZ;

-- Index for fast SOS filtering
CREATE INDEX IF NOT EXISTS idx_bookings_sos
  ON bookings(is_sos) WHERE is_sos = true;

-- 2. Atomic SOS claim RPC
-- Uses SELECT FOR UPDATE to lock the booking row, ensuring only the first
-- referee to call this function can claim it.
CREATE OR REPLACE FUNCTION claim_sos_booking(
  p_booking_id UUID,
  p_referee_id UUID,
  p_price_pence INTEGER DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_booking RECORD;
  v_offer_id UUID;
  v_assignment_id UUID;
BEGIN
  -- Lock the booking row
  SELECT id, status, is_sos, coach_id
  INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  -- Validate
  IF v_booking IS NULL THEN
    RETURN json_build_object('error', 'Booking not found');
  END IF;

  IF NOT v_booking.is_sos THEN
    RETURN json_build_object('error', 'This is not an SOS booking');
  END IF;

  IF v_booking.status NOT IN ('pending', 'offered') THEN
    RETURN json_build_object('error', 'This booking has already been claimed');
  END IF;

  -- Create or update the offer
  INSERT INTO booking_offers (booking_id, referee_id, status, price_pence)
  VALUES (p_booking_id, p_referee_id, 'accepted', p_price_pence)
  ON CONFLICT (booking_id, referee_id)
    DO UPDATE SET status = 'accepted', price_pence = p_price_pence, responded_at = now()
  RETURNING id INTO v_offer_id;

  -- Withdraw all other offers
  UPDATE booking_offers
  SET status = 'withdrawn'
  WHERE booking_id = p_booking_id
    AND referee_id != p_referee_id
    AND status IN ('sent', 'accepted_priced');

  -- Create the assignment
  INSERT INTO booking_assignments (booking_id, referee_id)
  VALUES (p_booking_id, p_referee_id)
  RETURNING id INTO v_assignment_id;

  -- Update booking status to confirmed
  UPDATE bookings
  SET status = 'confirmed'
  WHERE id = p_booking_id;

  RETURN json_build_object(
    'success', true,
    'offer_id', v_offer_id,
    'assignment_id', v_assignment_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
