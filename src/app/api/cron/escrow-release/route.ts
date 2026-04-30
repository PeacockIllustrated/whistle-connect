import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'
import { BOOKING_FEE_PENCE } from '@/lib/constants'

/**
 * Escrow release cron. Phase 2 — gating now requires explicit confirmation
 * by both parties (or one party + 72h fallback) instead of the legacy
 * kickoff+24h time gate.
 *
 * Two release paths run in parallel:
 *
 *   A. Mutually confirmed: status='completed' AND both_confirmed_at < now - 48h
 *      The 48h window lets either party catch a problem and raise a dispute
 *      after the second click.
 *
 *   B. Stuck-confirmation fallback: status='confirmed' AND one party marked
 *      AND first_mark_at < now - 72h. Stops escrow being held forever by
 *      an inactive counterparty.
 *
 * Both paths skip bookings with an open dispute (admin must resolve).
 *
 * Nudge notifications are repurposed: instead of a 6-hour auto-completion
 * warning, we now nudge the inactive party 24h after the FIRST mark to
 * remind them to confirm — they have 48h before auto-release at 72h.
 */
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    if (!supabase) {
        return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 })
    }

    const now = new Date()
    const results = {
        nudges: 0,
        releases_mutual: 0,
        releases_fallback: 0,
        errors: [] as string[],
    }

    // ------------------------------------------------------------------
    // 0. Read platform fee from settings (so admins can tune without redeploy)
    // ------------------------------------------------------------------
    const { data: feeSetting } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'booking_fee_pence')
        .single()
    const platformFeePence = feeSetting
        ? (parseInt(feeSetting.value, 10) || BOOKING_FEE_PENCE)
        : BOOKING_FEE_PENCE

    // ------------------------------------------------------------------
    // 1. Nudges — first party marked complete >24h ago, other party hasn't.
    //    Nudge the inactive party once. They have until 72h before fallback
    //    auto-release fires.
    // ------------------------------------------------------------------
    const twentyFourHoursAgoIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

    const { data: nudgeBookings } = await supabase
        .from('bookings')
        .select('id, coach_id, ground_name, location_postcode, coach_marked_complete_at, referee_marked_complete_at, escrow_amount_pence, booking_assignments!inner(referee_id)')
        .eq('status', 'confirmed')
        .is('both_confirmed_at', null)
        .is('escrow_released_at', null)
        .is('nudge_sent_at', null)
        .or(`coach_marked_complete_at.lte.${twentyFourHoursAgoIso},referee_marked_complete_at.lte.${twentyFourHoursAgoIso}`)

    if (nudgeBookings) {
        for (const booking of nudgeBookings) {
            // Skip if open dispute
            const { data: dispute } = await supabase
                .from('disputes')
                .select('id')
                .eq('booking_id', booking.id)
                .eq('status', 'open')
                .maybeSingle()
            if (dispute) continue

            // Identify who's outstanding
            const coachMarked = !!booking.coach_marked_complete_at
            const refMarked = !!booking.referee_marked_complete_at
            if (coachMarked && refMarked) continue // both marked already (race), skip

            const refereeId = (booking.booking_assignments as unknown as { referee_id: string }[])[0]?.referee_id
            const inactiveUserId = coachMarked ? refereeId : booking.coach_id
            const activeLabel = coachMarked ? 'The coach' : 'The referee'
            if (!inactiveUserId) continue

            const venue = booking.ground_name || booking.location_postcode
            const escrowDisplay = booking.escrow_amount_pence != null
                ? `£${(booking.escrow_amount_pence / 100).toFixed(2)}`
                : 'the match fee'

            await createNotification({
                userId: inactiveUserId,
                title: 'Confirm match completion',
                message: `${activeLabel} has confirmed the match at ${venue}. ${escrowDisplay} will release automatically in 48 hours if you don't respond.`,
                type: 'warning',
                link: `/app/bookings/${booking.id}`,
            })

            await supabase
                .from('bookings')
                .update({ nudge_sent_at: now.toISOString() })
                .eq('id', booking.id)

            results.nudges++
        }
    }

    // ------------------------------------------------------------------
    // 2a. Path A — mutually confirmed releases (status='completed', both
    //     confirmed >48h ago, no open dispute).
    // ------------------------------------------------------------------
    const fortyEightHoursAgoIso = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()

    const { data: mutualBookings } = await supabase
        .from('bookings')
        .select(`
            id, coach_id, ground_name, location_postcode,
            escrow_amount_pence,
            booking_assignments!inner(referee_id)
        `)
        .eq('status', 'completed')
        .not('escrow_amount_pence', 'is', null)
        .is('escrow_released_at', null)
        .not('both_confirmed_at', 'is', null)
        .lte('both_confirmed_at', fortyEightHoursAgoIso)

    if (mutualBookings) {
        for (const booking of mutualBookings) {
            const released = await releaseEscrowFor(booking, 'mutual', platformFeePence, supabase, results)
            if (released) results.releases_mutual++
        }
    }

    // ------------------------------------------------------------------
    // 2b. Path B — stuck-confirmation fallback (status='confirmed', exactly
    //     one side marked, first mark was >72h ago).
    // ------------------------------------------------------------------
    const seventyTwoHoursAgoIso = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString()

    const { data: fallbackBookings } = await supabase
        .from('bookings')
        .select(`
            id, coach_id, ground_name, location_postcode,
            escrow_amount_pence, coach_marked_complete_at, referee_marked_complete_at,
            booking_assignments!inner(referee_id)
        `)
        .eq('status', 'confirmed')
        .not('escrow_amount_pence', 'is', null)
        .is('escrow_released_at', null)
        .is('both_confirmed_at', null)
        .or(`coach_marked_complete_at.lte.${seventyTwoHoursAgoIso},referee_marked_complete_at.lte.${seventyTwoHoursAgoIso}`)

    if (fallbackBookings) {
        for (const booking of fallbackBookings) {
            const released = await releaseEscrowFor(booking, 'fallback', platformFeePence, supabase, results)
            if (released) results.releases_fallback++
        }
    }

    console.log('Escrow release cron completed:', results)

    return NextResponse.json({
        success: true,
        ...results,
        timestamp: now.toISOString(),
    })
}

/**
 * Release escrow for a single booking. Skips on open dispute.
 * Path determines the notification copy ("released after both confirmed"
 * vs "released because the [coach|referee] did not respond within 72 hours").
 */
type ReleaseBooking = {
    id: string
    coach_id: string
    ground_name: string | null
    location_postcode: string
    escrow_amount_pence: number | null
    coach_marked_complete_at?: string | null
    referee_marked_complete_at?: string | null
    booking_assignments: { referee_id: string }[] | { referee_id: string }
}

type ReleaseResults = {
    releases_mutual: number
    releases_fallback: number
    errors: string[]
}

async function releaseEscrowFor(
    booking: ReleaseBooking,
    path: 'mutual' | 'fallback',
    platformFeePence: number,
    supabase: NonNullable<ReturnType<typeof createAdminClient>>,
    results: ReleaseResults,
): Promise<boolean> {
    // Final dispute check at release time (defence-in-depth — query above
    // didn't filter on this, so a dispute opened between query and now
    // would still slip through).
    const { data: dispute } = await supabase
        .from('disputes')
        .select('id')
        .eq('booking_id', booking.id)
        .eq('status', 'open')
        .maybeSingle()
    if (dispute) return false

    const { data: result, error: rpcError } = await supabase.rpc('escrow_release', {
        p_booking_id: booking.id,
        p_platform_fee_pence: platformFeePence,
    })

    if (rpcError || result?.error) {
        const errMsg = rpcError?.message || result?.error || 'unknown error'
        console.error(`Escrow release failed for booking ${booking.id}:`, errMsg)
        results.errors.push(`Booking ${booking.id}: ${errMsg}`)
        Sentry.captureException(rpcError || new Error(errMsg), {
            tags: { 'escrow.flow': 'release', 'escrow.path': path },
            extra: { bookingId: booking.id },
            level: 'error',
        })
        return false
    }

    const assignments = Array.isArray(booking.booking_assignments)
        ? booking.booking_assignments
        : [booking.booking_assignments]
    const refereeId = assignments[0]?.referee_id
    const refereeAmountPence = (booking.escrow_amount_pence ?? 0) - platformFeePence
    const totalDisplay = `£${((booking.escrow_amount_pence ?? 0) / 100).toFixed(2)}`
    const refereeDisplay = `£${(refereeAmountPence / 100).toFixed(2)}`
    const venue = booking.ground_name || booking.location_postcode

    // Path-aware copy: be explicit about WHY this released so users understand
    // the trigger.
    const reasonForCoach = path === 'mutual'
        ? `Both parties confirmed completion of your match at ${venue}.`
        : `Your match at ${venue} auto-completed because ${
            booking.coach_marked_complete_at ? 'the referee' : 'you'
          } did not confirm within 72 hours.`
    const reasonForRef = path === 'mutual'
        ? `Both parties confirmed completion of the match at ${venue}.`
        : `The match at ${venue} auto-completed after ${
            booking.referee_marked_complete_at ? 'the coach' : 'you'
          } did not confirm within 72 hours.`

    await Promise.allSettled([
        createNotification({
            userId: booking.coach_id,
            title: 'Payment Released',
            message: `${reasonForCoach} ${totalDisplay} has been released to the referee.`,
            type: 'success',
            link: `/app/bookings/${booking.id}`,
        }),
        refereeId ? createNotification({
            userId: refereeId,
            title: 'Payment Received',
            message: `${reasonForRef} ${refereeDisplay} has been added to your wallet.`,
            type: 'success',
            link: '/app/wallet',
        }) : Promise.resolve(),
    ])

    return true
}
