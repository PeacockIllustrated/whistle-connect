-- ============================================================================
-- Migration 0145: structured dispute fields
-- Date: 2026-04-30
--
-- The previous dispute form was a single browser prompt() with a 10-char
-- minimum — admins resolving a dispute had basically no information to
-- act on. This migration adds three structured fields so admins know:
--   1. WHAT happened (category)
--   2. WHEN (optional incident timestamp)
--   3. WHAT the user wants done (desired_outcome)
--
-- The free-text `reason` field is kept and its minimum length is bumped
-- to 50 chars in app-side validation. All new columns are nullable so
-- existing dispute rows from before this migration remain valid.
-- ============================================================================

ALTER TABLE disputes
    ADD COLUMN IF NOT EXISTS category         TEXT,
    ADD COLUMN IF NOT EXISTS desired_outcome  TEXT,
    ADD COLUMN IF NOT EXISTS incident_at      TIMESTAMPTZ;

-- Constrain category values. Use CHECK constraint with NULL-tolerant clause
-- so legacy rows (category IS NULL) don't violate the constraint.
ALTER TABLE disputes
    DROP CONSTRAINT IF EXISTS disputes_category_check;

ALTER TABLE disputes
    ADD CONSTRAINT disputes_category_check
    CHECK (category IS NULL OR category IN (
        'match_did_not_happen',
        'referee_no_show',
        'coach_no_show',
        'fee_dispute',
        'conduct_issue',
        'service_quality',
        'safety_concern',
        'other'
    ));

ALTER TABLE disputes
    DROP CONSTRAINT IF EXISTS disputes_desired_outcome_check;

ALTER TABLE disputes
    ADD CONSTRAINT disputes_desired_outcome_check
    CHECK (desired_outcome IS NULL OR desired_outcome IN (
        'refund_full',
        'refund_partial',
        'release_full',
        'mediation'
    ));

CREATE INDEX IF NOT EXISTS idx_disputes_category
    ON disputes (category)
    WHERE status = 'open';
