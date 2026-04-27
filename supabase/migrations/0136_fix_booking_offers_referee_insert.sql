-- ============================================================================
-- Migration 0136: Allow referees to insert their own booking_offers
--
-- Problem: Migration 0111 locked down booking_offers INSERT to the coach who
-- owns the booking (`check_is_booking_coach`). That broke the "I'm Available"
-- button on the referee feed (src/app/app/feed/actions.ts::expressInterest),
-- which creates an offer with referee_id = auth.uid(). The insert now fails
-- with: new row violates row-level security policy for table "booking_offers".
--
-- Fix: Allow EITHER the booking's coach OR the referee themselves to insert
-- a row. The server action already validates the booking state and prevents
-- duplicates, and the UNIQUE(booking_id, referee_id) constraint blocks abuse.
-- ============================================================================

DROP POLICY IF EXISTS "Coaches can insert offers for own bookings" ON public.booking_offers;
DROP POLICY IF EXISTS "Coaches or referees can insert offers" ON public.booking_offers;

CREATE POLICY "Coaches or referees can insert offers"
    ON public.booking_offers
    FOR INSERT
    WITH CHECK (
        -- Coach of the booking can offer to a referee
        public.check_is_booking_coach(booking_id, auth.uid())
        OR
        -- Referee can express interest in their own name
        referee_id = auth.uid()
    );
