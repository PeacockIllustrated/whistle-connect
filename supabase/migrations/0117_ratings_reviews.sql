-- ============================================================================
-- Migration 0117: Ratings & Reviews
--
-- Adds a match_ratings table so coaches can rate referees after completed
-- matches. Includes sub-ratings for punctuality, communication, and
-- professionalism, plus an optional text comment.
-- ============================================================================

-- 1. Create the match_ratings table
CREATE TABLE IF NOT EXISTS match_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id),
  referee_id UUID NOT NULL REFERENCES profiles(id),
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  punctuality SMALLINT CHECK (punctuality BETWEEN 1 AND 5),
  communication SMALLINT CHECK (communication BETWEEN 1 AND 5),
  professionalism SMALLINT CHECK (professionalism BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One review per booking per reviewer
  CONSTRAINT uq_rating_booking_reviewer UNIQUE (booking_id, reviewer_id)
);

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_ratings_referee ON match_ratings(referee_id);
CREATE INDEX IF NOT EXISTS idx_ratings_booking ON match_ratings(booking_id);

-- 3. RLS Policies
ALTER TABLE match_ratings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read ratings (for referee profiles)
CREATE POLICY "Authenticated users can view ratings"
  ON match_ratings FOR SELECT
  TO authenticated
  USING (true);

-- Coaches can insert ratings for their own bookings
CREATE POLICY "Coaches can insert own ratings"
  ON match_ratings FOR INSERT
  TO authenticated
  WITH CHECK (reviewer_id = auth.uid());
