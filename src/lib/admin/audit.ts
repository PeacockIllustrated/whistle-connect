import 'server-only'
import { createAdminClient } from '@/lib/supabase/server'

/** A single admin-action record from admin_audit_log. */
export interface AdminAuditEntry {
    id: string
    actor_id: string
    actor_name: string | null
    action: string
    target_type: string | null
    target_id: string | null
    target_name: string | null
    summary: string | null
    detail: Record<string, unknown> | null
    created_at: string
}

const PERSON_TARGETS = new Set(['referee', 'coach', 'user'])

/**
 * Write an admin action to the audit trail. Best-effort and never throws — an
 * audit-write failure must not block the underlying action (it's logged to the
 * server console / Sentry instead). Resolves actor and (person) target names so
 * each row is self-contained and survives later profile edits/deletions.
 *
 * Always called from a server action that has ALREADY verified the caller is an
 * admin; `actorId` is that admin's id.
 */
export async function logAdminAction(params: {
    actorId: string
    action: string
    summary?: string
    targetType?: string
    targetId?: string | null
    targetName?: string | null
    detail?: Record<string, unknown>
}): Promise<void> {
    try {
        const admin = createAdminClient()
        if (!admin) {
            console.error('[audit] admin client unavailable — action not logged:', params.action)
            return
        }

        const { data: actor } = await admin
            .from('profiles')
            .select('full_name')
            .eq('id', params.actorId)
            .maybeSingle()

        let targetName = params.targetName ?? null
        if (!targetName && params.targetId && PERSON_TARGETS.has(params.targetType ?? '')) {
            const { data: target } = await admin
                .from('profiles')
                .select('full_name')
                .eq('id', params.targetId)
                .maybeSingle()
            targetName = target?.full_name ?? null
        }

        const { error } = await admin.from('admin_audit_log').insert({
            actor_id: params.actorId,
            actor_name: actor?.full_name ?? null,
            action: params.action,
            summary: params.summary ?? null,
            target_type: params.targetType ?? null,
            target_id: params.targetId ?? null,
            target_name: targetName,
            detail: params.detail ?? null,
        })
        if (error) console.error('[audit] insert failed:', error.message)
    } catch (err) {
        console.error('[audit] logAdminAction threw:', err)
    }
}

/** Newest-first slice of the audit trail. Service-role read — caller must be admin. */
export async function getRecentAdminActivity(limit = 50, offset = 0): Promise<AdminAuditEntry[]> {
    const admin = createAdminClient()
    if (!admin) return []
    const { data } = await admin
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
    return (data as AdminAuditEntry[] | null) ?? []
}
