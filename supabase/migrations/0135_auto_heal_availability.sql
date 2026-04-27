-- ============================================================================
-- Migration 0135: Auto-heal referee availability
--
-- Problem: Referees set date/weekly availability slots but the master
-- `is_available` toggle on `referee_profiles` stays false by default,
-- silently making them invisible to coach search. Also fixes any row
-- where central_venue_opt_in / is_available / referee_profiles itself
-- got into an inconsistent state.
--
-- Fixes:
--   1. Backfill: any referee with existing slots is marked available.
--   2. Trigger: inserting an availability slot auto-flips is_available=true.
--   3. Ensure every referee has a referee_profiles row.
-- ============================================================================

-- 1. Ensure every user with role='referee' has a referee_profiles row.
--    Without this row, the coach search returns zero results for them.
INSERT INTO public.referee_profiles (profile_id)
SELECT p.id
FROM public.profiles p
LEFT JOIN public.referee_profiles rp ON rp.profile_id = p.id
WHERE p.role = 'referee'
  AND rp.profile_id IS NULL;

-- 2. Flip the column default so new referees are findable by default.
--    Previous default (false) caused the "I set everything but nothing shows"
--    footgun. Refs who want to pause can still toggle off.
ALTER TABLE public.referee_profiles
  ALTER COLUMN is_available SET DEFAULT true;

-- 3. Backfill: flip every existing false → true. The old default meant the
--    flag was almost always false by accident, not by intent. Refs who
--    genuinely want to pause can toggle off (now with red styling + confirm).
UPDATE public.referee_profiles
SET is_available = true,
    updated_at = NOW()
WHERE is_available = false;

-- 4. Trigger: inserting a slot auto-marks referee as available.
--    Prevents the "I set slots but I'm still invisible" footgun.
CREATE OR REPLACE FUNCTION public.auto_mark_available_on_slot_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.referee_profiles
  SET is_available = true,
      updated_at = NOW()
  WHERE profile_id = NEW.referee_id
    AND is_available = false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_date_avail_auto_available ON public.referee_date_availability;
CREATE TRIGGER trg_date_avail_auto_available
  AFTER INSERT ON public.referee_date_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_mark_available_on_slot_insert();

DROP TRIGGER IF EXISTS trg_weekly_avail_auto_available ON public.referee_availability;
CREATE TRIGGER trg_weekly_avail_auto_available
  AFTER INSERT ON public.referee_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_mark_available_on_slot_insert();
