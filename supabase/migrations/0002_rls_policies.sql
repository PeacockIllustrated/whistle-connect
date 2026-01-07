-- ============================================
-- WHISTLE CONNECT - ROW LEVEL SECURITY
-- Run after 0001_reset_schema.sql
-- ============================================

-- Enable RLS on all tables
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

-- ============================================
-- PROFILES POLICIES
-- ============================================

CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can view all profiles"
    ON profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ============================================
-- CLUBS POLICIES
-- ============================================

CREATE POLICY "Anyone can view clubs"
    ON clubs FOR SELECT
    USING (true);

CREATE POLICY "Coaches can insert clubs"
    ON clubs FOR INSERT
    WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches can update own clubs"
    ON clubs FOR UPDATE
    USING (auth.uid() = coach_id)
    WITH CHECK (auth.uid() = coach_id);

-- ============================================
-- REFEREE PROFILES POLICIES
-- ============================================

CREATE POLICY "Anyone can view referee profiles"
    ON referee_profiles FOR SELECT
    USING (true);

CREATE POLICY "Referees can insert own profile"
    ON referee_profiles FOR INSERT
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Referees can update own profile"
    ON referee_profiles FOR UPDATE
    USING (auth.uid() = profile_id)
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Admins can update referee profiles"
    ON referee_profiles FOR UPDATE
    USING (is_admin(auth.uid()));

-- ============================================
-- REFEREE AVAILABILITY POLICIES
-- ============================================

CREATE POLICY "Referees can view own availability"
    ON referee_availability FOR SELECT
    USING (auth.uid() = referee_id);

CREATE POLICY "Referees can manage own availability"
    ON referee_availability FOR ALL
    USING (auth.uid() = referee_id)
    WITH CHECK (auth.uid() = referee_id);

-- ============================================
-- BOOKINGS POLICIES
-- ============================================

CREATE POLICY "Coaches can view own bookings"
    ON bookings FOR SELECT
    USING (auth.uid() = coach_id);

CREATE POLICY "Referees can view offered/confirmed bookings"
    ON bookings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM booking_offers 
            WHERE booking_offers.booking_id = bookings.id 
            AND booking_offers.referee_id = auth.uid()
        )
    );

CREATE POLICY "Coaches can insert bookings"
    ON bookings FOR INSERT
    WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches can update own bookings"
    ON bookings FOR UPDATE
    USING (auth.uid() = coach_id)
    WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Admins can view all bookings"
    ON bookings FOR SELECT
    USING (is_admin(auth.uid()));

-- ============================================
-- BOOKING OFFERS POLICIES
-- ============================================

CREATE POLICY "Referees can view own offers"
    ON booking_offers FOR SELECT
    USING (auth.uid() = referee_id);

CREATE POLICY "Coaches can view offers for own bookings"
    ON booking_offers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM bookings 
            WHERE bookings.id = booking_offers.booking_id 
            AND bookings.coach_id = auth.uid()
        )
    );

CREATE POLICY "System can insert offers"
    ON booking_offers FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Referees can update own offers"
    ON booking_offers FOR UPDATE
    USING (auth.uid() = referee_id)
    WITH CHECK (auth.uid() = referee_id);

-- ============================================
-- BOOKING ASSIGNMENTS POLICIES
-- ============================================

CREATE POLICY "Anyone involved can view assignment"
    ON booking_assignments FOR SELECT
    USING (
        auth.uid() = referee_id OR
        EXISTS (
            SELECT 1 FROM bookings 
            WHERE bookings.id = booking_assignments.booking_id 
            AND bookings.coach_id = auth.uid()
        )
    );

CREATE POLICY "System can insert assignments"
    ON booking_assignments FOR INSERT
    WITH CHECK (true);

-- ============================================
-- THREADS POLICIES
-- ============================================

CREATE POLICY "Participants can view threads"
    ON threads FOR SELECT
    USING (is_thread_participant(id, auth.uid()));

CREATE POLICY "System can insert threads"
    ON threads FOR INSERT
    WITH CHECK (true);

-- ============================================
-- THREAD PARTICIPANTS POLICIES
-- ============================================

CREATE POLICY "Participants can view thread participants"
    ON thread_participants FOR SELECT
    USING (is_thread_participant(thread_id, auth.uid()));

CREATE POLICY "System can insert participants"
    ON thread_participants FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Participants can update own record"
    ON thread_participants FOR UPDATE
    USING (auth.uid() = profile_id)
    WITH CHECK (auth.uid() = profile_id);

-- ============================================
-- MESSAGES POLICIES
-- ============================================

CREATE POLICY "Participants can view messages"
    ON messages FOR SELECT
    USING (is_thread_participant(thread_id, auth.uid()));

CREATE POLICY "Participants can insert messages"
    ON messages FOR INSERT
    WITH CHECK (
        is_thread_participant(thread_id, auth.uid()) AND
        (sender_id = auth.uid() OR sender_id IS NULL)
    );

-- ============================================
-- USER BADGES POLICIES
-- ============================================

CREATE POLICY "Anyone can view user badges"
    ON user_badges FOR SELECT
    USING (true);

CREATE POLICY "System can insert badges"
    ON user_badges FOR INSERT
    WITH CHECK (true);

-- ============================================
-- BADGES TABLE (existing - add RLS if not enabled)
-- ============================================

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view badges"
    ON badges FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage badges"
    ON badges FOR ALL
    USING (is_admin(auth.uid()));
