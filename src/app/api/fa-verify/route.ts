import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * County FA response to a referee FA-number verification request, accessed via
 * the verification email. Uses a unique token (not the request ID) for security.
 *
 * IMPORTANT — this endpoint MUST NOT mutate on GET. Email security scanners
 * (Outlook SafeLinks, Proofpoint, antivirus prefetchers) issue automated GETs
 * against inbound links, so a state-mutating GET would let a scanner confirm or
 * reject a referee's FA registration with no human acting. The email now links
 * to /fa-verify/confirm (a read-only confirmation page); the County FA clicks
 * Confirm / Not found there, which POSTs here. The GET handler is kept only as a
 * back-compat bounce for any already-sent links and never mutates.
 */

const TOKEN_TTL_DAYS = 14

/** Back-compat: bounce any legacy GET link to the read-only confirmation page. */
export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get('token')

    if (!token) {
        return NextResponse.redirect(
            new URL('/fa-verify/error?reason=invalid', request.url)
        )
    }

    return NextResponse.redirect(
        new URL(`/fa-verify/confirm?token=${encodeURIComponent(token)}`, request.url)
    )
}

/**
 * POST /api/fa-verify
 * Body: { token: string, action: 'confirmed' | 'rejected' }
 * Performs the actual mutation — only reached from an explicit human click on
 * the confirmation page.
 */
export async function POST(request: NextRequest) {
    let token: string | undefined
    let action: string | undefined

    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
        const body = await request.json().catch(() => null)
        token = body?.token
        action = body?.action
    } else {
        const form = await request.formData().catch(() => null)
        token = form?.get('token')?.toString()
        action = form?.get('action')?.toString()
    }

    // Validate params
    if (!token || !action || !['confirmed', 'rejected'].includes(action)) {
        return NextResponse.redirect(
            new URL('/fa-verify/error?reason=invalid', request.url),
            { status: 303 }
        )
    }

    const adminClient = createAdminClient()
    if (!adminClient) {
        console.error('FA verify: admin client unavailable (missing service role key)')
        return NextResponse.redirect(
            new URL('/fa-verify/error?reason=server', request.url),
            { status: 303 }
        )
    }

    // Look up the verification request by token
    const { data: verificationRequest, error: lookupError } = await adminClient
        .from('fa_verification_requests')
        .select('id, referee_id, fa_id, county, status, created_at, expires_at')
        .eq('response_token', token)
        .single()

    if (lookupError || !verificationRequest) {
        return NextResponse.redirect(
            new URL('/fa-verify/error?reason=not_found', request.url),
            { status: 303 }
        )
    }

    // Check if already resolved
    if (verificationRequest.status !== 'awaiting_fa_response') {
        return NextResponse.redirect(
            new URL(`/fa-verify/complete?status=already_resolved&action=${verificationRequest.status}`, request.url),
            { status: 303 }
        )
    }

    // Token TTL — reject links older than the allowed window. Prefer the
    // explicit expires_at column (migration 0171); fall back to created_at + TTL
    // so the handler is safe even before the migration is applied.
    if (isTokenExpired(verificationRequest.expires_at, verificationRequest.created_at)) {
        return NextResponse.redirect(
            new URL('/fa-verify/error?reason=expired', request.url),
            { status: 303 }
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
        // Single-use guard re-asserted at write time: only flip a row still
        // 'awaiting_fa_response', so two concurrent POSTs can't both resolve it.
        .eq('status', 'awaiting_fa_response')

    if (updateError) {
        console.error('FA verify: failed to update request:', updateError)
        return NextResponse.redirect(
            new URL('/fa-verify/error?reason=server', request.url),
            { status: 303 }
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
        new URL(`/fa-verify/complete?status=${resolution}`, request.url),
        { status: 303 }
    )
}

/** True if the token is past its TTL. Prefers expires_at; falls back to created_at + 14d. */
function isTokenExpired(expiresAt: string | null, createdAt: string | null): boolean {
    if (expiresAt) {
        return new Date(expiresAt).getTime() < Date.now()
    }
    if (createdAt) {
        const expiry = new Date(createdAt).getTime() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
        return expiry < Date.now()
    }
    // No timing info at all — fail open on TTL (the single-use guard still
    // applies); don't block a legitimate County FA on missing metadata.
    return false
}
