import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'

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
    const results = { nudges: 0, releases: 0, errors: [] as string[] }

    // 1. Send 18-hour nudge notifications
    const eighteenHoursAgo = new Date(now.getTime() - 18 * 60 * 60 * 1000)

    const { data: nudgeBookings } = await supabase
        .from('bookings')
        .select('id, coach_id, match_date, kickoff_time, ground_name, location_postcode, escrow_amount_pence')
        .eq('status', 'confirmed')
        .not('escrow_amount_pence', 'is', null)
        .is('escrow_released_at', null)
        .is('nudge_sent_at', null)

    if (nudgeBookings) {
        for (const booking of nudgeBookings) {
            const kickoff = new Date(`${booking.match_date}T${booking.kickoff_time}`)
            if (kickoff <= eighteenHoursAgo && kickoff > new Date(now.getTime() - 24 * 60 * 60 * 1000)) {
                const { data: dispute } = await supabase
                    .from('disputes')
                    .select('id')
                    .eq('booking_id', booking.id)
                    .eq('status', 'open')
                    .maybeSingle()

                if (!dispute) {
                    await createNotification({
                        userId: booking.coach_id,
                        title: 'Match Auto-Completing Soon',
                        message: `Your match at ${booking.ground_name || booking.location_postcode} will auto-complete in 6 hours. Raise a dispute if there was an issue.`,
                        type: 'info',
                        link: `/app/bookings/${booking.id}`,
                    })

                    await supabase
                        .from('bookings')
                        .update({ nudge_sent_at: now.toISOString() })
                        .eq('id', booking.id)

                    results.nudges++
                }
            }
        }
    }

    // 2. Release escrow for bookings past 24 hours
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const { data: releaseBookings } = await supabase
        .from('bookings')
        .select(`
            id, coach_id, match_date, kickoff_time, ground_name, location_postcode,
            escrow_amount_pence,
            booking_assignments!inner(referee_id)
        `)
        .eq('status', 'confirmed')
        .not('escrow_amount_pence', 'is', null)
        .is('escrow_released_at', null)

    if (releaseBookings) {
        for (const booking of releaseBookings) {
            const kickoff = new Date(`${booking.match_date}T${booking.kickoff_time}`)
            if (kickoff > twentyFourHoursAgo) continue

            const { data: dispute } = await supabase
                .from('disputes')
                .select('id')
                .eq('booking_id', booking.id)
                .eq('status', 'open')
                .maybeSingle()

            if (dispute) continue

            const { data: result, error: rpcError } = await supabase.rpc('escrow_release', {
                p_booking_id: booking.id,
                p_platform_fee_pence: 0,
            })

            if (rpcError || result?.error) {
                const errMsg = rpcError?.message || result?.error
                console.error(`Escrow release failed for booking ${booking.id}:`, errMsg)
                results.errors.push(`Booking ${booking.id}: ${errMsg}`)
                continue
            }

            const refereeId = (booking.booking_assignments as unknown as { referee_id: string }[])[0]?.referee_id

            await Promise.allSettled([
                createNotification({
                    userId: booking.coach_id,
                    title: 'Payment Released',
                    message: `Payment of £${((booking.escrow_amount_pence ?? 0) / 100).toFixed(2)} has been released for your match at ${booking.ground_name || booking.location_postcode}.`,
                    type: 'success',
                    link: `/app/bookings/${booking.id}`,
                }),
                refereeId ? createNotification({
                    userId: refereeId,
                    title: 'Payment Received',
                    message: `£${((booking.escrow_amount_pence ?? 0) / 100).toFixed(2)} has been added to your wallet for the match at ${booking.ground_name || booking.location_postcode}.`,
                    type: 'success',
                    link: '/app/wallet',
                }) : Promise.resolve(),
            ])

            results.releases++
        }
    }

    console.log('Escrow release cron completed:', results)

    return NextResponse.json({
        success: true,
        ...results,
        timestamp: now.toISOString(),
    })
}
