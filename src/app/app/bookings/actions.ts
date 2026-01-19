'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { BookingFormData, BookingStatus, SearchCriteria, RefereeSearchResult } from '@/lib/types'
import { createNotification } from '@/lib/notifications'

export async function createBooking(data: BookingFormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // Create the booking
    const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
            coach_id: user.id,
            status: 'pending',
            match_date: data.match_date,
            kickoff_time: data.kickoff_time + ':00',
            location_postcode: data.location_postcode,
            ground_name: data.ground_name || null,
            age_group: data.age_group || null,
            format: data.format || null,
            competition_type: data.competition_type || null,
            referee_level_required: data.referee_level_required || null,
            county: data.county || null,
            home_team: data.home_team || null,
            away_team: data.away_team || null,
            address_text: data.address_text || null,
            notes: data.notes || null,
            budget_pounds: data.budget_pounds || null,
            booking_type: data.booking_type || 'individual',
        })
        .select()
        .single()

    if (bookingError) {
        return { error: bookingError.message }
    }

    revalidatePath('/app/bookings')
    redirect(`/app/bookings/${booking.id}/match`)
}

async function matchRefereesToBooking(bookingId: string, data: BookingFormData) {
    const supabase = await createClient()

    // Get day of week from match date
    const matchDate = new Date(data.match_date)
    const dayOfWeek = matchDate.getDay()

    // Find referees with matching availability
    // In MVP, we use a simple approach: find referees available on that day of week
    const { data: availabilities } = await supabase
        .from('referee_availability')
        .select('referee_id')
        .eq('day_of_week', dayOfWeek)

    if (!availabilities || availabilities.length === 0) {
        return
    }

    // Get unique referee IDs
    const refereeIds = [...new Set(availabilities.map(a => a.referee_id))]

    // Get verified referees only (or all for MVP)
    const { data: refereeProfiles } = await supabase
        .from('referee_profiles')
        .select('profile_id')
        .in('profile_id', refereeIds)

    if (!refereeProfiles || refereeProfiles.length === 0) {
        return
    }

    // Create offers (limit to 15)
    const offersToCreate = refereeProfiles.slice(0, 15).map(rp => ({
        booking_id: bookingId,
        referee_id: rp.profile_id,
        status: 'sent',
    }))

    await supabase.from('booking_offers').insert(offersToCreate)

    // Notify Referees
    // We do this asynchronously to not block the response
    offersToCreate.forEach(async (offer) => {
        await createNotification({
            userId: offer.referee_id,
            title: 'New Booking Offer',
            message: `You have received a booking offer for ${data.ground_name || data.location_postcode}.`,
            type: 'info',
            link: '/app/bookings' // Referees see offers in their bookings list
        })
    })

    // Update booking status to 'offered' if offers were sent
    if (offersToCreate.length > 0) {
        await supabase
            .from('bookings')
            .update({ status: 'offered' })
            .eq('id', bookingId)
    }
}

export async function updateBookingStatus(bookingId: string, status: BookingStatus) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const { error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', bookingId)
        .eq('coach_id', user.id) // Ensure user owns the booking

    if (error) {
        return { error: error.message }
    }

    revalidatePath(`/app/bookings/${bookingId}`)
    revalidatePath('/app/bookings')
    return { success: true }
}

export async function deleteBooking(bookingId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId)
        .eq('coach_id', user.id) // Ensure ownership

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/app/bookings')
    return { success: true }
}

export async function cancelBooking(bookingId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // Get booking details for notification
    const { data: booking } = await supabase
        .from('bookings')
        .select('*, coach:profiles(*)')
        .eq('id', bookingId)
        .single()

    const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId)

    if (error) {
        return { error: error.message }
    }

    // Notify the coach if the user cancelling is NOT the coach (i.e. it's the referee)
    if (booking && booking.coach_id !== user.id) {
        await createNotification({
            userId: booking.coach_id,
            title: 'Booking Cancelled',
            message: `Referee has cancelled the booking for ${booking.ground_name || booking.location_postcode}.`,
            type: 'warning',
            link: `/app/bookings/${bookingId}`
        })
    }

    revalidatePath(`/app/bookings/${bookingId}`)
    revalidatePath('/app/bookings')
    return { success: true }
}

export async function acceptOffer(offerId: string, pricePounds: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // Get the offer
    const { data: offer, error: offerError } = await supabase
        .from('booking_offers')
        .select('*, booking:bookings(*)')
        .eq('id', offerId)
        .eq('referee_id', user.id)
        .single()

    if (offerError || !offer) {
        return { error: 'Offer not found' }
    }

    const pricePence = Math.round(pricePounds * 100)

    // Update offer status to accepted_priced and store price
    const { error: updateError } = await supabase
        .from('booking_offers')
        .update({
            status: 'accepted_priced',
            price_pence: pricePence,
            responded_at: new Date().toISOString()
        })
        .eq('id', offerId)

    if (updateError) {
        return { error: updateError.message }
    }

    // Notify Coach
    await createNotification({
        userId: offer.booking.coach_id,
        title: 'Offer Priced!',
        message: `A referee has accepted your booking request and sent a price of £${pricePounds} for ${offer.booking.ground_name || offer.booking.location_postcode}.`,
        type: 'info',
        link: `/app/bookings/${offer.booking_id}`
    })

    revalidatePath('/app/bookings')
    revalidatePath(`/app/bookings/${offer.booking_id}`)

    return { success: true }
}

export async function confirmPrice(offerId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // Get the offer with booking detail
    const { data: offer, error: offerError } = await supabase
        .from('booking_offers')
        .select('*, booking:bookings(*)')
        .eq('id', offerId)
        .single()

    if (offerError || !offer) {
        return { error: 'Offer not found' }
    }

    // Ensure user is the coach of this booking
    if (offer.booking.coach_id !== user.id) {
        return { error: 'Unauthorized' }
    }

    // 1. Update offer status to accepted
    await supabase
        .from('booking_offers')
        .update({ status: 'accepted' })
        .eq('id', offerId)

    // 2. Create assignment
    await supabase
        .from('booking_assignments')
        .insert({
            booking_id: offer.booking_id,
            referee_id: offer.referee_id,
        })

    // 3. Update booking status
    await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', offer.booking_id)

    // 4. Withdraw other offers for this booking
    await supabase
        .from('booking_offers')
        .update({ status: 'withdrawn' })
        .eq('booking_id', offer.booking_id)
        .neq('id', offerId)

    // 5. Create or get a thread for communication
    let { data: thread } = await supabase
        .from('threads')
        .select('id')
        .eq('booking_id', offer.booking_id)
        .maybeSingle()

    if (!thread) {
        const { data: newThread, error: threadError } = await supabase
            .from('threads')
            .insert({
                booking_id: offer.booking_id,
                title: `Booking: ${offer.booking.ground_name || offer.booking.location_postcode}`,
            })
            .select()
            .single()

        if (threadError || !newThread) {
            console.error('Thread creation error:', threadError)
            return { error: 'Failed to create message thread' }
        }
        thread = newThread
    }

    if (thread) {
        // Add participants
        await supabase
            .from('thread_participants')
            .upsert([
                { thread_id: thread.id, profile_id: offer.booking.coach_id },
                { thread_id: thread.id, profile_id: offer.referee_id },
            ], { onConflict: 'thread_id, profile_id' })

        // Add system message
        await supabase
            .from('messages')
            .insert({
                thread_id: thread.id,
                sender_id: null,
                kind: 'system',
                body: 'Booking confirmed. Use chat to finalise details.',
            })
    }

    // 6. Notify Referee
    await createNotification({
        userId: offer.referee_id,
        title: 'Booking Confirmed!',
        message: `The coach has accepted your price. The booking for ${offer.booking.ground_name || offer.booking.location_postcode} is now confirmed.`,
        type: 'success',
        link: `/app/bookings/${offer.booking_id}`
    })

    // 7. Auto-remove availability slot
    // Find slot that overlaps with the booking on that date
    const bookingDate = offer.booking.match_date
    const bookingTime = offer.booking.kickoff_time

    await supabase
        .from('referee_date_availability')
        .delete()
        .eq('referee_id', offer.referee_id)
        .eq('date', bookingDate)
        .lte('start_time', bookingTime)
        .gte('end_time', bookingTime)

    revalidatePath('/app/bookings')
    revalidatePath(`/app/bookings/${offer.booking_id}`)
    revalidatePath('/app/messages')

    return { success: true, threadId: thread?.id }
}

export async function declineOffer(offerId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const { error } = await supabase
        .from('booking_offers')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('id', offerId)
        .eq('referee_id', user.id)

    if (error) {
        return { error: error.message }
    }

    // Get booking to notify coach
    const { data: offerData } = await supabase.from('booking_offers').select('booking:bookings(coach_id, ground_name, location_postcode)').eq('id', offerId).single()

    // Handle Supabase join sometimes returning array
    const booking = offerData?.booking ? (Array.isArray(offerData.booking) ? offerData.booking[0] : offerData.booking) : null

    if (booking) {
        if (booking) {
            await createNotification({
                userId: booking.coach_id,
                title: 'Offer Declined',
                message: `A referee declined your booking request for ${booking.ground_name || booking.location_postcode}.`,
                type: 'info',
                link: '/app/bookings'
            })
        }
    }

    revalidatePath('/app/bookings')
    return { success: true }
}



export async function searchReferees(criteria: SearchCriteria): Promise<{ data?: RefereeSearchResult[], error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // Get day of week from match date
    const matchDate = new Date(criteria.match_date)
    const dayOfWeek = matchDate.getDay()

    const kickoff = criteria.kickoff_time + ':00'

    // Query referee_profiles that match the county
    // And join with profiles for basic info
    // And join with date availability to check for matches on that day and time
    const { data: results, error } = await supabase
        .from('referee_profiles')
        .select(`
            county,
            level,
            verified,
            travel_radius_km,
            dbs_status,
            safeguarding_status,
            profile:profiles!inner(
                id,
                full_name,
                avatar_url
            ),
            availability:referee_date_availability!inner(
                date,
                start_time,
                end_time
            )
        `)
        .eq('county', criteria.county)
        .eq('availability.date', criteria.match_date)
        .lte('availability.start_time', kickoff)
        .gte('availability.end_time', kickoff)

    if (error) {
        return { error: error.message }
    }

    // Filter out referees who don't actually have availability for that day
    // (Supabase join might return the profile even if availability doesn't match if not careful, 
    // but availability.day_of_week filter should work if structured correctly)
    const formattedResults: RefereeSearchResult[] = (results || [])
        .filter(r => r.availability && (r.availability as any).length > 0)
        .map(r => {
            const profile = Array.isArray(r.profile) ? r.profile[0] : r.profile
            return {
                id: profile.id,
                full_name: profile.full_name,
                avatar_url: profile.avatar_url,
                level: r.level,
                county: r.county,
                travel_radius_km: r.travel_radius_km,
                verified: r.verified,
                dbs_status: r.dbs_status,
                safeguarding_status: r.safeguarding_status
            }
        })

    return { data: formattedResults }
}

export async function bookReferee(refereeId: string, data: BookingFormData): Promise<{ success?: boolean, error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // 1. Create the booking
    const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
            coach_id: user.id,
            status: 'offered', // Start as offered since we are specific booking one referee
            match_date: data.match_date,
            kickoff_time: data.kickoff_time + ':00',
            location_postcode: data.location_postcode,
            ground_name: data.ground_name || null,
            age_group: data.age_group || null,
            format: data.format || null,
            competition_type: data.competition_type || null,
            notes: data.notes || null,
            budget_pounds: data.budget_pounds || null,
        })
        .select()
        .single()

    if (bookingError) {
        return { error: bookingError.message }
    }

    // 2. Create the offer for this specific referee
    const { error: offerError } = await supabase
        .from('booking_offers')
        .insert({
            booking_id: booking.id,
            referee_id: refereeId,
            status: 'sent',
        })

    if (offerError) {
        return { error: offerError.message }
    }

    // Removed immediate thread creation - now happens after price confirmation

    revalidatePath('/app/bookings')
    revalidatePath('/app/messages')

    return { success: true }
}

export async function searchRefereesForBooking(bookingId: string): Promise<{ data?: RefereeSearchResult[], error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // 1. Get Booking Details
    const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single()

    if (bookingError || !booking) return { error: 'Booking not found' }

    // 2. Prepare Match Criteria
    const matchDate = new Date(booking.match_date)
    const dayOfWeek = matchDate.getDay()
    const kickoff = booking.kickoff_time

    // 3. Query
    let query = supabase
        .from('referee_profiles')
        .select(`
            county,
            level,
            verified,
            travel_radius_km,
            dbs_status,
            safeguarding_status,
            central_venue_opt_in,
            profile:profiles!inner(
                id,
                full_name,
                avatar_url
            ),
            availability:referee_date_availability!inner(
                date,
                start_time,
                end_time
            )
        `)
        .eq('availability.date', booking.match_date)
        .lte('availability.start_time', kickoff)
        .gte('availability.end_time', kickoff)

    // Apply location match (county for MVP)
    if (booking.county) {
        query = query.eq('county', booking.county)
    }

    // Apply Central Venue opt-in if needed
    if (booking.booking_type === 'central') {
        query = query.eq('central_venue_opt_in', true)
    }

    const { data: results, error } = await query

    if (error) return { error: error.message }

    // 4. Format
    const formattedResults: RefereeSearchResult[] = (results || [])
        .filter(r => r.availability && (r.availability as any).length > 0)
        .map(r => {
            const profile = Array.isArray(r.profile) ? r.profile[0] : r.profile
            return {
                id: profile.id,
                full_name: profile.full_name,
                avatar_url: profile.avatar_url,
                level: r.level,
                county: r.county,
                travel_radius_km: r.travel_radius_km,
                verified: r.verified,
                dbs_status: r.dbs_status,
                safeguarding_status: r.safeguarding_status
            }
        })

    return { data: formattedResults }
}

export async function sendBookingRequest(bookingId: string, refereeId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // 1. Create Offer
    const { error: offerError } = await supabase
        .from('booking_offers')
        .insert({
            booking_id: bookingId,
            referee_id: refereeId,
            status: 'sent',
        })

    if (offerError) {
        if (offerError.code === '23505') return { error: 'Request already sent to this referee' }
        return { error: offerError.message }
    }

    // 2. Update Booking Status if it was 'pending'
    await supabase
        .from('bookings')
        .update({ status: 'offered' })
        .eq('id', bookingId)
        .eq('status', 'pending')

    // 3. Notify Referee
    const { data: booking } = await supabase.from('bookings').select('match_date, ground_name, location_postcode').eq('id', bookingId).single()

    if (booking) {
        await createNotification({
            userId: refereeId,
            title: 'New Booking Request',
            message: `A coach has requested you for a match on ${booking.match_date} at ${booking.ground_name || booking.location_postcode}.`,
            type: 'info',
            link: '/app/offers' // Redirect to new offers page
        })
    }

    revalidatePath(`/app/bookings/${bookingId}`)
    revalidatePath(`/app/bookings/${bookingId}/match`)
    revalidatePath('/app/bookings')

    return { success: true }
}
