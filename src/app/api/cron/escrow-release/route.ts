import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'
import { BOOKING_FEE_PENCE } from '@/lib/constants'

/**
 * Escrow release cron. Two paths:
 *
 *   A. Mutually confirmed: status='completed' AND both_confirmed_at IS NOT NULL
 *      Releases on the very next cron tick after the second confirmation —
 *      the user wants payment available immediately on mutual confirm,
 *      no cooling-off.
 *
 *   B. Time-based backstop: kickoff was >48h ago, no mutual confirmation
 *      yet, no open dispute. Stops escrow being held forever if one or
 *      both parties don't click confirm. Single 48h rule covers both
 *      "one party silent" and "neither party confirmed" — the kickoff
 *      timestamp is the absolute deadline.
 *
 * Both paths skip bookings with an open dispute (admin must resolve).
 *
 * Nudges fire 24h after the FIRST mark to remind the inactive party that
 * the kickoff+48h backstop is approaching.
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
    //    Reminds the inactive party that the kickoff+48h backstop is
    //    approaching. Sent once per booking.
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
            const { data: dispute } = await supabase
                .from('disputes')
                .select('id')
                .eq('booking_id', booking.id)
                .eq('status', 'open')
                .maybeSingle()
            if (dispute) continue

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
                message: `${activeLabel} has confirmed the match at ${venue}. ${escrowDisplay} will release automatically 48 hours after kickoff if you don't respond.`,
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
    // 2a. Path A — mutually confirmed: release immediately. The user
    //     wants payment available right after the second confirmation —
    //     no cooling-off. Cron picks this up on the very next tick after
    //     mark_booking_complete sets both_confirmed_at.
    // ------------------------------------------------------------------
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

    if (mutualBookings) {
        for (const booking of mutualBookings) {
            const released = await releaseEscrowFor(booking, 'mutual', platformFeePence, supabase, results)
            if (released) results.releases_mutual++
        }
    }

    // ------------------------------------------------------------------
    // 2b. Path B — kickoff + 48h backstop. Single rule covering "one
    //     party silent" and "neither party confirmed" — both result in
    //     the same auto-release at kickoff+48h, with no open dispute.
    //     The kickoff timestamp is the absolute deadline.
    // ------------------------------------------------------------------
    const fortyEightHoursAgoIso = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()

    const { data: fallbackBookings } = await supabase
        .from('bookings')
        .select(`
            id, coach_id, ground_name, location_postcode,
            escrow_amount_pence, coach_marked_complete_at, referee_marked_complete_at,
            match_date, kickoff_time,
            booking_assignments!inner(referee_id)
        `)
        .eq('status', 'confirmed')
        .not('escrow_amount_pence', 'is', null)
        .is('escrow_released_at', null)
        .is('both_confirmed_at', null)

    if (fallbackBookings) {
        for (const booking of fallbackBookings) {
            // Compute kickoff in JS — Postgres can't combine date + time + timezone
            // cleanly via .lte() on a synthesised column.
            const kickoffAt = new Date(`${booking.match_date}T${booking.kickoff_time}`)
            if (kickoffAt > new Date(fortyEightHoursAgoIso)) continue
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
 * vs "released because kickoff was 48h ago and confirmation was incomplete").
 */
type ReleaseBooking = {
    id: string
    coach_id: string
    ground_name: string | null
    location_postcode: string
    escrow_amount_pence: number | null
    coach_marked_complete_at?: string | null
    referee_marked_complete_at?: string | null
    match_date?: string
    kickoff_time?: string
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
    // the trigger. Backstop path explains it was a time-based auto-release.
    const reasonForCoach = path === 'mutual'
        ? `Both parties confirmed completion of your match at ${venue}.`
        : `Your match at ${venue} auto-completed (48 hours after kickoff${
            booking.coach_marked_complete_at && !booking.referee_marked_complete_at
                ? ', referee did not confirm'
                : !booking.coach_marked_complete_at && booking.referee_marked_complete_at
                ? ', you did not confirm'
                : ''
          }).`
    const reasonForRef = path === 'mutual'
        ? `Both parties confirmed completion of the match at ${venue}.`
        : `The match at ${venue} auto-completed (48 hours after kickoff${
            booking.referee_marked_complete_at && !booking.coach_marked_complete_at
                ? ', coach did not confirm'
                : !booking.referee_marked_complete_at && booking.coach_marked_complete_at
                ? ', you did not confirm'
                : ''
          }).`

    // Loud failure if the assignment join didn't surface a referee_id —
    // the booking is paid out but the recipient never finds out via push.
    // Sentry-capture so we know to investigate, even though the escrow
    // RPC would normally have already failed if there was no assignment.
    if (!refereeId) {
        const msg = `Escrow released for booking ${booking.id} but no referee_id on the assignment row — referee Payment Received notification was skipped.`
        console.error(`[escrow-release] ${msg}`)
        Sentry.captureMessage(msg, {
            level: 'error',
            tags: { 'escrow.flow': 'release-notify', 'escrow.path': path },
            extra: { bookingId: booking.id, coachId: booking.coach_id },
        })
    }

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
