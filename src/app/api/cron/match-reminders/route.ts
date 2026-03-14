import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notifications'

/**
 * Match Reminder Cron Endpoint
 *
 * Call this endpoint on a schedule (e.g. every hour via Vercel Cron or external service)
 * to send reminders for upcoming matches.
 *
 * Sends two types of reminders:
 * - 24-hour reminder (day before the match)
 * - 2-hour reminder (shortly before kickoff)
 *
 * Protected by CRON_SECRET to prevent unauthorized calls.
 *
 * Vercel cron config (add to vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/match-reminders",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json(
            { error: 'Server configuration missing' },
            { status: 500 }
        )
    }

    // Use service role client for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let remindersSent = 0

    // --- 24-hour reminders ---
    const { data: matches24h } = await supabase.rpc('get_upcoming_matches', {
        p_hours_ahead: 24,
    })

    if (matches24h && matches24h.length > 0) {
        // Check which reminders were already sent (avoid duplicates)
        const bookingIds24 = matches24h.map((m: { booking_id: string }) => m.booking_id)

        const { data: alreadySent24 } = await supabase
            .from('notifications')
            .select('link')
            .in('link', bookingIds24.map((id: string) => `/app/bookings/${id}`))
            .eq('title', 'Match Tomorrow')

        const sentBookingLinks = new Set(
            (alreadySent24 || []).map((n: { link: string }) => n.link)
        )

        for (const match of matches24h) {
            const bookingLink = `/app/bookings/${match.booking_id}`
            if (sentBookingLinks.has(bookingLink)) continue

            const matchDate = new Date(match.match_date).toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
            })
            const location = match.ground_name || match.location_postcode
            const kickoff = match.kickoff_time?.slice(0, 5) || 'TBC'

            // Notify both coach and referee
            const promises = [
                createNotification({
                    userId: match.coach_id,
                    title: 'Match Tomorrow',
                    message: `Your match at ${location} kicks off at ${kickoff} on ${matchDate}. Make sure everything is ready!`,
                    type: 'info',
                    link: bookingLink,
                    category: 'match_reminder',
                }),
                createNotification({
                    userId: match.referee_id,
                    title: 'Match Tomorrow',
                    message: `You're officiating at ${location} at ${kickoff} on ${matchDate}. Don't forget your kit!`,
                    type: 'info',
                    link: bookingLink,
                    category: 'match_reminder',
                }),
            ]

            await Promise.allSettled(promises)
            remindersSent += 2
        }
    }

    // --- 2-hour reminders ---
    const { data: matches2h } = await supabase.rpc('get_upcoming_matches', {
        p_hours_ahead: 2,
    })

    if (matches2h && matches2h.length > 0) {
        const bookingIds2 = matches2h.map((m: { booking_id: string }) => m.booking_id)

        const { data: alreadySent2 } = await supabase
            .from('notifications')
            .select('link')
            .in('link', bookingIds2.map((id: string) => `/app/bookings/${id}`))
            .eq('title', 'Match Starting Soon')

        const sentBookingLinks2 = new Set(
            (alreadySent2 || []).map((n: { link: string }) => n.link)
        )

        for (const match of matches2h) {
            const bookingLink = `/app/bookings/${match.booking_id}`
            if (sentBookingLinks2.has(bookingLink)) continue

            const location = match.ground_name || match.location_postcode
            const kickoff = match.kickoff_time?.slice(0, 5) || 'TBC'

            const promises = [
                createNotification({
                    userId: match.coach_id,
                    title: 'Match Starting Soon',
                    message: `Your match at ${location} kicks off at ${kickoff}. Good luck!`,
                    type: 'info',
                    link: bookingLink,
                    category: 'match_reminder',
                }),
                createNotification({
                    userId: match.referee_id,
                    title: 'Match Starting Soon',
                    message: `Your match at ${location} kicks off at ${kickoff}. Time to head out!`,
                    type: 'info',
                    link: bookingLink,
                    category: 'match_reminder',
                }),
            ]

            await Promise.allSettled(promises)
            remindersSent += 2
        }
    }

    return NextResponse.json({
        success: true,
        remindersSent,
        timestamp: new Date().toISOString(),
    })
}
