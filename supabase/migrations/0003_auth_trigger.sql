-- ============================================
-- WHISTLE CONNECT - AUTO-CREATE PROFILE TRIGGER
-- Run this AFTER 0001_reset_schema.sql
-- ============================================

-- This trigger automatically creates a profile when a new user signs up
-- It solves the foreign key constraint issue

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'coach')::user_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  -- If the user is a referee, create referee_profile too
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'coach') = 'referee' THEN
    INSERT INTO public.referee_profiles (profile_id)
    VALUES (NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON public.profiles TO supabase_auth_admin;
GRANT ALL ON public.referee_profiles TO supabase_auth_admin;
