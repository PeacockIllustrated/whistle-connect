-- Migration: 0109_fix_referee_date_availability_relationship.sql

-- 1. Add foreign key from referee_date_availability to referee_profiles
-- This allows PostgREST to perform joins between these tables using profile_id
-- which is the PK of referee_profiles and matches referee_id in availability
ALTER TABLE public.referee_date_availability
ADD CONSTRAINT referee_date_availability_referee_profiles_fkey
FOREIGN KEY (referee_id)
REFERENCES public.referee_profiles(profile_id)
ON DELETE CASCADE;

-- 2. Ensure RLS is correctly set up for the join
-- (Already exists in 0108, but good to be explicit if needed)
-- THE JOIN works better when the FK points to the specific table being joined
