-- Migration to add booking_type to bookings table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_type_enum') THEN
        CREATE TYPE public.booking_type_enum AS ENUM ('individual', 'central');
    END IF;
END $$;

ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS booking_type public.booking_type_enum DEFAULT 'individual' NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_type ON public.bookings(booking_type);
