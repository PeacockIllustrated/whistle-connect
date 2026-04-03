-- ============================================================================
-- Migration 0130: Add 8v8 to match_format enum
--
-- The application supports 8v8 format (src/lib/types.ts, constants.ts,
-- validation.ts) but the PostgreSQL enum was never updated.
-- Any booking created with format='8v8' would fail at the DB constraint.
-- ============================================================================

ALTER TYPE match_format ADD VALUE IF NOT EXISTS '8v8';
