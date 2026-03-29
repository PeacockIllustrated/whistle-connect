-- ============================================
-- Notification Categories & User Preferences
-- ============================================

-- Add category column to notifications for filtering and preferences
CREATE TYPE notification_category AS ENUM (
    'booking_update',      -- Booking status changes (confirmed, cancelled, completed)
    'offer_update',        -- Offer sent, accepted, declined, withdrawn
    'match_reminder',      -- Upcoming match reminders
    'new_match_nearby',    -- New bookings near a referee
    'sos_alert',           -- SOS urgent match notifications
    'message',             -- New message in a thread
    'verification',        -- FA/admin verification updates
    'rating',              -- New rating received
    'system'               -- System-wide announcements
);

ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS category notification_category DEFAULT 'system';

-- Index for faster category-based queries
CREATE INDEX IF NOT EXISTS idx_notifications_category
    ON notifications(user_id, category, created_at DESC);

-- Index for unread notifications lookup
CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON notifications(user_id, is_read, created_at DESC)
    WHERE is_read = FALSE;

-- ============================================
-- Notification Preferences Table
-- ============================================

CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    category notification_category NOT NULL,
    in_app BOOLEAN DEFAULT TRUE,
    push BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, category)
);

-- RLS: users can only manage their own preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
    ON notification_preferences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
    ON notification_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
    ON notification_preferences FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Update create_notification RPC to support category
-- ============================================

CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_type notification_type DEFAULT 'info',
    p_link TEXT DEFAULT NULL,
    p_category notification_category DEFAULT 'system'
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
    v_in_app BOOLEAN;
BEGIN
    -- Check user's in-app preference for this category (default: enabled)
    SELECT COALESCE(np.in_app, TRUE)
    INTO v_in_app
    FROM notification_preferences np
    WHERE np.user_id = p_user_id AND np.category = p_category;

    -- If no preference row exists, default to enabled
    IF NOT FOUND THEN
        v_in_app := TRUE;
    END IF;

    -- Skip in-app notification if user disabled it (but still return a UUID)
    IF NOT v_in_app THEN
        RETURN gen_random_uuid();
    END IF;

    INSERT INTO public.notifications (user_id, title, message, type, link, category)
    VALUES (p_user_id, p_title, p_message, p_type, p_link, p_category)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Match Reminder Helper: find bookings happening within N hours
-- ============================================

CREATE OR REPLACE FUNCTION public.get_upcoming_matches(p_hours_ahead INTEGER DEFAULT 24)
RETURNS TABLE (
    booking_id UUID,
    coach_id UUID,
    referee_id UUID,
    match_date DATE,
    kickoff_time TIME,
    ground_name TEXT,
    location_postcode TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id AS booking_id,
        b.coach_id,
        ba.referee_id,
        b.match_date,
        b.kickoff_time,
        b.ground_name,
        b.location_postcode
    FROM bookings b
    JOIN booking_assignments ba ON ba.booking_id = b.id
    WHERE b.status = 'confirmed'
      AND b.deleted_at IS NULL
      AND (b.match_date::timestamp + b.kickoff_time) > NOW()
      AND (b.match_date::timestamp + b.kickoff_time) <= NOW() + (p_hours_ahead || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
