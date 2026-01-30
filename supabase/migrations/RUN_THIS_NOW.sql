-- ============================================
-- COMBINED MIGRATION SCRIPT
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================

-- 0105: Add booking fields for Central Venue and Individual Games
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS county TEXT,
ADD COLUMN IF NOT EXISTS home_team TEXT,
ADD COLUMN IF NOT EXISTS away_team TEXT,
ADD COLUMN IF NOT EXISTS address_text TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_county ON public.bookings(county);

-- 0106: Add booking_type enum and column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_type_enum') THEN
        CREATE TYPE public.booking_type_enum AS ENUM ('individual', 'central');
    END IF;
END $$;

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS booking_type public.booking_type_enum DEFAULT 'individual';

CREATE INDEX IF NOT EXISTS idx_bookings_type ON public.bookings(booking_type);

-- 0107: Add price negotiation fields to booking_offers
ALTER TABLE public.booking_offers ADD COLUMN IF NOT EXISTS price_pence INTEGER;
ALTER TABLE public.booking_offers ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GBP';

-- Add accepted_priced to offer_status enum (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'accepted_priced'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'offer_status')
    ) THEN
        ALTER TYPE offer_status ADD VALUE 'accepted_priced';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 0108: Create referee_date_availability table
CREATE TABLE IF NOT EXISTS public.referee_date_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_date_availability_referee ON public.referee_date_availability(referee_id);
CREATE INDEX IF NOT EXISTS idx_date_availability_date ON public.referee_date_availability(date);

-- Enable RLS on referee_date_availability
ALTER TABLE public.referee_date_availability ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist, then recreate
DROP POLICY IF EXISTS "Authenticated users can view date availability" ON public.referee_date_availability;
DROP POLICY IF EXISTS "Referees can manage own date availability" ON public.referee_date_availability;

CREATE POLICY "Authenticated users can view date availability"
ON public.referee_date_availability FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Referees can manage own date availability"
ON public.referee_date_availability FOR ALL
USING (auth.uid() = referee_id);

-- ============================================
-- DONE! All missing columns and tables added.
-- ============================================
