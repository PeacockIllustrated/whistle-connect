-- ============================================================================
-- Migration 0175: retire the legacy badges system
-- Date: 2026-06-14
--
-- The original `badges` / `user_badges` tables (defined in 0001) were an
-- XP-based badge catalogue that was never wired up: 0 rows in user_badges, no
-- awarding logic, no UI. The live Achievements feature (src/lib/achievements.ts)
-- computes tiered progression from existing data and does NOT use these tables,
-- so they are safe to drop. The aborted 0174_badges.sql (which assumed a
-- different schema and conflicted with these) has been removed from the repo.
--
-- Worth-keeping ideas from the old catalogue (XP/levels, Quick Responder, Five
-- Star) are folded into the Achievements feature directly.
-- ============================================================================

DROP TABLE IF EXISTS public.user_badges CASCADE;
DROP TABLE IF EXISTS public.badges CASCADE;
