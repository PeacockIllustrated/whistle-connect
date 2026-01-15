-- Migration: 0006_fix_availability_relationship.sql

-- 1. Add foreign key from referee_availability to referee_profiles
-- This allows PostgREST to perform joins between these tables
-- We use profile_id which is the PK of referee_profiles
ALTER TABLE public.referee_availability
ADD CONSTRAINT referee_availability_referee_profiles_fkey
FOREIGN KEY (referee_id)
REFERENCES public.referee_profiles(profile_id)
ON DELETE CASCADE;

-- 2. Update RLS policies for referee_availability
-- Coaches need to be able to see availability to search for referees
DROP POLICY IF EXISTS "Referees can view own availability" ON public.referee_availability;

CREATE POLICY "Authenticated users can view referee availability" 
ON public.referee_availability FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Referees can manage own availability" 
ON public.referee_availability FOR ALL 
USING (auth.uid() = referee_id);
