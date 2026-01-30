-- ============================================
-- WHISTLE CONNECT - FIX AUTH TRIGGER
-- This fixes the handle_new_user trigger to be more robust
-- ============================================

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Recreate the function with better error handling
-- SECURITY DEFINER ensures this runs with the privileges of the function owner (postgres)
-- which bypasses RLS policies
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_role_val user_role;
    role_text TEXT;
BEGIN
    -- Get role from metadata, default to 'coach'
    role_text := COALESCE(NEW.raw_user_meta_data->>'role', 'coach');

    -- Validate role is a valid enum value
    IF role_text NOT IN ('coach', 'referee', 'admin') THEN
        role_text := 'coach';
    END IF;

    user_role_val := role_text::user_role;

    -- Insert profile - SECURITY DEFINER bypasses RLS
    INSERT INTO public.profiles (id, role, full_name, phone, postcode)
    VALUES (
        NEW.id,
        user_role_val,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'postcode'
    )
    ON CONFLICT (id) DO NOTHING;

    -- If referee, also create referee_profile
    IF user_role_val = 'referee' THEN
        INSERT INTO public.referee_profiles (profile_id)
        VALUES (NEW.id)
        ON CONFLICT (profile_id) DO NOTHING;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the entire signup
    RAISE WARNING 'handle_new_user trigger error for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Ensure proper permissions
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON public.profiles TO supabase_auth_admin;
GRANT ALL ON public.referee_profiles TO supabase_auth_admin;
