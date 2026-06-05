import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// match_date + kickoff_time are stored as UK local (Europe/London) wall-clock
// values. The old code did `new Date(\`${date}T${time}\`)` which, on a UTC
// server (Vercel), parsed the wall-clock numbers AS UTC and then stamped them
// with a trailing `Z` — so a 14:00 BST kickoff went into the calendar as
// 14:00Z, which a UK phone shows as 15:00 (the reported "1 hour ahead").
// We convert the London wall-clock to the correct UTC instant instead.
function londonOffsetMs(instant: Date): number {
    // What does this UTC instant read as on a London wall clock?
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(instant)
    const f: Record<string, string> = {}
    for (const p of parts) f[p.type] = p.value
    // `hour` can come back as "24" at midnight in some runtimes — normalise.
    const hour = f.hour === '24' ? 0 : Number(f.hour)
    const asLondon = Date.UTC(
        Number(f.year), Number(f.month) - 1, Number(f.day),
        hour, Number(f.minute), Number(f.second)
    )
    return asLondon - instant.getTime()
}

// Interpret "YYYY-MM-DD" + "HH:mm[:ss]" as Europe/London wall-clock and return
// the true UTC instant. Computing the offset at the naive-UTC reading is exact
// for any normal kickoff time (only the 1h DST-transition window at ~01:00 is
// ambiguous, and matches aren't booked then).
function londonWallClockToUTC(dateStr: string, timeStr: string): Date {
    const [y, mo, d] = dateStr.split('-').map(Number)
    const [h, mi, s] = timeStr.split(':').map(Number)
    const naiveUTC = Date.UTC(y, mo - 1, d, h || 0, mi || 0, s || 0)
    return new Date(naiveUTC - londonOffsetMs(new Date(naiveUTC)))
}

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

    // 2. Fetch booking. Authorisation check happens after — both coaches and
    //    assigned referees can download the ICS for their own confirmed booking.
    const { data: booking, error } = await supabase
        .from('bookings')
        .select(`
            *,
            assignment:booking_assignments(referee_id)
        `)
        .eq('id', id)
        .eq('status', 'confirmed')
        .is('deleted_at', null)
        .single()

    if (error || !booking) {
        return new NextResponse('Booking not found', { status: 404 })
    }

    const isCoach = booking.coach_id === user.id
    const assignment = Array.isArray(booking.assignment)
        ? booking.assignment[0]
        : booking.assignment
    const isAssignedReferee = assignment?.referee_id === user.id

    if (!isCoach && !isAssignedReferee) {
        return new NextResponse('Unauthorized', { status: 403 })
    }

    // 3. Prepare ICS data
    const matchDate = booking.match_date // YYYY-MM-DD
    const kickoffTime = booking.kickoff_time // HH:mm:ss

    // Construct DTSTART in UTC format: YYYYMMDDTHHMMSSZ. The stored values are
    // UK local wall-clock, so convert via Europe/London (see helpers above) —
    // not a naive `new Date(...)`, which mis-stamps the kickoff by the BST/GMT
    // offset and lands the event an hour ahead.
    const startDateTime = londonWallClockToUTC(matchDate, kickoffTime)

    // DEFAULT duration is 2 hours unless duration exists (not in current schema)
    const endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000)

    const formatICSDate = (date: Date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    }

    const dtStart = formatICSDate(startDateTime)
    const dtEnd = formatICSDate(endDateTime)
    const dtStamp = formatICSDate(new Date())

    // Summary — phrased differently for the coach vs the official
    const matchTitle = booking.home_team && booking.away_team
        ? `${booking.home_team} vs ${booking.away_team}`
        : 'Match'
    const summary = isCoach
        ? matchTitle
        : `Match Official${booking.home_team && booking.away_team ? ` - ${matchTitle}` : ''}`

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
