-- ============================================================================
-- Migration 0142: webhook_events log for handler idempotency
-- Date: 2026-04-29
--
-- Stripe webhooks can be re-delivered (network blip, dashboard "Resend"
-- button, retry policy on a 5xx). Without idempotency at the handler level,
-- re-delivery causes:
--   - account.updated double-toggling stripe_connect_onboarded
--   - transfer.reversed spamming admin notifications
--
-- The top-up handler already has business-key idempotency on
-- stripe_session_id (checked in wallet_top_up RPC). This table adds a
-- generic defence-in-depth layer keyed on the Stripe event id — every
-- handler does INSERT ... ON CONFLICT DO NOTHING; if 0 rows affected,
-- the event has already been processed and the handler returns 200
-- immediately without doing the work.
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_events (
    id            TEXT PRIMARY KEY,                     -- Stripe event.id (evt_*)
    type          TEXT NOT NULL,                        -- e.g. 'checkout.session.completed'
    received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at  TIMESTAMPTZ,
    error         TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at
    ON webhook_events (received_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed
    ON webhook_events (received_at)
    WHERE processed_at IS NULL;

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; no policies needed for the webhook handler
-- itself (it always uses the service role / admin client). Add a SELECT
-- policy for admins so they can review the log via an admin UI later.
CREATE POLICY "Admins can view webhook_events"
    ON webhook_events FOR SELECT
    USING (public.is_admin(auth.uid()));
