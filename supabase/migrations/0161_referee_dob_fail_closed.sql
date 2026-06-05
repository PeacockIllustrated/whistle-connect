-- ============================================================================
-- Migration 0161: Referee NULL-DOB fail-closed (safeguarding)
-- Date: 2026-06-05
--
-- Premortem remediation, card 10 (most dangerous). The 0156 trigger only
-- locked an under-16 referee when ALL of (dob present) AND (parent_email
-- present) AND (age < 16) held. That left two holes open:
--   1. A referee with a NULL date_of_birth defaulted to
--      parental_consent_status='not_required' (unlocked) and, because the app
--      age/messaging gates were written `if (dob) { check }`, slipped every
--      safeguarding filter (search, offer, accept, in-app messaging).
--   2. A genuine under-16 who signed up WITHOUT a parent_email was also left
--      unlocked.
--
-- This recreates handle_new_user to FAIL CLOSED: any referee whose DOB is NULL
-- OR who is under 16 is locked (parental_consent_status='awaiting'),
-- regardless of parent_email. The parental_consents row (which drives the
-- one-click approval email) is still only created when both a DOB and a
-- parent_email are present.
--
-- The app-layer helpers requiresParentalConsent / refereeBlockedFromAgeGroup
-- (src/lib/constants.ts) are the matching front-line gate. We deliberately do
-- NOT add a hard-reject NOT-NULL trigger here: handle_new_user has a
-- swallow-all `EXCEPTION WHEN OTHERS` handler, so a RAISE inside the insert
-- path would abort the profile creation and orphan the auth.users row. Locking
-- (not rejecting) is the safe fail-closed behaviour.
--
-- search_path is pinned and anon/PUBLIC EXECUTE is revoked to preserve the
-- 0155 security-advisor invariant for this SECURITY DEFINER function.
-- ============================================================================

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

    INSERT INTO public.profiles (id, role, full_name, phone, postcode, date_of_birth)
    VALUES (
        NEW.id,
        user_role_val,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'postcode',
        dob_val
    )
    ON CONFLICT (id) DO NOTHING;

    IF user_role_val = 'referee' THEN
        INSERT INTO public.referee_profiles (profile_id)
        VALUES (NEW.id)
        ON CONFLICT (profile_id) DO NOTHING;

        -- FAIL CLOSED: lock the account (parental_consent_status='awaiting')
        -- when the referee has no DOB on file OR is under 16. Previously this
        -- only locked when DOB AND parent_email were present AND age < 16, so
        -- a NULL-DOB referee (or an under-16 with no parent_email) stayed
        -- unlocked. The lock is set here ATOMICALLY so it cannot be bypassed by
        -- any JS signup branch (incl. the email-confirmation early return).
        IF dob_val IS NULL OR date_part('year', age(dob_val)) < 16 THEN

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

-- CREATE OR REPLACE preserves the existing on_auth_user_created trigger
-- (signature unchanged), so it does not need to be re-attached.

-- Keep anon/PUBLIC off the recreated SECDEF function (0155 invariant).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, PUBLIC;
