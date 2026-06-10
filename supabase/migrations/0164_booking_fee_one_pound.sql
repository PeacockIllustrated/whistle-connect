-- ============================================================================
-- Migration 0164: Booking fee → £1.00
--
-- The platform booking fee was seeded at 99p (£0.99) by migration 0137. Per the
-- 2026-06 product review it becomes a flat £1.00, shown to the coach as its own
-- line alongside the Stripe transaction fee. It is added to the coach's escrow
-- on confirmation and refunded to the coach (with the rest of the purse) if the
-- booking is cancelled — the existing escrow_refund path already returns the
-- full escrow_amount_pence, which includes this fee.
--
-- getBookingFeePence() (src/app/app/bookings/actions.ts) reads this row; the
-- BOOKING_FEE_PENCE constant is the in-code fallback when the row is absent and
-- is updated alongside.
--
-- Guarded on the old default (value = '99') so an admin who has deliberately set
-- a custom fee via the settings UI is not overwritten.
-- ============================================================================

UPDATE platform_settings
SET value = '100',
    description = 'Platform booking fee added to each confirmed booking (in pence). Default: 100 (£1.00). Coach pays this alongside the match fee; refunded to the coach with the rest of the purse if the booking is cancelled.'
WHERE key = 'booking_fee_pence'
  AND value = '99';

-- Fresh environments that never ran 0137's seed: create the row at the new default.
INSERT INTO platform_settings (key, value, description)
VALUES (
    'booking_fee_pence',
    '100',
    'Platform booking fee added to each confirmed booking (in pence). Default: 100 (£1.00). Coach pays this alongside the match fee; refunded to the coach with the rest of the purse if the booking is cancelled.'
)
ON CONFLICT (key) DO NOTHING;
