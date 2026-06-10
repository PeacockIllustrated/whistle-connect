-- ============================================================================
-- Migration 0166: admin_audit_log — accountable record of admin actions
-- Date: 2026-06-10
--
-- Now the FA is officially involved, every consequential admin action
-- (verify/suspend/approve-a-minor/refund/setting-change) must be attributable:
-- who did what, to whom, when. This table is that record.
--
-- Access model: read + write ONLY via the service-role client, from server
-- actions already guarded by requireAdmin(). Clients never touch it directly —
-- RLS is enabled with NO policies (deny-all for anon/authenticated) and their
-- grants are revoked for defence in depth. actor_id has no FK to auth.users so
-- the trail survives the actor's later deletion (audit integrity). Rows are
-- intended to be append-only; no update/delete path is exposed.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    uuid NOT NULL,
    actor_name  text,
    action      text NOT NULL,
    target_type text,
    target_id   text,
    target_name text,
    summary     text,
    detail      jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON public.admin_audit_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor ON public.admin_audit_log (actor_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
