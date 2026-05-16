import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Public endpoint for a parent/guardian to approve or decline an under-16
 * referee account. Accessed via one-click links in the parental-consent
 * email. Uses a unique token (not the row ID) for security. Mirrors
 * /api/fa-verify.
 *
 * GET /api/parent-consent?token=xxx&action=approved|rejected
 */
export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get('token')
    const action = request.nextUrl.searchParams.get('action')

    if (!token || !action || !['approved', 'rejected'].includes(action)) {
        return NextResponse.redirect(
            new URL('/parent-consent/error?reason=invalid', request.url)
        )
    }

    const adminClient = createAdminClient()
    if (!adminClient) {
        console.error('Parent consent: admin client unavailable (missing service role key)')
        return NextResponse.redirect(
            new URL('/parent-consent/error?reason=server', request.url)
        )
    }

    const { data: consent, error: lookupError } = await adminClient
        .from('parental_consents')
        .select('id, referee_id, child_name, status')
        .eq('response_token', token)
        .single()

    if (lookupError || !consent) {
        return NextResponse.redirect(
            new URL('/parent-consent/error?reason=not_found', request.url)
        )
    }

    if (consent.status !== 'awaiting') {
        return NextResponse.redirect(
            new URL(`/parent-consent/complete?status=already_resolved&action=${consent.status}`, request.url)
        )
    }

    const resolution = action === 'approved' ? 'verified' : 'rejected'

    const { error: updateError } = await adminClient
        .from('parental_consents')
        .update({
            status: resolution,
            resolved_at: new Date().toISOString(),
            notes: 'Responded via email link by parent/guardian',
        })
        .eq('id', consent.id)

    if (updateError) {
        console.error('Parent consent: failed to update request:', updateError)
        return NextResponse.redirect(
            new URL('/parent-consent/error?reason=server', request.url)
        )
    }

    // Flip the gate column on referee_profiles.
    await adminClient
        .from('referee_profiles')
        .update({ parental_consent_status: resolution })
        .eq('profile_id', consent.referee_id)

    // Notify the referee in-app (best-effort).
    try {
        await adminClient.rpc('create_notification', {
            p_user_id: consent.referee_id,
            p_title: resolution === 'verified' ? 'Account approved' : 'Account not approved',
            p_message: resolution === 'verified'
                ? 'Your parent/guardian approved your account. You can now be booked for matches.'
                : 'Your parent/guardian did not approve your account. Please contact them or support.',
            p_type: resolution === 'verified' ? 'success' : 'warning',
            p_link: '/app',
        })
    } catch (notifErr) {
        console.error('Parent consent: notification failed:', notifErr)
    }

    return NextResponse.redirect(
        new URL(`/parent-consent/complete?status=${resolution}`, request.url)
    )
}
