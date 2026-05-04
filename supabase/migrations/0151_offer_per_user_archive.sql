-- ============================================================================
-- Migration 0151: per-user archive on booking_offers
--
-- Mirrors the per-user archive shipped on bookings (coach_archived_at) and
-- booking_assignments (archived_at). Lets either side hide a stale offer
-- from their list view without affecting the other side or the underlying
-- offer state. RPCs run SECURITY DEFINER because booking_offers RLS only
-- lets the referee UPDATE; the coach archive path needs a way through.
-- ============================================================================

ALTER TABLE booking_offers
    ADD COLUMN IF NOT EXISTS referee_archived_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS coach_archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_booking_offers_referee_archived
    ON booking_offers (referee_id, referee_archived_at);

CREATE INDEX IF NOT EXISTS idx_booking_offers_coach_archived
    ON booking_offers (booking_id, coach_archived_at);

-- ─── archive / unarchive RPCs ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION archive_offer_as_referee(
    p_offer_id UUID,
    p_archived BOOLEAN DEFAULT TRUE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_referee_id UUID;
BEGIN
    SELECT referee_id INTO v_referee_id
    FROM booking_offers
    WHERE id = p_offer_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Offer not found');
    END IF;

    IF auth.uid() != v_referee_id THEN
        RETURN json_build_object('error', 'Unauthorized');
    END IF;

    UPDATE booking_offers
    SET referee_archived_at = CASE WHEN p_archived THEN NOW() ELSE NULL END
    WHERE id = p_offer_id;

    RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION archive_offer_as_coach(
    p_offer_id UUID,
    p_archived BOOLEAN DEFAULT TRUE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking_id UUID;
    v_coach_id UUID;
BEGIN
    SELECT booking_id INTO v_booking_id
    FROM booking_offers
    WHERE id = p_offer_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Offer not found');
    END IF;

    SELECT coach_id INTO v_coach_id
    FROM bookings
    WHERE id = v_booking_id;

    IF auth.uid() != v_coach_id THEN
        RETURN json_build_object('error', 'Unauthorized');
    END IF;

    UPDATE booking_offers
    SET coach_archived_at = CASE WHEN p_archived THEN NOW() ELSE NULL END
    WHERE id = p_offer_id;

    RETURN json_build_object('success', true);
END;
$$;
