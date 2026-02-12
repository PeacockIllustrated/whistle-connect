-- ============================================
-- Migration 0111: Fix overly permissive RLS INSERT policies
-- Date: 2026-02-11
--
-- Addresses CRITICAL security issues:
-- 1. booking_offers INSERT: WITH CHECK (true) → coach-only
-- 2. booking_assignments INSERT: WITH CHECK (true) → coach-only
-- 3. threads INSERT: WITH CHECK (true) → coach-only
-- 4. thread_participants INSERT: WITH CHECK (true) → coach/participant-only
-- 5. user_badges INSERT: WITH CHECK (true) → admin-only
-- 6. notifications INSERT: no policy → SECURITY DEFINER function
--
-- Reuses existing SECURITY DEFINER helpers:
--   check_is_booking_coach(p_booking_id, p_user_id)
--   check_is_booking_referee(p_booking_id, p_user_id)
--   is_admin(user_id)
--   is_thread_participant(p_thread_id, p_user_id)
-- ============================================

-- ============================================
-- 1. BOOKING OFFERS
-- Only the coach who owns the booking can create offers
-- ============================================
DROP POLICY IF EXISTS "System can insert offers" ON public.booking_offers;
DROP POLICY IF EXISTS "Coaches can insert offers for own bookings" ON public.booking_offers;

CREATE POLICY "Coaches can insert offers for own bookings"
    ON public.booking_offers
    FOR INSERT
    WITH CHECK (
        public.check_is_booking_coach(booking_id, auth.uid())
    );

-- ============================================
-- 2. BOOKING ASSIGNMENTS
-- Only the coach who owns the booking can create assignments
-- ============================================
DROP POLICY IF EXISTS "System can insert assignments" ON public.booking_assignments;
DROP POLICY IF EXISTS "Coaches can insert assignments for own bookings" ON public.booking_assignments;

CREATE POLICY "Coaches can insert assignments for own bookings"
    ON public.booking_assignments
    FOR INSERT
    WITH CHECK (
        public.check_is_booking_coach(booking_id, auth.uid())
    );

-- ============================================
-- 3. THREADS
-- Only the coach of the related booking can create threads
-- ============================================
DROP POLICY IF EXISTS "System can insert threads" ON public.threads;
DROP POLICY IF EXISTS "Coaches can insert threads for own bookings" ON public.threads;

CREATE POLICY "Coaches can insert threads for own bookings"
    ON public.threads
    FOR INSERT
    WITH CHECK (
        public.check_is_booking_coach(booking_id, auth.uid())
    );

-- ============================================
-- 4. THREAD PARTICIPANTS
-- Coach of the booking OR existing thread participant can add members
-- ============================================
DROP POLICY IF EXISTS "System can insert participants" ON public.thread_participants;
DROP POLICY IF EXISTS "Booking coaches or participants can add participants" ON public.thread_participants;

CREATE POLICY "Booking coaches or participants can add participants"
    ON public.thread_participants
    FOR INSERT
    WITH CHECK (
        -- Existing participant can add others
        public.is_thread_participant(thread_id, auth.uid())
        OR
        -- Coach of the booking associated with the thread can add
        EXISTS (
            SELECT 1 FROM public.threads t
            WHERE t.id = thread_id
            AND public.check_is_booking_coach(t.booking_id, auth.uid())
        )
    );

-- ============================================
-- 5. USER BADGES
-- Only admins can award badges
-- ============================================
DROP POLICY IF EXISTS "System can insert badges" ON public.user_badges;
DROP POLICY IF EXISTS "Admins can insert badges" ON public.user_badges;

CREATE POLICY "Admins can insert badges"
    ON public.user_badges
    FOR INSERT
    WITH CHECK (
        public.is_admin(auth.uid())
    );

-- ============================================
-- 6. NOTIFICATIONS
-- Create a SECURITY DEFINER function for server-side insertion
-- This is necessary because notifications are created FOR other users
-- (e.g., a coach's action creates a notification for a referee)
-- Using auth.uid() = user_id would fail since the acting user != target user
-- ============================================

CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_type notification_type DEFAULT 'info',
    p_link TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (p_user_id, p_title, p_message, p_type, p_link)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restrict direct inserts: only authenticated users can insert
-- (the SECURITY DEFINER function above is the preferred path for cross-user inserts)
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;

CREATE POLICY "Authenticated users can insert notifications"
    ON public.notifications
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
    );
