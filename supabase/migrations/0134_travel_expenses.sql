-- ============================================================================
-- Migration 0134: Travel expenses & platform settings
--
-- 1. Creates platform_settings key/value table for admin-configurable values
-- 2. Seeds default travel cost rate (£0.28/km = 28 pence)
-- 3. Adds travel breakdown columns to booking_offers
-- ============================================================================

-- 1. Platform settings table
CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id)
);

-- RLS: all authenticated users can read, only admins can update
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read settings"
    ON platform_settings FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can update settings"
    ON platform_settings FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can insert settings"
    ON platform_settings FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 2. Seed default travel cost
INSERT INTO platform_settings (key, value, description)
VALUES (
    'travel_cost_per_km_pence',
    '28',
    'Cost charged to coach per kilometre of referee travel (in pence). Default: 28 (£0.28/km)'
)
ON CONFLICT (key) DO NOTHING;

-- 3. Add travel breakdown columns to booking_offers
ALTER TABLE booking_offers
    ADD COLUMN IF NOT EXISTS match_fee_pence INTEGER,
    ADD COLUMN IF NOT EXISTS travel_distance_km NUMERIC(6,1),
    ADD COLUMN IF NOT EXISTS travel_cost_pence INTEGER;

-- Note: existing offers will have NULL for these columns.
-- price_pence remains the total (match_fee + travel_cost for new offers).
