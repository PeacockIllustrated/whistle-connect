-- ============================================================================
-- Seed: Test Accounts for FA Trial
--
-- Creates 3 test users (coach, referee, admin) with full profiles,
-- wallets, and availability so you can immediately test all flows.
--
-- Run ONCE in Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- If you need to re-run, first run cleanup_test_accounts.sql and
-- delete the auth users from Authentication → Users in the dashboard.
--
-- Credentials:
--   Coach:   test-coach@whistle-test.local   / TestPassword123!
--   Referee: test-referee@whistle-test.local  / TestPassword123!
--   Admin:   test-admin@whistle-test.local    / TestPassword123!
-- ============================================================================

-- ── 1. Create auth users ────────────────────────────────────────────
-- Uses Supabase's admin auth function to create confirmed users.

-- Coach
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, confirmation_token
)
SELECT
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'test-coach@whistle-test.local',
    crypt('TestPassword123!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Test Coach"}'::jsonb,
    ''
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'test-coach@whistle-test.local'
);

-- Also create identity record for email auth
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT
    gen_random_uuid(),
    u.id,
    jsonb_build_object('sub', u.id::text, 'email', u.email),
    'email',
    u.id::text,
    now(), now(), now()
FROM auth.users u
WHERE u.email = 'test-coach@whistle-test.local'
AND NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE provider_id = u.id::text AND provider = 'email'
);

-- Referee
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, confirmation_token
)
SELECT
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'test-referee@whistle-test.local',
    crypt('TestPassword123!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Test Referee"}'::jsonb,
    ''
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'test-referee@whistle-test.local'
);

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT
    gen_random_uuid(),
    u.id,
    jsonb_build_object('sub', u.id::text, 'email', u.email),
    'email',
    u.id::text,
    now(), now(), now()
FROM auth.users u
WHERE u.email = 'test-referee@whistle-test.local'
AND NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE provider_id = u.id::text AND provider = 'email'
);

-- Admin
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, confirmation_token
)
SELECT
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'test-admin@whistle-test.local',
    crypt('TestPassword123!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Test Admin"}'::jsonb,
    ''
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'test-admin@whistle-test.local'
);

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT
    gen_random_uuid(),
    u.id,
    jsonb_build_object('sub', u.id::text, 'email', u.email),
    'email',
    u.id::text,
    now(), now(), now()
FROM auth.users u
WHERE u.email = 'test-admin@whistle-test.local'
AND NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE provider_id = u.id::text AND provider = 'email'
);

-- ── 2. Create profiles ──────────────────────────────────────────────

INSERT INTO profiles (id, role, full_name, phone, postcode)
SELECT u.id, 'coach', 'Test Coach', '07700000001', 'LS1 1BA'
FROM auth.users u WHERE u.email = 'test-coach@whistle-test.local'
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, role, full_name, phone, postcode)
SELECT u.id, 'referee', 'Test Referee', '07700000002', 'LS2 7HY'
FROM auth.users u WHERE u.email = 'test-referee@whistle-test.local'
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, role, full_name, phone, postcode)
SELECT u.id, 'admin', 'Test Admin', '07700000003', 'LS1 5DL'
FROM auth.users u WHERE u.email = 'test-admin@whistle-test.local'
ON CONFLICT (id) DO NOTHING;

-- ── 3. Create referee profile ───────────────────────────────────────

INSERT INTO referee_profiles (
    profile_id, fa_id, level, county,
    dbs_status, verified, is_available,
    fa_verification_status, travel_radius_km
)
SELECT
    u.id,
    '12345678',
    '7',
    'Yorkshire',
    'verified',
    true,
    true,
    'verified',
    30
FROM auth.users u WHERE u.email = 'test-referee@whistle-test.local'
ON CONFLICT (profile_id) DO UPDATE SET
    dbs_status = 'verified',
    verified = true,
    is_available = true,
    fa_verification_status = 'verified',
    travel_radius_km = 30;

-- ── 4. Create wallets ───────────────────────────────────────────────
-- Coach gets £100 for testing, referee gets £0 (they earn from bookings)

INSERT INTO wallets (user_id, balance_pence, escrow_pence)
SELECT u.id, 10000, 0
FROM auth.users u WHERE u.email = 'test-coach@whistle-test.local'
ON CONFLICT (user_id) DO UPDATE SET balance_pence = 10000, escrow_pence = 0;

INSERT INTO wallets (user_id, balance_pence, escrow_pence)
SELECT u.id, 0, 0
FROM auth.users u WHERE u.email = 'test-referee@whistle-test.local'
ON CONFLICT (user_id) DO UPDATE SET balance_pence = 0, escrow_pence = 0;

INSERT INTO wallets (user_id, balance_pence, escrow_pence)
SELECT u.id, 0, 0
FROM auth.users u WHERE u.email = 'test-admin@whistle-test.local'
ON CONFLICT (user_id) DO UPDATE SET balance_pence = 0, escrow_pence = 0;

-- ── 5. Set referee availability ─────────────────────────────────────
-- Available every Saturday and Sunday 9am-6pm (typical grassroots schedule)

INSERT INTO referee_availability (referee_id, day_of_week, start_time, end_time)
SELECT u.id, 6, '09:00:00', '18:00:00' -- Saturday
FROM auth.users u WHERE u.email = 'test-referee@whistle-test.local'
ON CONFLICT DO NOTHING;

INSERT INTO referee_availability (referee_id, day_of_week, start_time, end_time)
SELECT u.id, 0, '09:00:00', '18:00:00' -- Sunday
FROM auth.users u WHERE u.email = 'test-referee@whistle-test.local'
ON CONFLICT DO NOTHING;

-- Also set a weekday evening slot (Wednesday 6-9pm) for midweek testing
INSERT INTO referee_availability (referee_id, day_of_week, start_time, end_time)
SELECT u.id, 3, '18:00:00', '21:00:00' -- Wednesday
FROM auth.users u WHERE u.email = 'test-referee@whistle-test.local'
ON CONFLICT DO NOTHING;

-- ── 6. Geocode profiles (approximate Leeds coordinates) ─────────────
-- So spatial search works for the test referee

UPDATE profiles SET
    latitude = 53.7997,
    longitude = -1.5492
WHERE id = (SELECT id FROM auth.users WHERE email = 'test-coach@whistle-test.local');

UPDATE profiles SET
    latitude = 53.7937,
    longitude = -1.5350
WHERE id = (SELECT id FROM auth.users WHERE email = 'test-referee@whistle-test.local');

UPDATE profiles SET
    latitude = 53.7965,
    longitude = -1.5478
WHERE id = (SELECT id FROM auth.users WHERE email = 'test-admin@whistle-test.local');

-- Set geography column if it exists
DO $$
BEGIN
    UPDATE profiles SET location = ST_SetSRID(ST_MakePoint(-1.5492, 53.7997), 4326)::geography
    WHERE id = (SELECT id FROM auth.users WHERE email = 'test-coach@whistle-test.local');

    UPDATE profiles SET location = ST_SetSRID(ST_MakePoint(-1.5350, 53.7937), 4326)::geography
    WHERE id = (SELECT id FROM auth.users WHERE email = 'test-referee@whistle-test.local');

    UPDATE profiles SET location = ST_SetSRID(ST_MakePoint(-1.5478, 53.7965), 4326)::geography
    WHERE id = (SELECT id FROM auth.users WHERE email = 'test-admin@whistle-test.local');
EXCEPTION WHEN undefined_column THEN
    -- location column doesn't exist yet, skip
    NULL;
END $$;

-- ── Done! ───────────────────────────────────────────────────────────
-- You can now log in with:
--   Coach:   test-coach@whistle-test.local   / TestPassword123!
--   Referee: test-referee@whistle-test.local  / TestPassword123!
--   Admin:   test-admin@whistle-test.local    / TestPassword123!
--
-- The coach has £100 in their wallet.
-- The referee is verified (FA + DBS), available Sat/Sun/Wed, in Yorkshire.
-- The admin can access /app/admin/* pages.
