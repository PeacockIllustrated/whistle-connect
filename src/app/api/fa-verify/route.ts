import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Public endpoint for County FAs to respond to verification requests.
 * Accessed via one-click links in the verification email.
 * Uses a unique token (not request ID) for security.
 *
 * GET /api/fa-verify?token=xxx&action=confirmed|rejected
 */
export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get('token')
    const action = request.nextUrl.searchParams.get('action')

    // Validate params
    if (!token || !action || !['confirmed', 'rejected'].includes(action)) {
        return NextResponse.redirect(
            new URL('/fa-verify/error?reason=invalid', request.url)
        )
    }

    const adminClient = createAdminClient()
    if (!adminClient) {
        console.error('FA verify: admin client unavailable (missing service role key)')
        return NextResponse.redirect(
            new URL('/fa-verify/error?reason=server', request.url)
        )
    }

    // Look up the verification request by token
    const { data: verificationRequest, error: lookupError } = await adminClient
        .from('fa_verification_requests')
        .select('id, referee_id, fa_id, county, status')
        .eq('response_token', token)
        .single()

    if (lookupError || !verificationRequest) {
        return NextResponse.redirect(
            new URL('/fa-verify/error?reason=not_found', request.url)
        )
    }

    // Check if already resolved
    if (verificationRequest.status !== 'awaiting_fa_response') {
        return NextResponse.redirect(
            new URL(`/fa-verify/complete?status=already_resolved&action=${verificationRequest.status}`, request.url)
        )
    }

    const resolution = action as 'confirmed' | 'rejected'

    // Update the verification request
    const { error: updateError } = await adminClient
        .from('fa_verification_requests')
        .update({
            status: resolution,
            resolved_at: new Date().toISOString(),
            notes: `Responded via email link by County FA`,
        })
        .eq('id', verificationRequest.id)

    if (updateError) {
        console.error('FA verify: failed to update request:', updateError)
        return NextResponse.redirect(
            new URL('/fa-verify/error?reason=server', request.url)
        )
    }

    // Update the referee's FA verification status
    const faStatus = resolution === 'confirmed' ? 'verified' : 'rejected'
    await adminClient
        .from('referee_profiles')
        .update({ fa_verification_status: faStatus })
        .eq('profile_id', verificationRequest.referee_id)

    // Create in-app notification for the referee
    try {
        await adminClient.rpc('create_notification', {
            p_user_id: verificationRequest.referee_id,
            p_title: resolution === 'confirmed' ? 'FA Number Verified' : 'FA Number Rejected',
            p_message: resolution === 'confirmed'
                ? 'Your FA number has been confirmed by your County FA.'
                : 'Your FA number could not be verified by your County FA. Please check it is correct.',
            p_type: resolution === 'confirmed' ? 'success' : 'warning',
            p_link: '/app/profile',
        })
    } catch (notifErr) {
        console.error('FA verify: notification failed:', notifErr)
        // Non-blocking — still redirect to success
    }

    // Notify admins too
    try {
        const { data: admins } = await adminClient
            .from('profiles')
            .select('id')
            .eq('role', 'admin')

        if (admins) {
            await Promise.allSettled(
                admins.map(admin =>
                    adminClient.rpc('create_notification', {
                        p_user_id: admin.id,
                        p_title: `FA Verification ${resolution === 'confirmed' ? 'Confirmed' : 'Rejected'}`,
                        p_message: `County FA (${verificationRequest.county}) ${resolution} FA number ${verificationRequest.fa_id}.`,
                        p_type: 'info',
                        p_link: '/app/admin/verification',
                    })
                )
            )
        }
    } catch {
        // Admin notification is best-effort
    }

    return NextResponse.redirect(
        new URL(`/fa-verify/complete?status=${resolution}`, request.url)
    )
}
