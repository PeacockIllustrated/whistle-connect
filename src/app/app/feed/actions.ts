'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotification } from '@/lib/notifications'
import { requiresDBS, refereeBlockedFromAgeGroup } from '@/lib/constants'

export interface FeedBooking {
    id: string
    match_date: string
    kickoff_time: string
    location_postcode: string
    ground_name: string | null
    age_group: string | null
    format: string | null
    budget_pounds: number | null
    is_sos: boolean
    distance_km: number
    coach_name: string
    home_team: string | null
    away_team: string | null
}

export async function getMatchFeed(): Promise<{
    data?: FeedBooking[]
    error?: string
    /** True when the referee has no geocoded location, so find_bookings_near_referee
     *  can only ever return nothing. Lets the feed explain the empty state. */
    locationMissing?: boolean
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // Check user is a referee
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'referee') return { error: 'Referee access required' }

    // The feed RPC hard-returns nothing if the referee has no location, so an
    // empty result is ambiguous (no location vs. no nearby matches). Resolve it
    // up front: a row comes back only when location is set.
    const { data: locRow } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .not('location', 'is', null)
        .maybeSingle()
    const locationMissing = !locRow

    // Call the find_bookings_near_referee RPC
    const { data: refereeProfile } = await supabase
        .from('referee_profiles')
        .select('travel_radius_km')
        .eq('profile_id', user.id)
        .single()

    const radius = refereeProfile?.travel_radius_km ?? 15

    const { data, error } = await supabase.rpc('find_bookings_near_referee', {
        p_referee_id: user.id,
        p_radius_km: radius,
    })

    if (error) return { error: error.message }

    // Get IDs of bookings the referee already has offers for
    const bookingIds = (data || []).map((b: { id: string }) => b.id)
    if (bookingIds.length === 0) return { data: [], locationMissing }

    const { data: existingOffers } = await supabase
        .from('booking_offers')
        .select('booking_id')
        .eq('referee_id', user.id)
        .in('booking_id', bookingIds)

    const offeredBookingIds = new Set((existingOffers || []).map(o => o.booking_id))

    // Filter out bookings with existing offers and format
    const feedBookings: FeedBooking[] = (data || [])
        .filter((b: { id: string }) => !offeredBookingIds.has(b.id))
        .map((b: {
            id: string
            match_date: string
            kickoff_time: string
            location_postcode: string
            ground_name: string | null
            age_group: string | null
            format: string | null
            budget_pounds: number | null
            is_sos: boolean
            distance_km: number
            coach_name: string
            home_team: string | null
            away_team: string | null
        }) => ({
            id: b.id,
            match_date: b.match_date,
            kickoff_time: b.kickoff_time,
            location_postcode: b.location_postcode,
            ground_name: b.ground_name,
            age_group: b.age_group,
            format: b.format,
            budget_pounds: b.budget_pounds,
            is_sos: b.is_sos ?? false,
            distance_km: Math.round(b.distance_km * 10) / 10,
            coach_name: b.coach_name || 'Coach',
            home_team: b.home_team,
            away_team: b.away_team,
        }))

    return { data: feedBookings, locationMissing }
}

export interface FeedOffer {
    id: string
    status: string
    price_pence: number | null
    created_at: string
    booking: {
        id: string
        match_date: string
        kickoff_time: string
        ground_name: string | null
        location_postcode: string
        age_group: string | null
        format: string | null
        home_team: string | null
        away_team: string | null
        coach_name: string
    }
}

export async function getMyOffers(): Promise<{ data?: FeedOffer[]; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    const { data: rawOffers } = await supabase
        .from('booking_offers')
        .select(`
            id,
            status,
            price_pence,
            created_at,
            booking:bookings(
                id,
                match_date,
                kickoff_time,
                ground_name,
                location_postcode,
                age_group,
                format,
                home_team,
                away_team,
                deleted_at,
                coach:profiles(full_name)
            )
        `)
        .eq('referee_id', user.id)
        .in('status', ['sent', 'accepted_priced'])
        .order('created_at', { ascending: false })

    if (!rawOffers) return { data: [] }

    // Supabase joins return nested objects; cast through unknown for safety
    interface RawOffer {
        id: string
        status: string
        price_pence: number | null
        created_at: string
        booking: {
            id: string
            match_date: string
            kickoff_time: string
            ground_name: string | null
            location_postcode: string
            age_group: string | null
            format: string | null
            home_team: string | null
            away_team: string | null
            deleted_at: string | null
            coach: { full_name: string }
        }
    }

    const offers: FeedOffer[] = (rawOffers as unknown as RawOffer[])
        .filter(o => o.booking && !o.booking.deleted_at)
        .map(o => ({
            id: o.id,
            status: o.status,
            price_pence: o.price_pence,
            created_at: o.created_at,
            booking: {
                id: o.booking.id,
                match_date: o.booking.match_date,
                kickoff_time: o.booking.kickoff_time,
                ground_name: o.booking.ground_name,
                location_postcode: o.booking.location_postcode,
                age_group: o.booking.age_group,
                format: o.booking.format,
                home_team: o.booking.home_team,
                away_team: o.booking.away_team,
                coach_name: o.booking.coach.full_name,
            },
        }))

    return { data: offers }
}

export async function expressInterest(bookingId: string): Promise<{ success?: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // Verify referee role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'referee') return { error: 'Referee access required' }

    // Check booking exists and is still available
    const { data: booking } = await supabase
        .from('bookings')
        .select('id, coach_id, status, ground_name, location_postcode, match_date, age_group, is_sos')
        .eq('id', bookingId)
        .is('deleted_at', null)
        .single()

    if (!booking) return { error: 'Booking not found' }
    if (!['pending', 'offered'].includes(booking.status)) {
        return { error: 'This match is no longer available' }
    }

    // Safeguarding gate for the expressing referee — mirrors acceptOffer /
    // sendBookingRequest. A consent-locked or age-ineligible minor (or a
    // non-DBS ref on a DBS-required age group) must not be able to self-confirm
    // onto a booking. Fails closed: a NULL/unparseable DOB is treated as
    // blocked by refereeBlockedFromAgeGroup.
    {
        const { data: refGate } = await supabase
            .from('referee_profiles')
            .select('parental_consent_status, dbs_status, profile:profiles!inner(date_of_birth)')
            .eq('profile_id', user.id)
            .single()

        if (
            refGate?.parental_consent_status === 'awaiting' ||
            refGate?.parental_consent_status === 'rejected'
        ) {
            return { error: 'Your account is awaiting parental consent and cannot be used yet.' }
        }

        // DBS enforcement: U16 and under require a verified DBS check.
        if (requiresDBS(booking.age_group) && refGate?.dbs_status !== 'verified') {
            return { error: 'A verified DBS check is required for this age group.' }
        }

        // Age eligibility at the MATCH DATE. Fails closed: a referee with no
        // DOB on file cannot express interest.
        const refProfile = refGate && (Array.isArray(refGate.profile) ? refGate.profile[0] : refGate.profile)
        if (refereeBlockedFromAgeGroup(refProfile?.date_of_birth, booking.age_group, booking.match_date)) {
            return { error: 'You are not eligible for this age group.' }
        }
    }

    // Look up any existing offer for this ref + booking. SOS bookings
    // auto-insert an "I notified you" offer for every nearby ref at broadcast
    // time (createSOSBooking) — we treat that as a passive invitation, with
    // responded_at = null. When the ref taps "Accept SOS Call" we want to
    // promote that row to actively-accepted (responded_at = now()) rather
    // than insert a duplicate.
    const { data: existing } = await supabase
        .from('booking_offers')
        .select('id, responded_at')
        .eq('booking_id', bookingId)
        .eq('referee_id', user.id)
        .maybeSingle()

    if (existing) {
        if (existing.responded_at) {
            return { error: 'You have already expressed interest in this match' }
        }
        // Promote the passive auto-broadcast offer to actively-accepted by
        // stamping responded_at. The coach OFFERS list filters on
        // responded_at IS NOT NULL for SOS bookings to surface only
        // actively-engaged refs.
        const { error: promoteError } = await supabase
            .from('booking_offers')
            .update({ status: 'sent', responded_at: new Date().toISOString() })
            .eq('id', existing.id)
        if (promoteError) return { error: promoteError.message }
    } else {
        // No prior offer → fresh ref-initiated express-interest. Stamping
        // responded_at on insert keeps the "ref has acted on this offer"
        // invariant consistent with the SOS-promotion path above.
        const { error: offerError } = await supabase
            .from('booking_offers')
            .insert({
                booking_id: bookingId,
                referee_id: user.id,
                status: 'sent',
                responded_at: new Date().toISOString(),
            })
        if (offerError) return { error: offerError.message }
    }

    // Update booking status to 'offered' if still pending
    if (booking.status === 'pending') {
        await supabase
            .from('bookings')
            .update({ status: 'offered' })
            .eq('id', bookingId)
            .eq('status', 'pending')
    }

    // Notify the coach
    const matchDate = new Date(booking.match_date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
    })
    await createNotification({
        userId: booking.coach_id,
        title: 'Referee Available',
        message: `${profile.full_name} is available for your match on ${matchDate} at ${booking.ground_name || booking.location_postcode}.`,
        type: 'info',
        link: `/app/bookings/${bookingId}`,
    })

    revalidatePath('/app/feed')
    revalidatePath(`/app/bookings/${bookingId}`)
    revalidatePath('/app/bookings')

    return { success: true }
}
