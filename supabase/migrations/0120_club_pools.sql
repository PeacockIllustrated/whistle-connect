-- ============================================================================
-- Migration 0120: Club Referee Pools
--
-- Adds tables for club membership and referee pools. Clubs can maintain
-- a list of trusted referees who get priority for bookings.
-- ============================================================================

-- 1. Club members (coaches who belong to a club)
CREATE TABLE IF NOT EXISTS club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_club_member UNIQUE (club_id, profile_id)
);

-- 2. Club referee pool (trusted referees for a club)
CREATE TABLE IF NOT EXISTS club_referee_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  added_by UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_club_referee UNIQUE (club_id, referee_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_club_members_club ON club_members(club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_profile ON club_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_club_pool_club ON club_referee_pool(club_id);
CREATE INDEX IF NOT EXISTS idx_club_pool_referee ON club_referee_pool(referee_id);

-- 4. RLS
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_referee_pool ENABLE ROW LEVEL SECURITY;

-- Club members can view their club's members
CREATE POLICY "Members can view own club"
  ON club_members FOR SELECT
  TO authenticated
  USING (
    club_id IN (
      SELECT cm.club_id FROM club_members cm WHERE cm.profile_id = auth.uid()
    )
  );

-- Club owners/admins can manage members
CREATE POLICY "Admins can manage members"
  ON club_members FOR INSERT
  TO authenticated
  WITH CHECK (
    club_id IN (
      SELECT cm.club_id FROM club_members cm
      WHERE cm.profile_id = auth.uid() AND cm.role IN ('owner', 'admin')
    )
  );

-- Club members can view their referee pool
CREATE POLICY "Members can view referee pool"
  ON club_referee_pool FOR SELECT
  TO authenticated
  USING (
    club_id IN (
      SELECT cm.club_id FROM club_members cm WHERE cm.profile_id = auth.uid()
    )
  );

-- Club owners/admins can manage the pool
CREATE POLICY "Admins can manage referee pool"
  ON club_referee_pool FOR ALL
  TO authenticated
  USING (
    club_id IN (
      SELECT cm.club_id FROM club_members cm
      WHERE cm.profile_id = auth.uid() AND cm.role IN ('owner', 'admin')
    )
  );
