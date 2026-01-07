-- ============================================
-- WHISTLE CONNECT - DATABASE SCHEMA
-- Migration: 0001_initial_schema.sql
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE
-- User profiles with role assignment
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('coach', 'referee', 'admin')),
  full_name TEXT NOT NULL,
  phone TEXT,
  postcode TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profile updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CLUBS TABLE
-- Coach/manager clubs
-- ============================================
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  home_postcode TEXT NOT NULL,
  ground_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER clubs_updated_at
  BEFORE UPDATE ON clubs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- REFEREE PROFILES TABLE
-- Extended referee-specific data
-- ============================================
CREATE TABLE referee_profiles (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  fa_id TEXT,
  level TEXT,
  travel_radius_km INTEGER DEFAULT 15,
  county TEXT,
  verified BOOLEAN DEFAULT FALSE,
  dbs_status TEXT NOT NULL DEFAULT 'not_provided' 
    CHECK (dbs_status IN ('not_provided', 'provided', 'verified', 'expired')),
  dbs_expires_at DATE,
  safeguarding_status TEXT NOT NULL DEFAULT 'not_provided'
    CHECK (safeguarding_status IN ('not_provided', 'provided', 'verified', 'expired')),
  safeguarding_expires_at DATE,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER referee_profiles_updated_at
  BEFORE UPDATE ON referee_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- REFEREE AVAILABILITY TABLE
-- Weekly recurring availability slots
-- ============================================
CREATE TABLE referee_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- Index for quick availability lookups
CREATE INDEX idx_referee_availability_referee ON referee_availability(referee_id);
CREATE INDEX idx_referee_availability_day ON referee_availability(day_of_week);

-- ============================================
-- BOOKINGS TABLE
-- Match booking requests from coaches
-- ============================================
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'offered', 'confirmed', 'completed', 'cancelled')),
  match_date DATE NOT NULL,
  kickoff_time TIME NOT NULL,
  location_postcode TEXT NOT NULL,
  ground_name TEXT,
  age_group TEXT,
  format TEXT CHECK (format IN ('5v5', '7v7', '9v9', '11v11')),
  competition_type TEXT CHECK (competition_type IN ('league', 'cup', 'friendly', 'tournament', 'other')),
  referee_level_required TEXT,
  notes TEXT,
  budget_pounds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes for booking queries
CREATE INDEX idx_bookings_coach ON bookings(coach_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_date ON bookings(match_date);

-- ============================================
-- BOOKING OFFERS TABLE
-- Offers sent to referees for bookings
-- ============================================
CREATE TABLE booking_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'accepted', 'declined', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT unique_booking_referee UNIQUE (booking_id, referee_id)
);

CREATE INDEX idx_booking_offers_booking ON booking_offers(booking_id);
CREATE INDEX idx_booking_offers_referee ON booking_offers(referee_id);
CREATE INDEX idx_booking_offers_status ON booking_offers(status);

-- ============================================
-- BOOKING ASSIGNMENTS TABLE
-- Confirmed referee assignments
-- ============================================
CREATE TABLE booking_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_booking_assignments_referee ON booking_assignments(referee_id);

-- ============================================
-- THREADS TABLE
-- Message threads, typically tied to bookings
-- ============================================
CREATE TABLE threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER threads_updated_at
  BEFORE UPDATE ON threads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_threads_booking ON threads(booking_id);

-- ============================================
-- THREAD PARTICIPANTS TABLE
-- Users participating in threads
-- ============================================
CREATE TABLE thread_participants (
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ,
  PRIMARY KEY (thread_id, profile_id)
);

CREATE INDEX idx_thread_participants_profile ON thread_participants(profile_id);

-- ============================================
-- MESSAGES TABLE
-- Chat messages within threads
-- ============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'user' CHECK (kind IN ('user', 'system')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_messages_created ON messages(created_at);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = user_id AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if user is thread participant
CREATE OR REPLACE FUNCTION is_thread_participant(user_id UUID, thread_id_param UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM thread_participants 
    WHERE profile_id = user_id AND thread_id = thread_id_param
  );
$$ LANGUAGE sql SECURITY DEFINER;
