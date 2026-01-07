-- ============================================
-- WHISTLE CONNECT - DATABASE RESET
-- Preserves: badges table and all its data
-- ============================================

-- Step 1: Drop all tables EXCEPT badges (in dependency order)
DROP TABLE IF EXISTS public.user_training_progress CASCADE;
DROP TABLE IF EXISTS public.user_badges CASCADE;
DROP TABLE IF EXISTS public.training_modules CASCADE;
DROP TABLE IF EXISTS public.tournament_matches CASCADE;
DROP TABLE IF EXISTS public.tournaments CASCADE;
DROP TABLE IF EXISTS public.referee_reflections CASCADE;
DROP TABLE IF EXISTS public.referee_ratings CASCADE;
DROP TABLE IF EXISTS public.referee_assignments CASCADE;
DROP TABLE IF EXISTS public.matches CASCADE;
DROP TABLE IF EXISTS public.seasons CASCADE;
DROP TABLE IF EXISTS public.clubs CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.counties CASCADE;
-- NOTE: badges table is NOT dropped

-- Step 2: Create new schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('coach', 'referee', 'admin');
CREATE TYPE booking_status AS ENUM ('draft', 'pending', 'offered', 'confirmed', 'completed', 'cancelled');
CREATE TYPE offer_status AS ENUM ('sent', 'accepted', 'declined', 'withdrawn', 'expired');
CREATE TYPE compliance_status AS ENUM ('not_provided', 'provided', 'verified', 'expired');
CREATE TYPE message_kind AS ENUM ('user', 'system');
CREATE TYPE match_format AS ENUM ('5v5', '7v7', '9v9', '11v11');
CREATE TYPE competition_type AS ENUM ('league', 'cup', 'friendly', 'tournament', 'other');

-- ============================================
-- PROFILES
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
-- CLUBS
-- ============================================

CREATE TABLE clubs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    coach_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    home_ground TEXT,
    postcode TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clubs_coach ON clubs(coach_id);

-- ============================================
-- REFEREE PROFILES
-- ============================================

CREATE TABLE referee_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- REFEREE AVAILABILITY
-- ============================================

CREATE TABLE referee_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- BOOKINGS
-- ============================================

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- BOOKING OFFERS
-- ============================================

CREATE TABLE booking_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- BOOKING ASSIGNMENTS
-- ============================================

CREATE TABLE booking_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
    referee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assignments_booking ON booking_assignments(booking_id);
CREATE INDEX idx_assignments_referee ON booking_assignments(referee_id);

-- ============================================
-- MESSAGING - THREADS
-- ============================================

CREATE TABLE threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_threads_booking ON threads(booking_id);

-- ============================================
-- MESSAGING - PARTICIPANTS
-- ============================================

CREATE TABLE thread_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(thread_id, profile_id)
);

CREATE INDEX idx_participants_thread ON thread_participants(thread_id);
CREATE INDEX idx_participants_profile ON thread_participants(profile_id);

-- ============================================
-- MESSAGING - MESSAGES
-- ============================================

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- USER BADGES (links to existing badges table)
-- ============================================

CREATE TABLE user_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- HELPER FUNCTIONS
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
-- TRIGGERS
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
-- DONE - Now run 0003_rls_policies.sql
-- ============================================
