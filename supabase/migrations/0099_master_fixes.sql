-- ============================================
-- WHISTLE CONNECT - MASTER DATABASE FIXES
-- This file consolidates all schema fixes to match the application code
-- ============================================

-- 1. FIX PROFILES TABLE
-- Ensure phone and postcode exist
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='phone') THEN
    ALTER TABLE public.profiles ADD COLUMN phone TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='postcode') THEN
    ALTER TABLE public.profiles ADD COLUMN postcode TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avatar_url') THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
  END IF;
END $$;


-- 2. FIX REFEREE_PROFILES COLUMNS
-- Rename travel_radius_miles to travel_radius_km if it exists
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referee_profiles' AND column_name='travel_radius_miles') THEN
    ALTER TABLE public.referee_profiles RENAME COLUMN travel_radius_miles TO travel_radius_km;
  END IF;
  -- If neither exists (unlikely but safe), add km
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referee_profiles' AND column_name='travel_radius_km') THEN
    ALTER TABLE public.referee_profiles ADD COLUMN travel_radius_km INTEGER DEFAULT 15;
  END IF;
END $$;

-- Ensure central_venue_opt_in exists
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referee_profiles' AND column_name='central_venue_opt_in') THEN
    ALTER TABLE public.referee_profiles ADD COLUMN central_venue_opt_in BOOLEAN DEFAULT false NOT NULL;
  END IF;
END $$;


-- 3. FIX REFEREE_AVAILABILITY RELATIONSHIPS
-- Add foreign key from referee_availability to referee_profiles
-- This is CRITICAL for joining these tables in the search query
DO $$
BEGIN
  -- First ensure the referee_id column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referee_availability' AND column_name='referee_id') THEN
    -- Check if the constraint already exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'referee_availability_referee_profiles_fkey'
    ) THEN
      ALTER TABLE public.referee_availability
      ADD CONSTRAINT referee_availability_referee_profiles_fkey
      FOREIGN KEY (referee_id)
      REFERENCES public.referee_profiles(profile_id)
      ON DELETE CASCADE;
    END IF;
  END IF;
END $$;


-- 4. FIX RLS POLICIES & BREAK RECURSION
-- Recursion happens when bookings policies check booking_offers, 
-- and booking_offers policies check bookings.
-- We use SECURITY DEFINER functions to break this loop.

CREATE OR REPLACE FUNCTION public.check_is_booking_coach(p_booking_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.bookings 
        WHERE id = p_booking_id AND coach_id = p_user_id
    );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_is_booking_referee(p_booking_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.booking_offers 
        WHERE booking_id = p_booking_id AND referee_id = p_user_id
    ) OR EXISTS (
        SELECT 1 FROM public.booking_assignments 
        WHERE booking_id = p_booking_id AND referee_id = p_user_id
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- BOOKINGS
DROP POLICY IF EXISTS "Coaches can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Referees can view offered bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Coaches can insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Coaches can update own bookings" ON public.bookings;

CREATE POLICY "Coaches can view own bookings" ON public.bookings 
FOR SELECT USING (auth.uid() = coach_id);

CREATE POLICY "Referees can view offered bookings" ON public.bookings 
FOR SELECT USING (public.check_is_booking_referee(id, auth.uid()));

CREATE POLICY "Admins can view all bookings" ON public.bookings 
FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Coaches can insert bookings" ON public.bookings 
FOR INSERT WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches can update own bookings" ON public.bookings 
FOR UPDATE USING (auth.uid() = coach_id);

-- BOOKING OFFERS
DROP POLICY IF EXISTS "Referees can view own offers" ON public.booking_offers;
DROP POLICY IF EXISTS "Coaches can view offers for own bookings" ON public.booking_offers;
DROP POLICY IF EXISTS "System can insert offers" ON public.booking_offers;
DROP POLICY IF EXISTS "Referees can update own offers" ON public.booking_offers;

CREATE POLICY "Referees can view own offers" ON public.booking_offers 
FOR SELECT USING (auth.uid() = referee_id);

CREATE POLICY "Coaches can view offers for own bookings" ON public.booking_offers 
FOR SELECT USING (public.check_is_booking_coach(booking_id, auth.uid()));

CREATE POLICY "Referees can update own offers" ON public.booking_offers 
FOR UPDATE USING (auth.uid() = referee_id);

CREATE POLICY "System can insert offers" ON public.booking_offers 
FOR INSERT WITH CHECK (true);

-- BOOKING ASSIGNMENTS
DROP POLICY IF EXISTS "Anyone involved can view assignment" ON public.booking_assignments;
DROP POLICY IF EXISTS "System can insert assignments" ON public.booking_assignments;

CREATE POLICY "Anyone involved can view assignment" ON public.booking_assignments 
FOR SELECT USING (
    auth.uid() = referee_id OR public.check_is_booking_coach(booking_id, auth.uid())
);

CREATE POLICY "System can insert assignments" ON public.booking_assignments 
FOR INSERT WITH CHECK (true);

-- THREADS
DROP POLICY IF EXISTS "Participants can view threads" ON public.threads;
DROP POLICY IF EXISTS "System can insert threads" ON public.threads;

CREATE POLICY "Participants can view threads" ON public.threads 
FOR SELECT USING (
    public.is_thread_participant(id, auth.uid()) OR 
    public.check_is_booking_coach(booking_id, auth.uid()) OR
    public.check_is_booking_referee(booking_id, auth.uid())
);

CREATE POLICY "System can insert threads" ON public.threads 
FOR INSERT WITH CHECK (true);

-- THREAD PARTICIPANTS
DROP POLICY IF EXISTS "Participants can view thread participants" ON public.thread_participants;
DROP POLICY IF EXISTS "System can insert participants" ON public.thread_participants;
DROP POLICY IF EXISTS "Participants can update own record" ON public.thread_participants;
DROP POLICY IF EXISTS "Anyone can view their own participation" ON public.thread_participants;
DROP POLICY IF EXISTS "Participants can view others in thread" ON public.thread_participants;

CREATE POLICY "Anyone can view their own participation" ON public.thread_participants
FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "Participants can view others in thread" ON public.thread_participants
FOR SELECT USING (public.is_thread_participant(thread_id, auth.uid()));

CREATE POLICY "System can insert participants" ON public.thread_participants 
FOR INSERT WITH CHECK (true);

CREATE POLICY "Participants can update own record" ON public.thread_participants 
FOR UPDATE USING (auth.uid() = profile_id);

-- MESSAGES
DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
DROP POLICY IF EXISTS "Participants can insert messages" ON public.messages;

CREATE POLICY "Participants can view messages" ON public.messages 
FOR SELECT USING (public.is_thread_participant(thread_id, auth.uid()));

CREATE POLICY "System can insert messages" ON public.messages 
FOR INSERT WITH CHECK (
    auth.uid() = sender_id OR 
    sender_id IS NULL OR 
    public.check_is_booking_coach((SELECT booking_id FROM public.threads WHERE id = thread_id), auth.uid())
);

-- AVAILABILITY
DROP POLICY IF EXISTS "Referees can view own availability" ON public.referee_availability;
DROP POLICY IF EXISTS "Authenticated users can view referee availability" ON public.referee_availability;
DROP POLICY IF EXISTS "Referees can manage own availability" ON public.referee_availability;

CREATE POLICY "Authenticated users can view referee availability" 
ON public.referee_availability FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Referees can manage own availability" 
ON public.referee_availability FOR ALL 
USING (auth.uid() = referee_id);


-- 5. FIX STORAGE ACCESS
-- Ensure bucket exists and public access is enabled
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for avatars (Safe to re-run)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
