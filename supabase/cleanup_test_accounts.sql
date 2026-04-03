-- ============================================================================
-- OPTIONAL: Clean Up Test Accounts
--
-- Run this MANUALLY in the Supabase SQL Editor to reset test data.
-- This does NOT delete real users — it only removes bookings, offers,
-- assignments, threads, messages, and notifications so you can start fresh.
--
-- ⚠️  DO NOT run this in production with real users.
-- ============================================================================

-- Step 1: Clear all booking-related data (in dependency order)
TRUNCATE booking_assignments CASCADE;
TRUNCATE booking_offers CASCADE;

-- Step 2: Clear all messaging data
TRUNCATE messages CASCADE;
TRUNCATE thread_participants CASCADE;
TRUNCATE threads CASCADE;

-- Step 3: Clear notifications
TRUNCATE notifications CASCADE;

-- Step 4: Clear bookings themselves
TRUNCATE bookings CASCADE;

-- Step 5: Clear wallet transactions (preserving wallets)
TRUNCATE wallet_transactions CASCADE;
-- Reset wallet balances to zero
UPDATE wallets SET balance_pence = 0, escrow_pence = 0;

-- Step 6: Clear FA verification requests
TRUNCATE fa_verification_requests CASCADE;

-- Step 7: Reset all referee profiles to clean state
UPDATE referee_profiles SET
    verified = false,
    fa_verification_status = CASE
        WHEN fa_id IS NOT NULL THEN 'pending'::fa_verification_status
        ELSE 'not_provided'::fa_verification_status
    END,
    reliability_score = 0,
    total_matches_completed = 0,
    average_rating = 0,
    is_available = false;

-- Step 8: Clear availability slots so referees set them fresh
TRUNCATE referee_date_availability CASCADE;
TRUNCATE referee_availability CASCADE;

-- Step 9: Clear ratings
TRUNCATE match_ratings CASCADE;

-- Step 10: Clear disputes
TRUNCATE disputes CASCADE;

-- Done! All transactional data cleared. User accounts and profiles preserved.
-- Referees will need to:
--   1. Toggle "Available" on in their profile
--   2. Set their availability slots
--   3. Re-enter/verify their FA number
-- Coaches can create bookings fresh.
