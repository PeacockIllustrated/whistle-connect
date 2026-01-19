import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createClient()

    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    // 2. Fetch booking details and verify authorization
    // We need to ensure:
    // a) Booking is confirmed
    // b) Requesting user is the assigned referee
    const { data: booking, error } = await supabase
        .from('bookings')
        .select(`
            *,
            assignment:booking_assignments!inner(*)
        `)
        .eq('id', id)
        .eq('status', 'confirmed')
        .eq('assignment.referee_id', user.id)
        .single()

    if (error || !booking) {
        return new NextResponse('Booking not found or unauthorized', { status: 404 })
    }

    // 3. Prepare ICS data
    const matchDate = booking.match_date // YYYY-MM-DD
    const kickoffTime = booking.kickoff_time // HH:mm:ss

    // Construct DTSTART in UTC format: YYYYMMDDTHHMMSSZ
    // Note: match_date and kickoff_time are already in a standard format we can parse
    const startDateTime = new Date(`${matchDate}T${kickoffTime}`)

    // DEFAULT duration is 2 hours unless duration exists (not in current schema)
    const endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000)

    const formatICSDate = (date: Date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    }

    const dtStart = formatICSDate(startDateTime)
    const dtEnd = formatICSDate(endDateTime)
    const dtStamp = formatICSDate(new Date())

    // Summary
    const summary = booking.home_team && booking.away_team
        ? `Match Official - ${booking.home_team} vs ${booking.away_team}`
        : 'Match Official'

    // Location
    const locationParts = [booking.address_text, booking.ground_name, booking.location_postcode].filter(Boolean)
    const location = locationParts.join(', ')

    // Description
    const descriptionParts = [
        booking.age_group ? `Age Group: ${booking.age_group}` : null,
        booking.competition_type ? `Competition: ${booking.competition_type}` : null,
        booking.notes ? `Notes: ${booking.notes}` : null
    ].filter(Boolean)
    const description = descriptionParts.join('\\n')

    // 4. Construct ICS string
    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Whistle Connect//NONSGML v1.0//EN',
        'BEGIN:VEVENT',
        `UID:${booking.id}@whistle-connect.com`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${summary}`,
        `LOCATION:${location}`,
        `DESCRIPTION:${description}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n')

    // 5. Return as a file
    return new NextResponse(icsContent, {
        headers: {
            'Content-Type': 'text/calendar',
            'Content-Disposition': `attachment; filename="match-booking-${id}.ics"`
        }
    })
}
