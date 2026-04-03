'use server'

import { createClient } from '@/lib/supabase/server'
import { toLocalDateString } from '@/lib/utils'

export interface AdminMapReferee {
    id: string
    full_name: string
    latitude: number
    longitude: number
    level: string | null
    county: string | null
    is_available: boolean
    fa_verification_status: string
    verified: boolean
    reliability_score: number
    average_rating: number
    total_matches_completed: number
}

export interface AdminMapBooking {
    id: string
    status: string
    match_date: string
    kickoff_time: string
    home_team: string | null
    away_team: string | null
    ground_name: string | null
    location_postcode: string
    address_text: string | null
    latitude: number
    longitude: number
    format: string | null
    age_group: string | null
    is_sos: boolean
    coach_name: string | null
    referee_name: string | null
}

export async function getAdminMapData(): Promise<{
    referees?: AdminMapReferee[]
    bookings?: AdminMapBooking[]
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // Verify admin
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') return { error: 'Admin access required' }

    const today = toLocalDateString(new Date())

    const [
        { data: refProfiles },
        { data: bookingData },
    ] = await Promise.all([
        // All referees with locations
        supabase
            .from('referee_profiles')
            .select(`
                profile_id, level, county, is_available,
                fa_verification_status, verified,
                reliability_score, average_rating, total_matches_completed,
                profile:profiles!inner(id, full_name, latitude, longitude)
            `)
            .not('profiles.latitude', 'is', null)
            .not('profiles.longitude', 'is', null),

        // All upcoming/active bookings with locations
        supabase
            .from('bookings')
            .select(`
                id, status, match_date, kickoff_time, home_team, away_team,
                ground_name, location_postcode, address_text,
                latitude, longitude, format, age_group, is_sos,
                coach:profiles!bookings_coach_id_fkey(full_name),
                assignment:booking_assignments(referee:profiles(full_name))
            `)
            .is('deleted_at', null)
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .in('status', ['pending', 'offered', 'confirmed', 'completed'])
            .gte('match_date', today)
            .order('match_date', { ascending: true })
            .limit(200),
    ])

    // Process referees
    const referees: AdminMapReferee[] = (refProfiles || [])
        .filter((r) => {
            const p = Array.isArray(r.profile) ? r.profile[0] : r.profile
            return p?.latitude && p?.longitude
        })
        .map((r) => {
            const p = Array.isArray(r.profile) ? r.profile[0] : r.profile
            return {
                id: p.id,
                full_name: p.full_name,
                latitude: p.latitude!,
                longitude: p.longitude!,
                level: r.level,
                county: r.county,
                is_available: r.is_available ?? false,
                fa_verification_status: r.fa_verification_status,
                verified: r.verified ?? false,
                reliability_score: r.reliability_score ?? 0,
                average_rating: r.average_rating ?? 0,
                total_matches_completed: r.total_matches_completed ?? 0,
            }
        })

    // Process bookings
    const getName = (v: { full_name: string } | { full_name: string }[] | null | undefined): string | null => {
        if (!v) return null
        if (Array.isArray(v)) return v[0]?.full_name || null
        return v.full_name || null
    }

    interface BookingRow {
        id: string
        status: string
        match_date: string
        kickoff_time: string
        home_team: string | null
        away_team: string | null
        ground_name: string | null
        location_postcode: string
        address_text: string | null
        latitude: number
        longitude: number
        format: string | null
        age_group: string | null
        is_sos: boolean
        coach: { full_name: string } | { full_name: string }[] | null
        assignment: Array<{ referee: { full_name: string } | { full_name: string }[] | null }> | null
    }

    const bookings: AdminMapBooking[] = ((bookingData || []) as BookingRow[]).map((b) => ({
        id: b.id,
        status: b.status,
        match_date: b.match_date,
        kickoff_time: b.kickoff_time,
        home_team: b.home_team,
        away_team: b.away_team,
        ground_name: b.ground_name,
        location_postcode: b.location_postcode,
        address_text: b.address_text,
        latitude: b.latitude,
        longitude: b.longitude,
        format: b.format,
        age_group: b.age_group,
        is_sos: b.is_sos,
        coach_name: getName(b.coach),
        referee_name: b.assignment?.[0] ? getName(b.assignment[0].referee) : null,
    }))

    return { referees, bookings }
}
