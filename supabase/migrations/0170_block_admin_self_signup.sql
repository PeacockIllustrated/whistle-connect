-- ============================================================================
-- Migration 0170: block admin self-signup (handle_new_user role allowlist)
-- Date: 2026-06-12
--
-- BLOCKER (premortem follow-up to the night-before launch audit).
--
-- Before this migration the handle_new_user trigger's role allowlist included
-- 'admin', so a metadata role of 'admin' was accepted verbatim. Combined with
-- signUpSchema also permitting 'admin', ANYONE could self-register as an admin —
-- either through the server action OR by POSTing directly to the public Supabase
-- auth endpoint with raw_user_meta_data.role = 'admin' — and immediately gain
-- escrow-moving, user-ban and parental-consent-override powers. The zod change
-- in src/lib/validation.ts alone does NOT close this: the raw public auth
-- endpoint never runs zod, only this trigger. Admins must be provisioned
-- out-of-band (direct DB / dashboard), never via signup.
--
-- This migration recreates handle_new_user changing ONLY the role allowlist:
-- 'admin' is dropped, so a metadata role of 'admin' (or anything not in
-- ('coach','referee')) falls back to 'coach'. EVERY other invariant from 0168 is
-- preserved verbatim: setup_complete persistence, the fail-closed under-18
-- consent lock (NULL/under-18 DOB ⇒ 'awaiting'), defensive DOB parsing, fa_id
-- persistence in its own sub-block, the swallow-all EXCEPTION handler, the
-- pinned search_path, and the anon/PUBLIC revoke.
-- ============================================================================

-- Recreate handle_new_user. CREATE OR REPLACE keeps the existing
-- on_auth_user_created trigger attached (signature unchanged).
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

    -- 'admin' is deliberately NOT in this allowlist: admins are provisioned
    -- out-of-band, never via signup. A metadata role of 'admin' (or any
    -- unknown value) falls back to 'coach' so the public auth endpoint cannot
    -- mint an admin account.
    IF role_text NOT IN ('coach', 'referee') THEN
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
