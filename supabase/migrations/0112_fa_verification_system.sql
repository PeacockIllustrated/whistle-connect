-- ============================================
-- FA VERIFICATION SYSTEM
-- Adds proper FA number verification workflow
-- ============================================

-- 1. Create fa_verification_status enum
CREATE TYPE fa_verification_status AS ENUM (
    'not_provided',
    'pending',
    'verified',
    'rejected'
);

-- 2. Add fa_verification_status column to referee_profiles
ALTER TABLE referee_profiles
    ADD COLUMN fa_verification_status fa_verification_status NOT NULL DEFAULT 'not_provided';

-- 3. Backfill existing data
UPDATE referee_profiles
SET fa_verification_status = CASE
    WHEN fa_id IS NOT NULL AND fa_id != '' THEN 'pending'::fa_verification_status
    ELSE 'not_provided'::fa_verification_status
END;

-- 4. Add UNIQUE constraint on fa_id (NULLs excluded by default in PostgreSQL)
ALTER TABLE referee_profiles
    ADD CONSTRAINT unique_fa_id UNIQUE (fa_id);

-- 5. Add CHECK constraint: fa_id must be 8-10 digits or NULL
ALTER TABLE referee_profiles
    ADD CONSTRAINT valid_fa_id_format
    CHECK (fa_id IS NULL OR fa_id ~ '^\d{8,10}$');

-- 6. Create fa_verification_requests table (the queue)
CREATE TABLE fa_verification_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    fa_id TEXT NOT NULL,
    county TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'awaiting_fa_response'
        CHECK (status IN ('awaiting_fa_response', 'confirmed', 'rejected')),
    requested_by UUID NOT NULL REFERENCES profiles(id),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fa_verification_referee ON fa_verification_requests(referee_id);
CREATE INDEX idx_fa_verification_status ON fa_verification_requests(status);

-- 7. RLS for fa_verification_requests
ALTER TABLE fa_verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all FA verification requests"
    ON fa_verification_requests FOR SELECT
    USING (is_admin(auth.uid()));

CREATE POLICY "Referees can view own FA verification requests"
    ON fa_verification_requests FOR SELECT
    USING (auth.uid() = referee_id);

CREATE POLICY "Admins can insert FA verification requests"
    ON fa_verification_requests FOR INSERT
    WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update FA verification requests"
    ON fa_verification_requests FOR UPDATE
    USING (is_admin(auth.uid()));

-- 8. Create county_fa_contacts lookup table
CREATE TABLE county_fa_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    county_name TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE county_fa_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view county FA contacts"
    ON county_fa_contacts FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage county FA contacts"
    ON county_fa_contacts FOR ALL
    USING (is_admin(auth.uid()));

-- 9. Seed county FA contact emails
-- NOTE: These email addresses are placeholders and should be verified before production use
INSERT INTO county_fa_contacts (county_name, email) VALUES
    ('Bedfordshire', 'info@bedfordshirefa.com'),
    ('Berks & Bucks', 'info@berksbucksfa.com'),
    ('Birmingham', 'info@birminghamfa.com'),
    ('Cheshire', 'info@cheshirefa.com'),
    ('Cornwall', 'info@cornwallfa.com'),
    ('Cumberland', 'info@cumberlandfa.com'),
    ('Derbyshire', 'info@derbyshirefa.com'),
    ('Devon', 'info@devonfa.com'),
    ('Dorset', 'info@dorsetfa.com'),
    ('Durham', 'info@durhamfa.com'),
    ('East Riding', 'info@eastridingfa.com'),
    ('Essex', 'info@essexfa.com'),
    ('Gloucestershire', 'info@gloucestershirefa.com'),
    ('Hampshire', 'info@hampshirefa.com'),
    ('Herefordshire', 'info@herefordshirefa.com'),
    ('Hertfordshire', 'info@hertfordshirefa.com'),
    ('Huntingdonshire', 'info@huntingdonshirefa.com'),
    ('Kent', 'info@kentfa.com'),
    ('Lancashire', 'info@lancashirefa.com'),
    ('Leicestershire & Rutland', 'info@leicestershirefa.com'),
    ('Lincolnshire', 'info@lincolnshirefa.com'),
    ('Liverpool', 'info@liverpoolfa.com'),
    ('London', 'info@londonfa.com'),
    ('Manchester', 'info@manchesterfa.com'),
    ('Middlesex', 'info@middlesexfa.com'),
    ('Norfolk', 'info@norfolkfa.com'),
    ('North Riding', 'info@northridingfa.com'),
    ('Northamptonshire', 'info@northamptonshirefa.com'),
    ('Northumberland', 'info@northumberlandfa.com'),
    ('Nottinghamshire', 'info@nottinghamshirefa.com'),
    ('Oxfordshire', 'info@oxfordshirefa.com'),
    ('Sheffield & Hallamshire', 'info@sheffieldfa.com'),
    ('Shropshire', 'info@shropshirefa.com'),
    ('Somerset', 'info@somersetfa.com'),
    ('Staffordshire', 'info@staffordshirefa.com'),
    ('Suffolk', 'info@suffolkfa.com'),
    ('Surrey', 'info@surreyfa.com'),
    ('Sussex', 'info@sussexfa.com'),
    ('Westmorland', 'info@westmorlandfa.com'),
    ('West Riding', 'info@westridingfa.com'),
    ('Wiltshire', 'info@wiltshirefa.com'),
    ('Worcestershire', 'info@worcestershirefa.com');
