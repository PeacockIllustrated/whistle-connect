-- ============================================
-- WHISTLE CONNECT - COMPLETE DATABASE SETUP
-- Run this ONCE in a fresh Supabase project
-- ============================================

-- Step 1: Clean up everything first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_thread_participant(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at() CASCADE;

DROP TABLE IF EXISTS public.user_badges CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.thread_participants CASCADE;
DROP TABLE IF EXISTS public.threads CASCADE;
DROP TABLE IF EXISTS public.booking_assignments CASCADE;
DROP TABLE IF EXISTS public.booking_offers CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.referee_availability CASCADE;
DROP TABLE IF EXISTS public.referee_profiles CASCADE;
DROP TABLE IF EXISTS public.clubs CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.badges CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS booking_status CASCADE;
DROP TYPE IF EXISTS offer_status CASCADE;
DROP TYPE IF EXISTS compliance_status CASCADE;
DROP TYPE IF EXISTS message_kind CASCADE;
DROP TYPE IF EXISTS match_format CASCADE;
DROP TYPE IF EXISTS competition_type CASCADE;

-- ============================================
-- Step 2: Create ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('coach', 'referee', 'admin');
CREATE TYPE booking_status AS ENUM ('draft', 'pending', 'offered', 'confirmed', 'completed', 'cancelled');
CREATE TYPE offer_status AS ENUM ('sent', 'accepted', 'declined', 'withdrawn', 'expired');
CREATE TYPE compliance_status AS ENUM ('not_provided', 'provided', 'verified', 'expired');
CREATE TYPE message_kind AS ENUM ('user', 'system');
CREATE TYPE match_format AS ENUM ('5v5', '7v7', '9v9', '11v11');
CREATE TYPE competition_type AS ENUM ('league', 'cup', 'friendly', 'tournament', 'other');

-- ============================================
-- Step 3: Create BADGES table
-- ============================================

CREATE TABLE badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    xp INTEGER DEFAULT 0,
    applies_to_role TEXT NOT NULL DEFAULT 'referee' CHECK (applies_to_role IN ('referee', 'coach', 'both')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default badges
INSERT INTO badges (code, name, description, icon, xp, applies_to_role) VALUES
('first_match', 'First Whistle', 'Completed your first match', '🎉', 100, 'referee'),
('five_matches', 'Getting Started', 'Completed 5 matches', '⭐', 250, 'referee'),
('ten_matches', 'Regular Ref', 'Completed 10 matches', '🏅', 500, 'referee'),
('verified', 'Verified Official', 'Completed verification', '✓', 200, 'referee'),
('quick_response', 'Quick Responder', 'Responded to offer within 1 hour', '⚡', 50, 'referee'),
('five_star', 'Five Star', 'Received a 5-star rating', '⭐', 100, 'referee'),
('first_booking', 'First Booking', 'Created your first booking', '📅', 100, 'coach'),
('reliable', 'Reliable', 'No cancellations for 10 matches', '💎', 300, 'both');

-- ============================================
-- Step 4: Create PROFILES table
-- ============================================

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'coach',
    full_name TEXT NOT NULL,
    phone TEXT,
    postcode TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_role ON profiles(role);

-- ============================================
-- Step 5: Create CLUBS table
-- ============================================

CREATE TABLE clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    coach_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    home_ground TEXT,
    postcode TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clubs_coach ON clubs(coach_id);

-- ============================================
-- Step 6: Create REFEREE_PROFILES table
-- ============================================

CREATE TABLE referee_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    fa_id TEXT,
    level TEXT,
    county TEXT,
    dbs_status compliance_status NOT NULL DEFAULT 'not_provided',
    dbs_expires_at DATE,
    safeguarding_status compliance_status NOT NULL DEFAULT 'not_provided',
    safeguarding_expires_at DATE,
    verified BOOLEAN NOT NULL DEFAULT false,
    travel_radius_miles INTEGER DEFAULT 15,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_referee_profiles_profile ON referee_profiles(profile_id);
CREATE INDEX idx_referee_profiles_verified ON referee_profiles(verified);

-- ============================================
-- Step 7: Create REFEREE_AVAILABILITY table
-- ============================================

CREATE TABLE referee_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

CREATE INDEX idx_availability_referee ON referee_availability(referee_id);
CREATE INDEX idx_availability_day ON referee_availability(day_of_week);

-- ============================================
-- Step 8: Create BOOKINGS table
-- ============================================

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
    status booking_status NOT NULL DEFAULT 'draft',
    match_date DATE NOT NULL,
    kickoff_time TIME NOT NULL,
    location_postcode TEXT NOT NULL,
    ground_name TEXT,
    age_group TEXT,
    format match_format,
    competition_type competition_type,
    referee_level_required TEXT,
    notes TEXT,
    budget_pounds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookings_coach ON bookings(coach_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_date ON bookings(match_date);

-- ============================================
-- Step 9: Create BOOKING_OFFERS table
-- ============================================

CREATE TABLE booking_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    referee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status offer_status NOT NULL DEFAULT 'sent',
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(booking_id, referee_id)
);

CREATE INDEX idx_offers_booking ON booking_offers(booking_id);
CREATE INDEX idx_offers_referee ON booking_offers(referee_id);
CREATE INDEX idx_offers_status ON booking_offers(status);

-- ============================================
-- Step 10: Create BOOKING_ASSIGNMENTS table
-- ============================================

CREATE TABLE booking_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
    referee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assignments_booking ON booking_assignments(booking_id);
CREATE INDEX idx_assignments_referee ON booking_assignments(referee_id);

-- ============================================
-- Step 11: Create THREADS table
-- ============================================

CREATE TABLE threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_threads_booking ON threads(booking_id);

-- ============================================
-- Step 12: Create THREAD_PARTICIPANTS table
-- ============================================

CREATE TABLE thread_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(thread_id, profile_id)
);

CREATE INDEX idx_participants_thread ON thread_participants(thread_id);
CREATE INDEX idx_participants_profile ON thread_participants(profile_id);

-- ============================================
-- Step 13: Create MESSAGES table
-- ============================================

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    kind message_kind NOT NULL DEFAULT 'user',
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(created_at);

-- ============================================
-- Step 14: Create USER_BADGES table
-- ============================================

CREATE TABLE user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    awarded_by TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);
CREATE INDEX idx_user_badges_badge ON user_badges(badge_id);

-- ============================================
-- Step 15: Create HELPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS user_role AS $$
    SELECT role FROM profiles WHERE id = user_id;
$$ LANGUAGE SQL SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles WHERE id = user_id AND role = 'admin'
    );
$$ LANGUAGE SQL SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_thread_participant(p_thread_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM thread_participants 
        WHERE thread_id = p_thread_id AND profile_id = p_user_id
    );
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================
-- Step 16: Create UPDATE TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_clubs_updated_at
    BEFORE UPDATE ON clubs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_referee_profiles_updated_at
    BEFORE UPDATE ON referee_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_threads_updated_at
    BEFORE UPDATE ON threads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Step 17: Create AUTH TRIGGER (auto-create profile on signup)
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_role_val user_role;
BEGIN
    -- Get role from metadata, default to 'coach'
    user_role_val := COALESCE(
        (NEW.raw_user_meta_data->>'role')::user_role, 
        'coach'::user_role
    );
    
    -- Insert profile
    INSERT INTO public.profiles (id, role, full_name, phone, postcode)
    VALUES (
        NEW.id,
        user_role_val,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'postcode'
    );
    
    -- If referee, also create referee_profile
    IF user_role_val = 'referee' THEN
        INSERT INTO public.referee_profiles (profile_id)
        VALUES (NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Step 18: Enable RLS on all tables
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE referee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE referee_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 19: Create RLS POLICIES
-- ============================================

-- PROFILES
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- CLUBS
CREATE POLICY "Anyone can view clubs" ON clubs FOR SELECT USING (true);
CREATE POLICY "Coaches can insert clubs" ON clubs FOR INSERT WITH CHECK (auth.uid() = coach_id);
CREATE POLICY "Coaches can update own clubs" ON clubs FOR UPDATE USING (auth.uid() = coach_id);

-- REFEREE PROFILES
CREATE POLICY "Anyone can view referee profiles" ON referee_profiles FOR SELECT USING (true);
CREATE POLICY "Referees can insert own profile" ON referee_profiles FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Referees can update own profile" ON referee_profiles FOR UPDATE USING (auth.uid() = profile_id);
CREATE POLICY "Admins can update referee profiles" ON referee_profiles FOR UPDATE USING (is_admin(auth.uid()));

-- REFEREE AVAILABILITY
CREATE POLICY "Referees can view own availability" ON referee_availability FOR SELECT USING (auth.uid() = referee_id);
CREATE POLICY "Referees can manage own availability" ON referee_availability FOR ALL USING (auth.uid() = referee_id);

-- BOOKINGS
CREATE POLICY "Coaches can view own bookings" ON bookings FOR SELECT USING (auth.uid() = coach_id);
CREATE POLICY "Referees can view offered bookings" ON bookings FOR SELECT USING (
    EXISTS (SELECT 1 FROM booking_offers WHERE booking_offers.booking_id = bookings.id AND booking_offers.referee_id = auth.uid())
);
CREATE POLICY "Admins can view all bookings" ON bookings FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Coaches can insert bookings" ON bookings FOR INSERT WITH CHECK (auth.uid() = coach_id);
CREATE POLICY "Coaches can update own bookings" ON bookings FOR UPDATE USING (auth.uid() = coach_id);

-- BOOKING OFFERS
CREATE POLICY "Referees can view own offers" ON booking_offers FOR SELECT USING (auth.uid() = referee_id);
CREATE POLICY "Coaches can view offers for own bookings" ON booking_offers FOR SELECT USING (
    EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_offers.booking_id AND bookings.coach_id = auth.uid())
);
CREATE POLICY "System can insert offers" ON booking_offers FOR INSERT WITH CHECK (true);
CREATE POLICY "Referees can update own offers" ON booking_offers FOR UPDATE USING (auth.uid() = referee_id);

-- BOOKING ASSIGNMENTS
CREATE POLICY "Anyone involved can view assignment" ON booking_assignments FOR SELECT USING (
    auth.uid() = referee_id OR EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_assignments.booking_id AND bookings.coach_id = auth.uid())
);
CREATE POLICY "System can insert assignments" ON booking_assignments FOR INSERT WITH CHECK (true);

-- THREADS
CREATE POLICY "Participants can view threads" ON threads FOR SELECT USING (is_thread_participant(id, auth.uid()));
CREATE POLICY "System can insert threads" ON threads FOR INSERT WITH CHECK (true);

-- THREAD PARTICIPANTS
CREATE POLICY "Participants can view thread participants" ON thread_participants FOR SELECT USING (is_thread_participant(thread_id, auth.uid()));
CREATE POLICY "System can insert participants" ON thread_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Participants can update own record" ON thread_participants FOR UPDATE USING (auth.uid() = profile_id);

-- MESSAGES
CREATE POLICY "Participants can view messages" ON messages FOR SELECT USING (is_thread_participant(thread_id, auth.uid()));
CREATE POLICY "Participants can insert messages" ON messages FOR INSERT WITH CHECK (
    is_thread_participant(thread_id, auth.uid()) AND (sender_id = auth.uid() OR sender_id IS NULL)
);

-- BADGES
CREATE POLICY "Anyone can view badges" ON badges FOR SELECT USING (true);
CREATE POLICY "Admins can manage badges" ON badges FOR ALL USING (is_admin(auth.uid()));

-- USER BADGES
CREATE POLICY "Anyone can view user badges" ON user_badges FOR SELECT USING (true);
CREATE POLICY "System can insert badges" ON user_badges FOR INSERT WITH CHECK (true);

-- ============================================
-- DONE! Database is fully set up.
-- ============================================
