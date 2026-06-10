'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/admin/audit'

/** Verify the current user is an admin. Returns the user id on success. */
async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return { error: 'Only admins can perform this action' }
    }

    return { userId: user.id }
}

/**
 * Resolve or dismiss a moderation report. Admin-only. Records who resolved it,
 * an optional note, and the timestamp.
 */
export async function resolveReport(
    id: string,
    status: 'resolved' | 'dismissed',
    note?: string
): Promise<{ success?: boolean; error?: string }> {
    const auth = await requireAdmin()
    if ('error' in auth) {
        return { error: auth.error }
    }

    if (status !== 'resolved' && status !== 'dismissed') {
        return { error: 'Invalid status' }
    }

    const adminSupabase = createAdminClient()
    if (!adminSupabase) {
        return { error: 'Admin client unavailable' }
    }

    const { error } = await adminSupabase
        .from('reports')
        .update({
            status,
            resolution_note: note?.trim() || null,
            resolved_by: auth.userId,
            resolved_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'open')

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/app/admin/reports')
    return { success: true }
}

/**
 * Soft-remove a reported message. Admin-only. Sets deleted_at and overwrites the
 * body so the offending text never renders again, while keeping the row for the
 * audit trail.
 */
export async function removeMessage(messageId: string): Promise<{ success?: boolean; error?: string }> {
    const auth = await requireAdmin()
    if ('error' in auth) {
        return { error: auth.error }
    }

    const adminSupabase = createAdminClient()
    if (!adminSupabase) {
        return { error: 'Admin client unavailable' }
    }

    const { error } = await adminSupabase
        .from('messages')
        .update({
            deleted_at: new Date().toISOString(),
            body: '[removed by moderator]',
        })
        .eq('id', messageId)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/app/admin/reports')
    return { success: true }
}

/**
 * Suspend (eject) a user in response to a report. Admin-only. Sets the
 * suspension marker AND bans the auth.users row (reversible) so the session is
 * killed and re-login refused immediately.
 */
export async function suspendUser(userId: string, reason?: string): Promise<{ success?: boolean; error?: string }> {
    const auth = await requireAdmin()
    if ('error' in auth) {
        return { error: auth.error }
    }
    if (userId === auth.userId) {
        return { error: 'You cannot suspend your own account.' }
    }

    const adminSupabase = createAdminClient()
    if (!adminSupabase) {
        return { error: 'Admin client unavailable' }
    }

    const { error } = await adminSupabase
        .from('profiles')
        .update({
            suspended_at: new Date().toISOString(),
            suspended_reason: reason?.trim() || null,
        })
        .eq('id', userId)

    if (error) {
        return { error: error.message }
    }

    // Disable login immediately (reversible). ~100yr ban.
    const { error: banError } = await adminSupabase.auth.admin.updateUserById(userId, { ban_duration: '876000h' })
    if (banError) {
        return { error: 'User flagged as suspended, but login could not be disabled. Please retry.' }
    }

    await logAdminAction({
        actorId: auth.userId,
        action: 'user.suspend',
        summary: reason?.trim() ? `Suspended user — ${reason.trim()}` : 'Suspended user',
        targetType: 'user',
        targetId: userId,
        detail: { reason: reason?.trim() || null },
    })

    revalidatePath('/app/admin/reports')
    return { success: true }
}

/**
 * Lift a suspension. Admin-only. Clears the marker and un-bans the auth user.
 */
export async function unsuspendUser(userId: string): Promise<{ success?: boolean; error?: string }> {
    const auth = await requireAdmin()
    if ('error' in auth) {
        return { error: auth.error }
    }

    const adminSupabase = createAdminClient()
    if (!adminSupabase) {
        return { error: 'Admin client unavailable' }
    }

    const { error } = await adminSupabase
        .from('profiles')
        .update({ suspended_at: null, suspended_reason: null })
        .eq('id', userId)

    if (error) {
        return { error: error.message }
    }

    // 'none' lifts the ban in supabase-js.
    const { error: banError } = await adminSupabase.auth.admin.updateUserById(userId, { ban_duration: 'none' })
    if (banError) {
        return { error: 'Suspension cleared, but login could not be re-enabled. Please retry.' }
    }

    await logAdminAction({
        actorId: auth.userId,
        action: 'user.unsuspend',
        summary: 'Lifted user suspension',
        targetType: 'user',
        targetId: userId,
    })

    revalidatePath('/app/admin/reports')
    return { success: true }
}
