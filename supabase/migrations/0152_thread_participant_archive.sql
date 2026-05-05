-- ============================================================================
-- Migration 0152: Per-user thread archive
--
-- Adds an archived_at column to thread_participants so each participant can
-- archive their copy of a thread independently. Mirrors the per-user booking
-- archive pattern from 0149: archiving on one side does not affect the other
-- side's view.
--
--   thread_participants.archived_at    — viewer has archived this thread
--
-- Existing RLS already lets a participant UPDATE their own thread_participants
-- row (used for last_read_at) — no policy change needed.
-- ============================================================================

ALTER TABLE thread_participants
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Partial indexes for the two hot paths: "list my active threads" (default
-- view) and "list my archived threads" (the recovery tray). Partial because
-- the inverse predicate is the common case for each.
CREATE INDEX IF NOT EXISTS idx_thread_participants_active
    ON thread_participants (profile_id, thread_id)
    WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_thread_participants_archived
    ON thread_participants (profile_id, thread_id)
    WHERE archived_at IS NOT NULL;
