-- Migration: 0108_date_specific_availability.sql
-- Create table for date-specific availability

CREATE TABLE IF NOT EXISTS public.referee_date_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_date_availability_referee ON public.referee_date_availability(referee_id);
CREATE INDEX IF NOT EXISTS idx_date_availability_date ON public.referee_date_availability(date);

-- Enable RLS
ALTER TABLE public.referee_date_availability ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view date availability" 
ON public.referee_date_availability FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Referees can manage own date availability" 
ON public.referee_date_availability FOR ALL 
USING (auth.uid() = referee_id);
