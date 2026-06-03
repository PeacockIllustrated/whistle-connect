'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
