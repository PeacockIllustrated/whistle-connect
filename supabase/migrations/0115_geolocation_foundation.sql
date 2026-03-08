-- ============================================================================
-- Migration 0115: Geolocation Foundation
--
-- Adds latitude/longitude storage to profiles and bookings, enables PostGIS
-- for spatial queries, and creates RPC functions for distance-based referee
-- and booking search.
-- ============================================================================

-- 1. Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Add coordinate columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326);

-- 3. Add coordinate columns to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326);

-- 4. Trigger: auto-compute geography point from lat/lon on profiles
CREATE OR REPLACE FUNCTION compute_location_point()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_compute_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON profiles
  FOR EACH ROW EXECUTE FUNCTION compute_location_point();

CREATE TRIGGER bookings_compute_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON bookings
  FOR EACH ROW EXECUTE FUNCTION compute_location_point();

-- 5. Spatial indexes for fast distance queries
CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_bookings_location ON bookings USING GIST (location);

-- 6. RPC: Find referees within radius of a point
-- Returns referees sorted by distance, filtered by availability and active status
CREATE OR REPLACE FUNCTION find_referees_within_radius(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_radius_km INTEGER DEFAULT 30
)
RETURNS TABLE (
  profile_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  distance_km DOUBLE PRECISION,
  travel_radius_km INTEGER,
  county TEXT,
  level TEXT,
  verified BOOLEAN,
  fa_verification_status fa_verification_status,
  is_available BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS profile_id,
    p.full_name,
    p.avatar_url,
    ROUND((ST_Distance(
      p.location,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography
    ) / 1000)::numeric, 1)::double precision AS distance_km,
    rp.travel_radius_km,
    rp.county,
    rp.level,
    rp.verified,
    rp.fa_verification_status,
    COALESCE(rp.is_available, false) AS is_available
  FROM profiles p
  INNER JOIN referee_profiles rp ON rp.profile_id = p.id
  WHERE p.location IS NOT NULL
    AND p.role = 'referee'
    AND ST_DWithin(
      p.location,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
      p_radius_km * 1000
    )
  ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: Find bookings near a referee (for match feed)
-- Returns unclaimed bookings within the referee's travel radius
CREATE OR REPLACE FUNCTION find_bookings_near_referee(
  p_referee_id UUID,
  p_radius_km INTEGER DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  match_date DATE,
  kickoff_time TIME,
  ground_name TEXT,
  location_postcode TEXT,
  county TEXT,
  age_group TEXT,
  format TEXT,
  competition_type TEXT,
  budget_pounds INTEGER,
  home_team TEXT,
  away_team TEXT,
  booking_type TEXT,
  is_sos BOOLEAN,
  distance_km DOUBLE PRECISION,
  coach_name TEXT,
  coach_avatar TEXT
) AS $$
DECLARE
  ref_location GEOGRAPHY;
BEGIN
  -- Get the referee's location
  SELECT p.location INTO ref_location
  FROM profiles p WHERE p.id = p_referee_id;

  IF ref_location IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.match_date,
    b.kickoff_time,
    b.ground_name,
    b.location_postcode,
    b.county,
    b.age_group,
    b.format::text,
    b.competition_type::text,
    b.budget_pounds,
    b.home_team,
    b.away_team,
    b.booking_type::text,
    COALESCE(b.is_sos, false) AS is_sos,
    ROUND((ST_Distance(b.location, ref_location) / 1000)::numeric, 1)::double precision AS distance_km,
    p.full_name AS coach_name,
    p.avatar_url AS coach_avatar
  FROM bookings b
  INNER JOIN profiles p ON p.id = b.coach_id
  WHERE b.status IN ('pending', 'offered')
    AND b.match_date >= CURRENT_DATE
    AND b.location IS NOT NULL
    AND b.deleted_at IS NULL
    AND ST_DWithin(b.location, ref_location, p_radius_km * 1000)
    -- Exclude bookings the referee has already been offered
    AND NOT EXISTS (
      SELECT 1 FROM booking_offers bo
      WHERE bo.booking_id = b.id AND bo.referee_id = p_referee_id
    )
  ORDER BY b.match_date ASC, distance_km ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION find_referees_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION find_bookings_near_referee(UUID, INTEGER) TO authenticated;
