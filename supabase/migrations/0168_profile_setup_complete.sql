-- ============================================================================
-- Migration 0168: profiles.setup_complete + generic (deferred-role) signup
-- Date: 2026-06-11
--
-- Enables the World Cup sweepstake growth funnel: a user can create an account
-- WITHOUT choosing coach/referee (a "generic" signup), use the free sweepstake
-- tool, and be nudged to "finish setting up their account" the first time they
-- open the main Whistle Connect app.
--
-- Mechanism (deliberately additive + low-risk during the FA trial):
--   * profiles.setup_complete boolean, DEFAULT true. Every EXISTING row and
--     every normal coach/referee signup is true → the main app is unaffected.
--   * A generic signup passes setup_complete=false in auth metadata. The app
--     gate (src/app/app/layout.tsx) redirects setup_complete=false users to
--     /app/welcome before they can reach any role-specific page.
--   * role stays NOT NULL — generic signups get the existing 'coach' placeholder
--     (the trigger already defaults unknown/missing roles to 'coach'). The
--     finish-setup flow overwrites role and, for referees, creates
--     referee_profiles + runs the SAME under-18 parental-consent gate. The gate
--     MOVES to finish-setup; it never disappears.
--
-- This migration ONLY recreates handle_new_user to persist setup_complete on the
-- profile INSERT. Every safeguarding invariant from 0165 is preserved verbatim:
-- the fail-closed under-18 lock (NULL/under-18 DOB ⇒ 'awaiting'), fa_id
-- persistence, the swallow-all EXCEPTION handler, the pinned search_path, and
-- the anon/PUBLIC revoke. The ONLY additions are: a defensively-parsed
-- setup_complete_val and the extra column on the INSERT.
--
-- NOTE: a generic signup never passes role='referee' (the role-less form has no
-- DOB/parent-email fields), so the under-18 branch below is unreachable from the
-- generic path. The referee consent gate is enforced later at finish-setup when
-- the user actively chooses the referee role and supplies a DOB.
-- ============================================================================

-- 1. setup_complete flag. DEFAULT true → existing users + normal signups are
--    already "complete"; only the generic World Cup signup opts into false.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS setup_complete boolean NOT NULL DEFAULT true;

-- 2. Recreate handle_new_user. CREATE OR REPLACE keeps the existing
--    on_auth_user_created trigger attached (signature unchanged).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    user_role_val user_role;
    role_text TEXT;
    dob_text TEXT;
    dob_val date;
    setup_complete_val boolean := true;
BEGIN
    role_text := COALESCE(NEW.raw_user_meta_data->>'role', 'coach');

    IF role_text NOT IN ('coach', 'referee', 'admin') THEN
        role_text := 'coach';
    END IF;

    user_role_val := role_text::user_role;

    -- Parse optional date_of_birth (YYYY-MM-DD) defensively.
    dob_text := NEW.raw_user_meta_data->>'date_of_birth';
    IF dob_text IS NOT NULL AND dob_text <> '' THEN
        BEGIN
            dob_val := dob_text::date;
        EXCEPTION WHEN OTHERS THEN
            dob_val := NULL;
        END;
    END IF;

    -- Parse optional setup_complete (generic signups pass 'false'). Defensive:
    -- any parse failure / absent key falls back to true so a normal signup can
    -- never be accidentally left in the finish-setup limbo.
    IF NEW.raw_user_meta_data ? 'setup_complete' THEN
        BEGIN
            setup_complete_val := (NEW.raw_user_meta_data->>'setup_complete')::boolean;
        EXCEPTION WHEN OTHERS THEN
            setup_complete_val := true;
        END;
    END IF;

    INSERT INTO public.profiles (id, role, full_name, phone, postcode, date_of_birth, setup_complete)
    VALUES (
        NEW.id,
        user_role_val,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'postcode',
        dob_val,
        setup_complete_val
    )
    ON CONFLICT (id) DO NOTHING;

    IF user_role_val = 'referee' THEN
        INSERT INTO public.referee_profiles (profile_id)
        VALUES (NEW.id)
        ON CONFLICT (profile_id) DO NOTHING;

        -- Persist the FA number captured at signup (item 3 — drives admin
        -- verification). Guarded in its own sub-block: a UNIQUE/CHECK violation
        -- on fa_id must NOT roll back account creation (the function-level
        -- handler would otherwise orphan the auth row). The app pre-validates
        -- format + uniqueness so this normally succeeds; on the rare conflict
        -- the referee can re-enter it from their profile.
        IF COALESCE(NEW.raw_user_meta_data->>'fa_number', '') <> '' THEN
            BEGIN
                UPDATE public.referee_profiles
                SET fa_id = NEW.raw_user_meta_data->>'fa_number',
                    fa_verification_status = 'pending'::fa_verification_status
                WHERE profile_id = NEW.id;
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'handle_new_user: could not set fa_id for %: %', NEW.id, SQLERRM;
            END;
        END IF;

        -- FAIL CLOSED: lock the account (parental_consent_status='awaiting')
        -- when the referee has no DOB on file OR is under 18. The lock is set
        -- here ATOMICALLY so it cannot be bypassed by any JS signup branch
        -- (incl. the email-confirmation early return).
        IF dob_val IS NULL OR date_part('year', age(dob_val)) < 18 THEN

            UPDATE public.referee_profiles
            SET parental_consent_status = 'awaiting'
            WHERE profile_id = NEW.id;

            -- Create the consent row (and thus the approvable token) only when
            -- we actually have a DOB and a parent email to drive the one-click
            -- approval email. A NULL-DOB referee stays locked with no consent
            -- row until an admin / the referee supplies a DOB.
            IF dob_val IS NOT NULL
               AND COALESCE(NEW.raw_user_meta_data->>'parent_email', '') <> '' THEN

                INSERT INTO public.parental_consents
                    (referee_id, parent_email, child_name, child_dob, status)
                VALUES (
                    NEW.id,
                    NEW.raw_user_meta_data->>'parent_email',
                    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
                    dob_val,
                    'awaiting'
                )
                ON CONFLICT (referee_id) DO NOTHING;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user trigger error for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Keep anon/PUBLIC off the recreated SECDEF function (0155 invariant).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, PUBLIC;
