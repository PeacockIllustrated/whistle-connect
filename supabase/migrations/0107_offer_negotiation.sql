-- Add price_pence and currency to booking_offers
ALTER TABLE booking_offers ADD COLUMN price_pence INTEGER;
ALTER TABLE booking_offers ADD COLUMN currency TEXT DEFAULT 'GBP';

-- Add accepted_priced to offer_status enum
-- In Supabase/PostgreSQL, adding a value to an existing enum requires specific syntax
ALTER TYPE offer_status ADD VALUE IF NOT EXISTS 'accepted_priced';
