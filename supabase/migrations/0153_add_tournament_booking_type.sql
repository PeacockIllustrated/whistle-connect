-- ============================================================================
-- Migration 0153: Add 'tournament' to booking_type_enum
--
-- The booking_type column was created in 0106 as a Postgres ENUM with two
-- values: 'individual' and 'central'. The new pre-meeting amends introduce
-- a third booking type ('tournament') that reuses the central-venue form
-- with different copy and a slightly different downstream rendering.
--
-- ALTER TYPE ... ADD VALUE IF NOT EXISTS is forward-compatible (Postgres 12+
-- can run it transactionally; we're on 17). Existing rows are unaffected
-- and existing enum consumers (Zod, TypeScript) are widened in the
-- accompanying code change.
-- ============================================================================

ALTER TYPE public.booking_type_enum ADD VALUE IF NOT EXISTS 'tournament';
