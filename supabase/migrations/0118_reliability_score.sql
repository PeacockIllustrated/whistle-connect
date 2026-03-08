-- ============================================================================
-- Migration 0118: Reliability Score
--
-- Adds reliability tracking columns to referee_profiles and a function to
-- recalculate scores based on match completion rate (70%) and average
-- rating (30%).
-- ============================================================================

-- 1. Add reliability columns to referee_profiles
ALTER TABLE referee_profiles
  ADD COLUMN IF NOT EXISTS reliability_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_matches_completed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cancellations INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS average_rating DOUBLE PRECISION NOT NULL DEFAULT 0;

-- 2. Create the recalculate function
CREATE OR REPLACE FUNCTION recalculate_reliability(p_referee_id UUID)
RETURNS VOID AS $$
DECLARE
  v_completed INTEGER;
  v_cancellations INTEGER;
  v_avg_rating DOUBLE PRECISION;
  v_completion_rate DOUBLE PRECISION;
  v_score DOUBLE PRECISION;
BEGIN
  -- Count completed matches (from booking_assignments + completed bookings)
  SELECT COUNT(*) INTO v_completed
  FROM booking_assignments ba
  INNER JOIN bookings b ON b.id = ba.booking_id
  WHERE ba.referee_id = p_referee_id
    AND b.status = 'completed';

  -- Count cancellations (offers that were withdrawn by the referee after accepting)
  SELECT COUNT(*) INTO v_cancellations
  FROM booking_offers bo
  WHERE bo.referee_id = p_referee_id
    AND bo.status = 'withdrawn';

  -- Average rating
  SELECT COALESCE(AVG(rating), 0) INTO v_avg_rating
  FROM match_ratings
  WHERE referee_id = p_referee_id;

  -- Calculate completion rate (0-100)
  IF (v_completed + v_cancellations) > 0 THEN
    v_completion_rate := (v_completed::DOUBLE PRECISION / (v_completed + v_cancellations)::DOUBLE PRECISION) * 100;
  ELSE
    v_completion_rate := 0;
  END IF;

  -- Final score: 70% completion rate + 30% normalized rating (rating * 20 to get 0-100 scale)
  IF v_completed > 0 OR v_cancellations > 0 THEN
    v_score := (v_completion_rate * 0.7) + ((v_avg_rating * 20) * 0.3);
  ELSE
    v_score := 0;
  END IF;

  -- Update the referee profile
  UPDATE referee_profiles
  SET reliability_score = ROUND(v_score::NUMERIC, 1),
      total_matches_completed = v_completed,
      total_cancellations = v_cancellations,
      average_rating = ROUND(v_avg_rating::NUMERIC, 2)
  WHERE profile_id = p_referee_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger: recalculate after a booking is completed
CREATE OR REPLACE FUNCTION trigger_recalc_on_booking_complete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Find the assigned referee and recalculate
    PERFORM recalculate_reliability(ba.referee_id)
    FROM booking_assignments ba
    WHERE ba.booking_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_recalc_booking_complete ON bookings;
CREATE TRIGGER trg_recalc_booking_complete
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalc_on_booking_complete();

-- 4. Trigger: recalculate after a new rating is inserted
CREATE OR REPLACE FUNCTION trigger_recalc_on_rating()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recalculate_reliability(NEW.referee_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_recalc_on_rating ON match_ratings;
CREATE TRIGGER trg_recalc_on_rating
  AFTER INSERT ON match_ratings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalc_on_rating();

-- 5. Trigger: recalculate after an offer is withdrawn
CREATE OR REPLACE FUNCTION trigger_recalc_on_withdrawal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'withdrawn' AND OLD.status != 'withdrawn' THEN
    PERFORM recalculate_reliability(NEW.referee_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_recalc_on_withdrawal ON booking_offers;
CREATE TRIGGER trg_recalc_on_withdrawal
  AFTER UPDATE ON booking_offers
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalc_on_withdrawal();
