-- Migration to add fields for Central Venue and Individual Games bookings
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS county TEXT,
ADD COLUMN IF NOT EXISTS home_team TEXT,
ADD COLUMN IF NOT EXISTS away_team TEXT,
ADD COLUMN IF NOT EXISTS address_text TEXT;

-- Update the existing indices if necessary, or add new ones for search
CREATE INDEX IF NOT EXISTS idx_bookings_county ON public.bookings(county);
