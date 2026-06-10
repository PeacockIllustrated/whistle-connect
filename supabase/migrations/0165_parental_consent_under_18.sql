-- ============================================================================
-- Migration 0165: Parental consent threshold 16 -> 18 + persist FA number
-- Date: 2026-06-10
--
-- Recreates handle_new_user for two related fixes:
--
-- (1) Parental-consent threshold 16 -> 18 (safeguarding). Terms (§2/§5) and
--     Privacy (§5) state referees under 18 (ages 14–17) require verified
--     parent/guardian consent before the account can be used, and have in-app
--     messaging disabled. The implementation previously gated at under-16.
--     Minimum registration age stays 14.
--
-- (2) Persist the FA number at signup (item 3). The trigger now copies
--     fa_number from the signup metadata into referee_profiles.fa_id (+ sets
--     fa_verification_status='pending'), guarded so a constraint violation
--     can't orphan the account. Previously fa_id was only set on the rare JS
--     fallback path where the trigger failed, so a referee's FA number was
--     dropped in the normal flow. (signUp now also passes fa_number AND
--     parent_email in auth metadata so this + the consent row have data to act
--     on — the consent-row branch below already reads parent_email.)
--
-- This is the path-independent lock: it must stay in the trigger so the
-- email-confirmation JS signup branch (which early-returns before the app-side
-- consent code) cannot bypass it. The only change from 0161 is the age
-- threshold (16 -> 18); the FAIL-CLOSED behaviour (NULL DOB locks), the
-- consent-row creation (only when DOB + parent_email present), the swallow-all
-- EXCEPTION handler, the pinned search_path and the anon/PUBLIC revoke are all
-- preserved exactly.
--
-- App-layer matching gate: src/lib/constants.ts PARENTAL_CONSENT_AGE = 18
-- (drives requiresParentalConsent + the in-app messaging block + the signup
-- parent-email requirement).
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

-- CREATE OR REPLACE preserves the existing on_auth_user_created trigger
-- (signature unchanged), so it does not need to be re-attached.

-- Keep anon/PUBLIC off the recreated SECDEF function (0155 invariant).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, PUBLIC;
