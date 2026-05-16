-- ============================================================================
-- Migration 0156: Referee DOB + parental consent
-- Date: 2026-05-16
--
-- Safeguarding for the FA trial. Adds date of birth capture and a parental
-- consent workflow for under-16 referees (ages 14-15; minimum referee age is
-- 14 — enforced in app validation). Under-16 accounts are LOCKED
-- (parental_consent_status='awaiting') until a parent/guardian approves via a
-- one-click email link, mirroring the existing FA verification token pattern
-- (0112/0124 + /api/fa-verify).
--
-- Gate column lives on referee_profiles (same shape as dbs_status /
-- fa_verification_status) so searchRefereesForBooking stays a single-table
-- filter with no extra join.
-- ============================================================================

-- 1. Date of birth on profiles (every role has one; only referees gate on it).
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS date_of_birth date;

-- 2. Parental consent gate column on referee_profiles.
ALTER TABLE public.referee_profiles
    ADD COLUMN IF NOT EXISTS parental_consent_status text NOT NULL DEFAULT 'not_required'
        CHECK (parental_consent_status IN ('not_required', 'awaiting', 'verified', 'rejected'));

-- 3. Parental consent queue / audit table (token-driven, like
--    fa_verification_requests).
CREATE TABLE IF NOT EXISTS public.parental_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'awaiting'
        CHECK (status IN ('awaiting', 'verified', 'rejected')),
    response_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    parent_email TEXT NOT NULL,
    parent_name TEXT,
    child_name TEXT NOT NULL,
    child_dob date NOT NULL,
    notes TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_parental_consent_referee UNIQUE (referee_id)
);

CREATE INDEX IF NOT EXISTS idx_parental_consents_referee ON public.parental_consents(referee_id);
CREATE INDEX IF NOT EXISTS idx_parental_consents_token ON public.parental_consents(response_token);

-- 4. RLS — mirrors fa_verification_requests (0112). The /api/parent-consent
--    route and signUp use the service-role admin client, which bypasses RLS;
--    these policies cover the in-app (authenticated) read paths.
ALTER TABLE public.parental_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all parental consents"
    ON public.parental_consents FOR SELECT
    USING (is_admin(auth.uid()));

CREATE POLICY "Referees can view own parental consent"
    ON public.parental_consents FOR SELECT
    USING (auth.uid() = referee_id);

CREATE POLICY "Admins can insert parental consents"
    ON public.parental_consents FOR INSERT
    WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update parental consents"
    ON public.parental_consents FOR UPDATE
    USING (is_admin(auth.uid()));

-- 5. Recreate handle_new_user to also copy date_of_birth from auth metadata.
--    NOTE: search_path is pinned to `public, pg_temp` to stay consistent with
--    the 0155 security-advisor hardening (a CREATE OR REPLACE without this
--    would regress lint 0011 for this SECURITY DEFINER function).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

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

        -- Under-16 referee: lock the account (parental_consent_status =
        -- 'awaiting') and create the consent row ATOMICALLY here, so the lock
        -- is guaranteed regardless of which JS signup branch runs (incl. the
        -- email-confirmation early return). The email itself is sent best-effort
        -- from JS using this row's response_token.
        IF dob_val IS NOT NULL
           AND COALESCE(NEW.raw_user_meta_data->>'parent_email', '') <> ''
           AND date_part('year', age(dob_val)) < 16 THEN

            UPDATE public.referee_profiles
            SET parental_consent_status = 'awaiting'
            WHERE profile_id = NEW.id;

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

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user trigger error for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON public.profiles TO supabase_auth_admin;
GRANT ALL ON public.referee_profiles TO supabase_auth_admin;

-- Keep anon/PUBLIC off the recreated SECDEF function (0155 invariant).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, PUBLIC;
