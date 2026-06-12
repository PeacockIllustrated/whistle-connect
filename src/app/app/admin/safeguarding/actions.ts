'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/admin/audit'
import { sendParentConsentEmail } from '@/lib/email/parent-consent'
import { checkSharedEmailRateLimit } from '@/lib/rate-limit'

/** A locked under-18 referee awaiting (or declined for) parental consent. */
export type MinorConsentRow = {
    referee_id: string
    full_name: string
    date_of_birth: string | null
    parental_consent_status: string
    parent_email: string | null
    has_token: boolean
    requested_at: string | null
}

async function requireAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
    if (profile?.role !== 'admin') return null
    return user
}

export async function getMinorsQueue(): Promise<{ data?: MinorConsentRow[]; error?: string }> {
    const user = await requireAdmin()
    if (!user) return { error: 'Admin access required' }
    const admin = createAdminClient()
    if (!admin) return { error: 'Service role unavailable' }

    const { data: refs, error } = await admin
        .from('referee_profiles')
        .select('profile_id, parental_consent_status')
        .in('parental_consent_status', ['awaiting', 'rejected'])
    if (error) return { error: error.message }

    const ids = (refs || []).map((r) => r.profile_id)
    if (ids.length === 0) return { data: [] }

    const [{ data: profiles }, { data: consents }] = await Promise.all([
        admin.from('profiles').select('id, full_name, date_of_birth').in('id', ids),
        admin
            .from('parental_consents')
            .select('referee_id, parent_email, response_token, created_at')
            .in('referee_id', ids),
    ])
    const profileById = new Map((profiles || []).map((p) => [p.id, p]))
    const consentByRef = new Map((consents || []).map((c) => [c.referee_id, c]))

    const rows: MinorConsentRow[] = (refs || []).map((r) => {
        const p = profileById.get(r.profile_id)
        const c = consentByRef.get(r.profile_id)
        return {
            referee_id: r.profile_id,
            full_name: p?.full_name ?? 'Unknown',
            date_of_birth: p?.date_of_birth ?? null,
            parental_consent_status: r.parental_consent_status,
            parent_email: c?.parent_email ?? null,
            has_token: !!c?.response_token,
            requested_at: c?.created_at ?? null,
        }
    })
    // Awaiting first (actionable), then rejected; oldest first within each group.
    rows.sort((a, b) => {
        if (a.parental_consent_status !== b.parental_consent_status) {
            return a.parental_consent_status === 'awaiting' ? -1 : 1
        }
        return (a.requested_at || '').localeCompare(b.requested_at || '')
    })
    return { data: rows }
}

async function setConsent(
    refereeId: string,
    resolution: 'verified' | 'rejected',
    actorId: string,
) {
    const admin = createAdminClient()
    if (!admin) return { error: 'Service role unavailable' }

    const { error } = await admin
        .from('referee_profiles')
        .update({ parental_consent_status: resolution })
        .eq('profile_id', refereeId)
    if (error) return { error: error.message }

    await admin
        .from('parental_consents')
        .update({
            status: resolution,
            resolved_at: new Date().toISOString(),
            notes: `Resolved by admin (${resolution})`,
        })
        .eq('referee_id', refereeId)

    // Notify the referee (best-effort).
    try {
        await admin.rpc('create_notification', {
            p_user_id: refereeId,
            p_title: resolution === 'verified' ? 'Account approved' : 'Account not approved',
            p_message: resolution === 'verified'
                ? 'An administrator approved your account. You can now be booked for matches.'
                : 'Your account was not approved. Please contact support if you think this is a mistake.',
            p_type: resolution === 'verified' ? 'success' : 'warning',
            p_link: '/app',
        })
    } catch (err) {
        console.error('[safeguarding] notification failed:', err)
    }

    await logAdminAction({
        actorId,
        action: resolution === 'verified' ? 'consent.approve' : 'consent.reject',
        summary: resolution === 'verified'
            ? 'Approved parental consent (manual override)'
            : 'Rejected parental consent (manual override)',
        targetType: 'referee',
        targetId: refereeId,
    })

    revalidatePath('/app/admin/safeguarding')
    return { success: true }
}

export async function approveParentalConsent(refereeId: string): Promise<{ success?: boolean; error?: string }> {
    const user = await requireAdmin()
    if (!user) return { error: 'Admin access required' }
    return setConsent(refereeId, 'verified', user.id)
}

export async function rejectParentalConsent(refereeId: string): Promise<{ success?: boolean; error?: string }> {
    const user = await requireAdmin()
    if (!user) return { error: 'Admin access required' }
    return setConsent(refereeId, 'rejected', user.id)
}

export async function resendParentConsent(refereeId: string): Promise<{ success?: boolean; error?: string }> {
    const user = await requireAdmin()
    if (!user) return { error: 'Admin access required' }
    const admin = createAdminClient()
    if (!admin) return { error: 'Service role unavailable' }

    const { data: consent } = await admin
        .from('parental_consents')
        .select('parent_email, child_name, response_token, status')
        .eq('referee_id', refereeId)
        .maybeSingle()

    if (!consent?.response_token || !consent.parent_email) {
        return { error: 'No parent email / approval token on file — ask the referee to add a parent or guardian email.' }
    }
    if (consent.status !== 'awaiting') {
        return { error: 'This consent has already been resolved.' }
    }

    // Cross-instance backstop keyed by the recipient parent email — stops the
    // resend button being used to mail-bomb a parent/guardian address via the
    // Make->Zoho hub (migration 0172).
    const sharedLimit = await checkSharedEmailRateLimit(consent.parent_email)
    if (!sharedLimit.ok) {
        return { error: 'Too many requests, please try again later.' }
    }

    try {
        await sendParentConsentEmail({
            parentEmail: consent.parent_email,
            childName: consent.child_name || 'your child',
            responseToken: consent.response_token,
        })
    } catch (err) {
        console.error('[safeguarding] resend email failed:', err)
        return { error: 'Could not send the email. Please try again.' }
    }

    await logAdminAction({
        actorId: user.id,
        action: 'consent.resend_email',
        summary: `Resent parental consent email to ${consent.parent_email}`,
        targetType: 'referee',
        targetId: refereeId,
    })
    return { success: true }
}
