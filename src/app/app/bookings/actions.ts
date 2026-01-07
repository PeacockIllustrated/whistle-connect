'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { BookingFormData, BookingStatus } from '@/lib/types'

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
            notes: data.notes || null,
            budget_pounds: data.budget_pounds || null,
        })
        .select()
        .single()

    if (bookingError) {
        return { error: bookingError.message }
    }

    // Find matching referees and create offers
    await matchRefereesToBooking(booking.id, data)

    revalidatePath('/app/bookings')
    redirect(`/app/bookings/${booking.id}`)
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

export async function cancelBooking(bookingId: string) {
    return updateBookingStatus(bookingId, 'cancelled')
}

export async function acceptOffer(offerId: string) {
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

    // Update offer status
    await supabase
        .from('booking_offers')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', offerId)

    // Create assignment
    await supabase
        .from('booking_assignments')
        .insert({
            booking_id: offer.booking_id,
            referee_id: user.id,
        })

    // Update booking status
    await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', offer.booking_id)

    // Withdraw other offers for this booking
    await supabase
        .from('booking_offers')
        .update({ status: 'withdrawn' })
        .eq('booking_id', offer.booking_id)
        .neq('id', offerId)

    // Create a thread for communication
    const { data: thread } = await supabase
        .from('threads')
        .insert({
            booking_id: offer.booking_id,
            title: `Booking: ${offer.booking.ground_name || offer.booking.location_postcode}`,
        })
        .select()
        .single()

    if (thread) {
        // Add participants
        await supabase
            .from('thread_participants')
            .insert([
                { thread_id: thread.id, profile_id: offer.booking.coach_id },
                { thread_id: thread.id, profile_id: user.id },
            ])

        // Add system message
        await supabase
            .from('messages')
            .insert({
                thread_id: thread.id,
                sender_id: null,
                kind: 'system',
                body: 'Referee accepted and fixture confirmed. You can now message each other about the match.',
            })
    }

    revalidatePath('/app/bookings')
    revalidatePath(`/app/bookings/${offer.booking_id}`)
    return { success: true }
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

    revalidatePath('/app/bookings')
    return { success: true }
}
