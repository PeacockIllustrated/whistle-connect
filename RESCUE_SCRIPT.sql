-- ============================================
-- WHISTLE CONNECT - THE ULTIMATE RESCUE SCRIPT
-- This script idempotently creates EVERY table in the project.
-- Safe to run multiple times in the SQL Editor.
-- ============================================

DO $$ 
BEGIN 

-- 1. ENUMS (Wait to create if not exist)
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('coach', 'referee', 'admin');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE booking_status AS ENUM ('draft', 'pending', 'offered', 'confirmed', 'completed', 'cancelled');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'offer_status') THEN
    CREATE TYPE offer_status AS ENUM ('sent', 'accepted', 'declined', 'withdrawn', 'expired', 'accepted_priced');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'compliance_status') THEN
    CREATE TYPE compliance_status AS ENUM ('not_provided', 'provided', 'verified', 'expired');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_kind') THEN
    CREATE TYPE message_kind AS ENUM ('user', 'system');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_format') THEN
    CREATE TYPE match_format AS ENUM ('5v5', '7v7', '9v9', '11v11');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'competition_type') THEN
    CREATE TYPE competition_type AS ENUM ('league', 'cup', 'friendly', 'tournament', 'other');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE notification_type AS ENUM ('info', 'success', 'warning', 'error');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_type_enum') THEN
    CREATE TYPE public.booking_type_enum AS ENUM ('individual', 'central');
END IF;

-- 2. TABLES

-- PROFILES (Should exist, but ensure columns)
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
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
ELSE
    -- Ensure columns on existing profile table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='phone') THEN
        ALTER TABLE public.profiles ADD COLUMN phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='postcode') THEN
        ALTER TABLE public.profiles ADD COLUMN postcode TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avatar_url') THEN
        ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
    END IF;
END IF;

-- CLUBS
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clubs') THEN
    CREATE TABLE clubs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        coach_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
        home_ground TEXT,
        postcode TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
END IF;

-- REFEREE_PROFILES
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referee_profiles') THEN
    CREATE TABLE public.referee_profiles (
        profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
        fa_id TEXT,
        level TEXT,
        travel_radius_km INTEGER DEFAULT 15,
        county TEXT,
        verified BOOLEAN DEFAULT FALSE,
        dbs_status compliance_status NOT NULL DEFAULT 'not_provided',
        dbs_expires_at DATE,
        safeguarding_status compliance_status NOT NULL DEFAULT 'not_provided',
        safeguarding_expires_at DATE,
        bio TEXT,
        central_venue_opt_in BOOLEAN DEFAULT false NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
END IF;

-- REFEREE_AVAILABILITY
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referee_availability') THEN
    CREATE TABLE referee_availability (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT valid_time_range CHECK (end_time > start_time)
    );
END IF;

-- REFEREE_DATE_AVAILABILITY
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referee_date_availability') THEN
    CREATE TABLE public.referee_date_availability (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT valid_date_time_range CHECK (end_time > start_time)
    );
END IF;

-- BOOKINGS
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookings') THEN
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
        county TEXT,
        home_team TEXT,
        away_team TEXT,
        address_text TEXT,
        booking_type booking_type_enum DEFAULT 'individual' NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
ELSE
    -- Add missing columns to bookings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='county') THEN
        ALTER TABLE public.bookings ADD COLUMN county TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='home_team') THEN
        ALTER TABLE public.bookings ADD COLUMN home_team TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='away_team') THEN
        ALTER TABLE public.bookings ADD COLUMN away_team TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='address_text') THEN
        ALTER TABLE public.bookings ADD COLUMN address_text TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='booking_type') THEN
        ALTER TABLE public.bookings ADD COLUMN booking_type public.booking_type_enum DEFAULT 'individual' NOT NULL;
    END IF;
END IF;

-- BOOKING_OFFERS
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_offers') THEN
    CREATE TABLE booking_offers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        referee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        status offer_status NOT NULL DEFAULT 'sent',
        price_pence INTEGER,
        currency TEXT DEFAULT 'GBP',
        sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        responded_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(booking_id, referee_id)
    );
ELSE
    -- Add price columns to offers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='booking_offers' AND column_name='price_pence') THEN
        ALTER TABLE public.booking_offers ADD COLUMN price_pence INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='booking_offers' AND column_name='currency') THEN
        ALTER TABLE public.booking_offers ADD COLUMN currency TEXT DEFAULT 'GBP';
    END IF;
END IF;

-- BOOKING_ASSIGNMENTS
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_assignments') THEN
    CREATE TABLE booking_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
        referee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
END IF;

-- THREADS
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'threads') THEN
    CREATE TABLE threads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
        title TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
END IF;

-- THREAD_PARTICIPANTS
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'thread_participants') THEN
    CREATE TABLE thread_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        last_read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(thread_id, profile_id)
    );
END IF;

-- MESSAGES
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
    CREATE TABLE messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
        kind message_kind NOT NULL DEFAULT 'user',
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
END IF;

-- NOTIFICATIONS
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    CREATE TABLE notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type notification_type DEFAULT 'info',
        link TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
END IF;

-- PUSH_SUBSCRIPTIONS
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'push_subscriptions') THEN
    CREATE TABLE push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, endpoint)
    );
END IF;

-- BADGES
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'badges') THEN
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
    
    INSERT INTO badges (code, name, description, icon, xp, applies_to_role) VALUES
    ('first_match', 'First Whistle', 'Completed your first match', '🎉', 100, 'referee'),
    ('five_matches', 'Getting Started', 'Completed 5 matches', '⭐', 250, 'referee'),
    ('ten_matches', 'Regular Ref', 'Completed 10 matches', '🏅', 500, 'referee'),
    ('verified', 'Verified Official', 'Completed verification', '✓', 200, 'referee'),
    ('quick_response', 'Quick Responder', 'Responded to offer within 1 hour', '⚡', 50, 'referee'),
    ('five_star', 'Five Star', 'Received a 5-star rating', '⭐', 100, 'referee'),
    ('first_booking', 'First Booking', 'Created your first booking', '📅', 100, 'coach'),
    ('reliable', 'Reliable', 'No cancellations for 10 matches', '💎', 300, 'both')
    ON CONFLICT (code) DO NOTHING;
END IF;

-- USER_BADGES
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_badges') THEN
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
END IF;

-- 3. RELATIONSHIP FIXES (FOR PostgREST)

-- Fix referee_availability FK
IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'referee_availability_referee_profiles_fkey') THEN
    ALTER TABLE public.referee_availability DROP CONSTRAINT IF EXISTS referee_availability_referee_id_fkey;
    ALTER TABLE public.referee_availability ADD CONSTRAINT referee_availability_referee_profiles_fkey 
    FOREIGN KEY (referee_id) REFERENCES public.referee_profiles(profile_id) ON DELETE CASCADE;
END IF;

-- Fix referee_date_availability FK
IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'referee_date_availability_referee_profiles_fkey') THEN
    ALTER TABLE public.referee_date_availability DROP CONSTRAINT IF EXISTS referee_date_availability_referee_id_fkey;
    ALTER TABLE public.referee_date_availability ADD CONSTRAINT referee_date_availability_referee_profiles_fkey 
    FOREIGN KEY (referee_id) REFERENCES public.referee_profiles(profile_id) ON DELETE CASCADE;
END IF;

END $$;

-- 4. RLS POLICIES (Safe to DROP/CREATE)

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE referee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE referee_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE referee_date_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can view date availability" ON public.referee_date_availability;
CREATE POLICY "Authenticated users can view date availability" ON public.referee_date_availability FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Referees can manage own date availability" ON public.referee_date_availability;
CREATE POLICY "Referees can manage own date availability" ON public.referee_date_availability FOR ALL USING (auth.uid() = referee_id);

DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage their own subscriptions" ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);

-- DONE
