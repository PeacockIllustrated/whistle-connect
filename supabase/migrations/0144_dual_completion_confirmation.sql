-- ============================================================================
-- Migration 0144: Dual-confirmation gating for escrow release
-- Date: 2026-04-30
--
-- Phase 2 of the payments work. Today the "Mark as Completed" button is
-- cosmetic — either party can flip booking.status='completed' alone, and
-- the escrow-release cron releases at kickoff+24h regardless of who
-- (if anyone) clicked it.
--
-- This migration is the schema half of the fix. The cron route + the
-- completeBooking server action are updated in follow-up commits.
--
-- New shape:
--   - bookings gains coach_marked_complete_at, referee_marked_complete_at
--   - bookings gains both_confirmed_at — a single column the cron can
--     gate on, set the moment the second party marks
--   - new RPC mark_booking_complete(p_booking_id) that:
--     * identifies the caller as coach or assigned-referee via auth.uid()
--     * sets the relevant timestamp
--     * if the OTHER side is already set, also sets both_confirmed_at
--       and flips status to 'completed' in the same transaction
--
-- Additive only — old completeBooking still works against the new schema
-- (the columns are nullable). Rollback is risk-free.
-- ============================================================================

-- 1. New columns
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS coach_marked_complete_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS referee_marked_complete_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS both_confirmed_at             TIMESTAMPTZ;

-- Cron's two queries scan small slices of the table; this index covers both.
-- Partial index keeps it cheap — only rows still pending payment release.
CREATE INDEX IF NOT EXISTS idx_bookings_release_gate
    ON bookings (both_confirmed_at, status)
    WHERE escrow_amount_pence IS NOT NULL
      AND escrow_released_at IS NULL;

-- ----------------------------------------------------------------------------
-- 2. mark_booking_complete RPC
--
-- Returns json:
--   { success: true, your_role: 'coach'|'referee', both_confirmed: bool,
--     waiting_for: 'coach'|'referee'|null }
-- or
--   { error: '<reason>' }
--
-- Errors:
--   - "Booking not found"
--   - "Unauthorized" (caller is neither the coach nor the assigned ref)
--   - "Match has not started yet" (kickoff in the future)
--   - "Booking is in status X — only confirmed bookings can be marked complete"
--   - "Resolve the open dispute before marking complete"
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_booking_complete(p_booking_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_booking          bookings%ROWTYPE;
    v_caller           UUID := auth.uid();
    v_is_coach         BOOLEAN := FALSE;
    v_is_assigned_ref  BOOLEAN := FALSE;
    v_role             TEXT;
    v_kickoff          TIMESTAMPTZ;
    v_other_marked_at  TIMESTAMPTZ;
    v_now              TIMESTAMPTZ := NOW();
    v_both_done        BOOLEAN := FALSE;
BEGIN
    -- Lock the booking row for the duration of this transaction so a
    -- simultaneous click from the other party can't race.
    SELECT * INTO v_booking
    FROM bookings
    WHERE id = p_booking_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Booking not found');
    END IF;

    IF v_caller IS NULL THEN
        RETURN json_build_object('error', 'Unauthorized');
    END IF;

    -- Identify role
    v_is_coach := v_booking.coach_id = v_caller;

    SELECT EXISTS (
        SELECT 1 FROM booking_assignments
        WHERE booking_id = p_booking_id
          AND referee_id = v_caller
    ) INTO v_is_assigned_ref;

    IF NOT (v_is_coach OR v_is_assigned_ref) THEN
        RETURN json_build_object('error', 'Unauthorized');
    END IF;

    v_role := CASE WHEN v_is_coach THEN 'coach' ELSE 'referee' END;

    -- Status gate: only 'confirmed' bookings can be marked.
    -- ('completed' = already both confirmed, no-op below; 'cancelled' = nothing to do)
    IF v_booking.status NOT IN ('confirmed', 'completed') THEN
        RETURN json_build_object(
            'error',
            'Booking is in status ' || v_booking.status || ' — only confirmed bookings can be marked complete'
        );
    END IF;

    -- Kickoff must have passed
    v_kickoff := (v_booking.match_date::TEXT || 'T' || v_booking.kickoff_time::TEXT)::TIMESTAMPTZ;
    IF v_now <= v_kickoff THEN
        RETURN json_build_object('error', 'The match has not started yet');
    END IF;

    -- Open dispute blocks marking
    IF EXISTS (
        SELECT 1 FROM disputes
        WHERE booking_id = p_booking_id
          AND status = 'open'
    ) THEN
        RETURN json_build_object('error', 'Resolve the open dispute before marking complete');
    END IF;

    -- Idempotent: if THIS caller has already marked, return their state.
    IF v_is_coach AND v_booking.coach_marked_complete_at IS NOT NULL THEN
        RETURN json_build_object(
            'success',         TRUE,
            'your_role',       v_role,
            'already_marked',  TRUE,
            'both_confirmed',  v_booking.both_confirmed_at IS NOT NULL,
            'waiting_for',     CASE
                WHEN v_booking.both_confirmed_at IS NOT NULL THEN NULL
                ELSE 'referee'
            END
        );
    END IF;

    IF v_is_assigned_ref AND v_booking.referee_marked_complete_at IS NOT NULL THEN
        RETURN json_build_object(
            'success',         TRUE,
            'your_role',       v_role,
            'already_marked',  TRUE,
            'both_confirmed',  v_booking.both_confirmed_at IS NOT NULL,
            'waiting_for',     CASE
                WHEN v_booking.both_confirmed_at IS NOT NULL THEN NULL
                ELSE 'coach'
            END
        );
    END IF;

    -- Determine whether the OTHER side has already marked
    v_other_marked_at := CASE
        WHEN v_is_coach THEN v_booking.referee_marked_complete_at
        ELSE v_booking.coach_marked_complete_at
    END;

    v_both_done := v_other_marked_at IS NOT NULL;

    -- Apply the mark
    IF v_is_coach THEN
        UPDATE bookings
        SET coach_marked_complete_at = v_now,
            both_confirmed_at        = CASE WHEN v_both_done THEN v_now ELSE both_confirmed_at END,
            status                   = CASE WHEN v_both_done THEN 'completed' ELSE status END
        WHERE id = p_booking_id;
    ELSE
        UPDATE bookings
        SET referee_marked_complete_at = v_now,
            both_confirmed_at          = CASE WHEN v_both_done THEN v_now ELSE both_confirmed_at END,
            status                     = CASE WHEN v_both_done THEN 'completed' ELSE status END
        WHERE id = p_booking_id;
    END IF;

    RETURN json_build_object(
        'success',         TRUE,
        'your_role',       v_role,
        'already_marked',  FALSE,
        'both_confirmed',  v_both_done,
        'waiting_for',     CASE
            WHEN v_both_done THEN NULL
            WHEN v_is_coach THEN 'referee'
            ELSE 'coach'
        END
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_booking_complete(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_booking_complete(UUID) TO authenticated;
