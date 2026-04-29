-- ============================================================================
-- Migration 0141: Withdraw orphaned 'sent' offers on soft-deleted bookings
-- Date: 2026-04-29
--
-- Symptom: a referee's "My Offers" badge showed 4 but the My Offers tab
-- rendered empty. Root cause: deleteBooking() soft-deleted the booking
-- (deleted_at IS NOT NULL) but never updated the related booking_offers
-- rows. The badge query counted them; getMyOffers() filtered them out via
-- the booking join.
--
-- The application code is fixed in the same PR (deleteBooking now also
-- updates the offers, and the layout count now joins to bookings to
-- exclude soft-deleted ones). This migration is a one-time backfill for
-- offers that were already orphaned before the fix shipped.
--
-- Withdrawing is the correct semantic: the booking is gone, the offer
-- can no longer be accepted, and 'withdrawn' is exactly what the existing
-- cancelBooking flow does to active offers. Refs see a Withdrawn chip in
-- their offer history.
-- ============================================================================

UPDATE booking_offers o
SET status = 'withdrawn'
FROM bookings b
WHERE o.booking_id = b.id
  AND o.status IN ('sent', 'accepted_priced')
  AND b.deleted_at IS NOT NULL;
