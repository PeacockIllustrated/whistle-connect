import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Parent/guardian approval for an under-18 referee account, accessed via the
 * parental-consent email. Uses a unique token (not the row ID) for security.
 * Mirrors /api/fa-verify.
 *
 * IMPORTANT — this endpoint MUST NOT mutate on GET. Email security scanners
 * (Outlook SafeLinks, Proofpoint, antivirus prefetchers) issue automated GETs
 * against inbound links, so a state-mutating GET would let a scanner approve or
 * reject a minor's account with no human parent acting. The email now links to
 * /parent-consent/confirm (a read-only confirmation page); the parent clicks
 * Approve / Decline there, which POSTs here. The GET handler is kept only as a
 * back-compat bounce for any already-sent links and never mutates.
 */

const TOKEN_TTL_DAYS = 14

/** Back-compat: bounce any legacy GET link to the read-only confirmation page. */
export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get('token')

    if (!token) {
        return NextResponse.redirect(
            new URL('/parent-consent/error?reason=invalid', request.url)
        )
    }

    return NextResponse.redirect(
        new URL(`/parent-consent/confirm?token=${encodeURIComponent(token)}`, request.url)
    )
}

/**
 * POST /api/parent-consent
 * Body: { token: string, action: 'approved' | 'rejected' }
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

    if (!token || !action || !['approved', 'rejected'].includes(action)) {
        return NextResponse.redirect(
            new URL('/parent-consent/error?reason=invalid', request.url),
            { status: 303 }
        )
    }

    const adminClient = createAdminClient()
    if (!adminClient) {
        console.error('Parent consent: admin client unavailable (missing service role key)')
        return NextResponse.redirect(
            new URL('/parent-consent/error?reason=server', request.url),
            { status: 303 }
        )
    }

    const { data: consent, error: lookupError } = await adminClient
        .from('parental_consents')
        .select('id, referee_id, child_name, status, created_at, expires_at')
        .eq('response_token', token)
        .single()

    if (lookupError || !consent) {
        return NextResponse.redirect(
            new URL('/parent-consent/error?reason=not_found', request.url),
            { status: 303 }
        )
    }

    if (consent.status !== 'awaiting') {
        return NextResponse.redirect(
            new URL(`/parent-consent/complete?status=already_resolved&action=${consent.status}`, request.url),
            { status: 303 }
        )
    }

    // Token TTL — reject links older than the allowed window. Prefer the
    // explicit expires_at column (migration 0171); fall back to created_at + TTL
    // so the handler is safe even before the migration is applied.
    if (isTokenExpired(consent.expires_at, consent.created_at)) {
        return NextResponse.redirect(
            new URL('/parent-consent/error?reason=expired', request.url),
            { status: 303 }
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
        // Single-use guard re-asserted at write time: only flip a row still
        // 'awaiting', so two concurrent POSTs can't both resolve it.
        .eq('status', 'awaiting')

    if (updateError) {
        console.error('Parent consent: failed to update request:', updateError)
        return NextResponse.redirect(
            new URL('/parent-consent/error?reason=server', request.url),
            { status: 303 }
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
        new URL(`/parent-consent/complete?status=${resolution}`, request.url),
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
    // No timing info at all — fail open on TTL (the single-use 'awaiting' guard
    // still applies); don't block a legitimate parent on missing metadata.
    return false
}
