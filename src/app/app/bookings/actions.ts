'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { BookingFormData, BookingStatus, SearchCriteria, RefereeSearchResult, DBSStatus, FAVerificationStatus } from '@/lib/types'
import { createNotification } from '@/lib/notifications'
import { checkBookingRateLimit, checkConfirmRateLimit, checkSearchRateLimit, checkOfferRateLimit } from '@/lib/rate-limit'
import { validate, bookingSchema, confirmPriceSchema, acceptOfferSchema } from '@/lib/validation'
import { geocodePostcode } from '@/lib/mapbox/geocode'

/** Shape returned by Supabase when querying referee_profiles with a joined profile */
interface RefereeProfileQueryResult {
    county: string
    level: string | null
    verified: boolean
    travel_radius_km: number | null
    fa_verification_status: FAVerificationStatus
    dbs_status: DBSStatus | null
    central_venue_opt_in?: boolean
    profile: { id: string; full_name: string; avatar_url: string | null }
        | { id: string; full_name: string; avatar_url: string | null }[]
}

export async function createBooking(data: BookingFormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const rateLimitError = checkBookingRateLimit(user.id)
    if (rateLimitError) {
        return { error: rateLimitError }
    }

    const validationError = validate(bookingSchema, data)
    if (validationError) {
        return { error: validationError }
    }

    // Build the booking data object
    // Use ground_name as fallback for address_text if the column doesn't exist
    const groundNameValue = data.address_text || data.ground_name || null

    // Geocode postcode to lat/lon for distance-based features
    let latitude: number | null = null
    let longitude: number | null = null
    if (data.location_postcode) {
        const geo = await geocodePostcode(data.location_postcode)
        if (geo) {
            latitude = geo.lat
            longitude = geo.lng
        }
    }

    // Create the booking - try with all fields first
    let booking
    let bookingError

    // First attempt: try with all fields including address_text
    const fullInsertData: Record<string, unknown> = {
        coach_id: user.id,
        status: 'pending',
        match_date: data.match_date,
        kickoff_time: data.kickoff_time + ':00',
        location_postcode: data.location_postcode,
        ground_name: groundNameValue,
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
    }

    if (latitude !== null && longitude !== null) {
        fullInsertData.latitude = latitude
        fullInsertData.longitude = longitude
    }

    const result = await supabase
        .from('bookings')
        .insert(fullInsertData)
        .select()
        .single()

    booking = result.data
    bookingError = result.error

    // If we get a column not found error, retry without the problematic columns
    if (bookingError?.message?.includes('address_text') ||
        bookingError?.message?.includes('home_team') ||
        bookingError?.message?.includes('away_team') ||
        bookingError?.message?.includes('county') ||
        bookingError?.message?.includes('booking_type')) {

        // Fallback: insert with only the core columns (no extended fields)
        const fallbackResult = await supabase
            .from('bookings')
            .insert({
                coach_id: user.id,
                status: 'pending',
                match_date: data.match_date,
                kickoff_time: data.kickoff_time + ':00',
                location_postcode: data.location_postcode,
                ground_name: groundNameValue,
                age_group: data.age_group || null,
                format: data.format || null,
                competition_type: data.competition_type || null,
                referee_level_required: data.referee_level_required || null,
                notes: data.notes || null,
                budget_pounds: data.budget_pounds || null,
            })
            .select()
            .single()

        booking = fallbackResult.data
        bookingError = fallbackResult.error
    }

    if (bookingError) {
        return { error: bookingError.message }
    }

    // Geocode booking location for distance-based features
    if (booking?.id && data.location_postcode) {
        const geo = await geocodePostcode(data.location_postcode)
        if (geo) {
            await supabase
                .from('bookings')
                .update({ latitude: geo.lat, longitude: geo.lng })
                .eq('id', booking.id)
        }
    }

    revalidatePath('/app/bookings')
    return { success: true, bookingId: booking.id }
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

export async function updateBooking(bookingId: string, data: Partial<BookingFormData>) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // First verify the user owns this booking and it's editable
    const { data: existingBooking } = await supabase
        .from('bookings')
        .select('status, coach_id')
        .eq('id', bookingId)
        .single()

    if (!existingBooking) {
        return { error: 'Booking not found' }
    }

    if (existingBooking.coach_id !== user.id) {
        return { error: 'Unauthorized' }
    }

    // Only allow editing pending or offered bookings
    if (!['pending', 'offered'].includes(existingBooking.status)) {
        return { error: 'Cannot edit a confirmed or completed booking' }
    }

    // Build update object - use ground_name as fallback for address_text
    const groundNameValue = data.address_text || data.ground_name || null

    // Core fields that should always exist
    const coreUpdateData: Record<string, unknown> = {}
    if (data.match_date !== undefined) coreUpdateData.match_date = data.match_date
    if (data.kickoff_time !== undefined) coreUpdateData.kickoff_time = data.kickoff_time + ':00'
    if (data.location_postcode !== undefined) coreUpdateData.location_postcode = data.location_postcode
    if (data.ground_name !== undefined || data.address_text !== undefined) coreUpdateData.ground_name = groundNameValue
    if (data.age_group !== undefined) coreUpdateData.age_group = data.age_group || null
    if (data.format !== undefined) coreUpdateData.format = data.format || null
    if (data.competition_type !== undefined) coreUpdateData.competition_type = data.competition_type || null
    if (data.notes !== undefined) coreUpdateData.notes = data.notes || null
    if (data.budget_pounds !== undefined) coreUpdateData.budget_pounds = data.budget_pounds || null

    // Extended fields that may not exist in the database
    const extendedUpdateData: Record<string, unknown> = {
        ...coreUpdateData,
    }
    if (data.county !== undefined) extendedUpdateData.county = data.county || null
    if (data.home_team !== undefined) extendedUpdateData.home_team = data.home_team || null
    if (data.away_team !== undefined) extendedUpdateData.away_team = data.away_team || null
    if (data.address_text !== undefined) extendedUpdateData.address_text = data.address_text || null

    // Try with all fields first
    let result = await supabase
        .from('bookings')
        .update(extendedUpdateData)
        .eq('id', bookingId)

    // If column not found error, retry with only core fields
    if (result.error?.message?.includes('address_text') ||
        result.error?.message?.includes('home_team') ||
        result.error?.message?.includes('away_team') ||
        result.error?.message?.includes('county')) {

        result = await supabase
            .from('bookings')
            .update(coreUpdateData)
            .eq('id', bookingId)
    }

    if (result.error) {
        return { error: result.error.message }
    }

    revalidatePath(`/app/bookings/${bookingId}`)
    revalidatePath('/app/bookings')
    return { success: true }
}

export async function getBooking(bookingId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized', data: null }
    }

    const { data, error } = await supabase
        .from('bookings')
        .select('*, assignments:booking_assignments(referee_id)')
        .eq('id', bookingId)
        .is('deleted_at', null)
        .single()

    if (error) {
        return { error: error.message, data: null }
    }

    // Verify the user is the coach who owns this booking, or an assigned/offered referee
    const isCoach = data.coach_id === user.id
    const assignments = Array.isArray(data.assignments) ? data.assignments : []
    const isAssignedReferee = assignments.some(
        (a: { referee_id: string }) => a.referee_id === user.id
    )

    if (!isCoach && !isAssignedReferee) {
        // Also check if this referee has a pending offer for this booking
        const { data: offer } = await supabase
            .from('booking_offers')
            .select('id')
            .eq('booking_id', bookingId)
            .eq('referee_id', user.id)
            .maybeSingle()

        if (!offer) {
            return { error: 'Unauthorized', data: null }
        }
    }

    return { data, error: null }
}

export async function deleteBooking(bookingId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // Soft delete — set deleted_at instead of removing the row
    const { error } = await supabase
        .from('bookings')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', bookingId)
        .eq('coach_id', user.id) // Ensure ownership

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/app/bookings')
    return { success: true }
}

export async function dismissBooking(bookingId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // Verify the booking is cancelled
    const { data: booking } = await supabase
        .from('bookings')
        .select('status')
        .eq('id', bookingId)
        .single()

    if (!booking) {
        return { error: 'Booking not found' }
    }

    if (booking.status !== 'cancelled') {
        return { error: 'Only cancelled bookings can be dismissed' }
    }

    // Remove the referee's offers for this booking (removes it from their view)
    const { error } = await supabase
        .from('booking_offers')
        .delete()
        .eq('booking_id', bookingId)
        .eq('referee_id', user.id)

    if (error) {
        return { error: error.message }
    }

    // Also remove any assignment
    await supabase
        .from('booking_assignments')
        .delete()
        .eq('booking_id', bookingId)
        .eq('referee_id', user.id)

    revalidatePath('/app/bookings')
    return { success: true }
}

export async function cancelBooking(bookingId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // Get booking details for notification and authorization check
    const { data: booking } = await supabase
        .from('bookings')
        .select('*, coach:profiles(*), assignments:booking_assignments(referee_id)')
        .eq('id', bookingId)
        .single()

    if (!booking) {
        return { error: 'Booking not found' }
    }

    // Check authorization: user must be the coach OR an assigned referee
    const isCoach = booking.coach_id === user.id
    const assignments = Array.isArray(booking.assignments)
        ? booking.assignments
        : booking.assignments ? [booking.assignments] : []
    const isAssignedReferee = assignments.some(
        (a: { referee_id: string }) => a.referee_id === user.id
    )

    if (!isCoach && !isAssignedReferee) {
        return { error: 'Unauthorized - you do not have permission to cancel this booking' }
    }

    if (isAssignedReferee && !isCoach && booking.status === 'confirmed') {
        // Referee is cancelling a confirmed booking:
        // Revert booking to 'pending' so the coach can find a new referee
        const { error } = await supabase
            .from('bookings')
            .update({ status: 'pending' })
            .eq('id', bookingId)

        if (error) {
            return { error: error.message }
        }

        // Remove the assignment so the booking is open again
        await supabase
            .from('booking_assignments')
            .delete()
            .eq('booking_id', bookingId)
            .eq('referee_id', user.id)

        // Mark the referee's offer as withdrawn
        await supabase
            .from('booking_offers')
            .update({ status: 'withdrawn' })
            .eq('booking_id', bookingId)
            .eq('referee_id', user.id)

        // Notify the coach that the referee pulled out
        await createNotification({
            userId: booking.coach_id,
            title: 'Referee Pulled Out',
            message: `The assigned referee has cancelled the booking for ${booking.ground_name || booking.location_postcode}. You can now search for a new referee.`,
            type: 'warning',
            link: `/app/bookings/${bookingId}`
        })
    } else {
        // Coach is cancelling, or non-confirmed booking cancellation
        const { error } = await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('id', bookingId)

        if (error) {
            return { error: error.message }
        }

        // Refund escrow if funds were held for this booking
        if (booking.escrow_amount_pence && booking.escrow_amount_pence > 0 && !booking.escrow_released_at) {
            const { data: refundResult, error: refundError } = await supabase.rpc('escrow_refund', {
                p_booking_id: bookingId,
            })

            if (refundError) {
                console.error('Escrow refund failed:', refundError)
            } else if (refundResult?.error) {
                console.error('Escrow refund returned error:', refundResult.error)
            }
        }

        // Withdraw all active offers for this booking so they no longer
        // appear in "Awaiting Action" or any pending offer lists
        await supabase
            .from('booking_offers')
            .update({ status: 'withdrawn' })
            .eq('booking_id', bookingId)
            .in('status', ['sent', 'accepted_priced'])

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
    }

    revalidatePath(`/app/bookings/${bookingId}`)
    revalidatePath('/app/bookings')
    return { success: true }
}

export async function completeBooking(bookingId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // Get booking with assignment
    const { data: booking } = await supabase
        .from('bookings')
        .select('*, assignments:booking_assignments(referee_id)')
        .eq('id', bookingId)
        .is('deleted_at', null)
        .single()

    if (!booking) {
        return { error: 'Booking not found' }
    }

    // Check authorization: user must be the coach OR the assigned referee
    const isCoach = booking.coach_id === user.id
    const assignments = Array.isArray(booking.assignments)
        ? booking.assignments
        : booking.assignments ? [booking.assignments] : []
    const isAssignedReferee = assignments.some(
        (a: { referee_id: string }) => a.referee_id === user.id
    )

    if (!isCoach && !isAssignedReferee) {
        return { error: 'Unauthorized' }
    }

    if (booking.status !== 'confirmed') {
        return { error: 'Only confirmed bookings can be marked as completed' }
    }

    // Time check: kickoff must have passed
    const kickoff = new Date(`${booking.match_date}T${booking.kickoff_time}`)
    if (new Date() <= kickoff) {
        return { error: 'The match has not started yet' }
    }

    // Update status to completed
    const { error } = await supabase
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', bookingId)

    if (error) {
        return { error: error.message }
    }

    // Notify the other party
    const notifyUserId = isCoach
        ? assignments[0]?.referee_id
        : booking.coach_id
    const notifyLabel = isCoach ? 'The coach' : 'The referee'

    if (notifyUserId) {
        await createNotification({
            userId: notifyUserId,
            title: 'Match Completed',
            message: `${notifyLabel} has marked the booking for ${booking.ground_name || booking.location_postcode} as completed.`,
            type: 'success',
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

    const validationError = validate(acceptOfferSchema, { offerId, pricePounds })
    if (validationError) {
        return { error: validationError }
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

    if (offer.status !== 'sent') {
        return { error: 'This offer is no longer available' }
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

    const rateLimitError = checkConfirmRateLimit(user.id)
    if (rateLimitError) {
        return { error: rateLimitError }
    }

    const validationError = validate(confirmPriceSchema, { offerId })
    if (validationError) {
        return { error: validationError }
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

    // Steps 1-3 (accept offer → create assignment → confirm booking) are wrapped
    // in an atomic PostgreSQL transaction via RPC. If any step fails, all roll back.
    const { data: rpcResult, error: rpcError } = await supabase.rpc('confirm_booking', {
        p_offer_id: offerId,
    })

    if (rpcError) {
        return { error: 'Failed to confirm booking: ' + rpcError.message }
    }

    if (rpcResult?.error) {
        // Pass through structured wallet errors for UI handling
        if (rpcResult.code === 'INSUFFICIENT_FUNDS') {
            return {
                error: 'Insufficient funds',
                code: 'INSUFFICIENT_FUNDS',
                balancePence: rpcResult.balance_pence,
                requiredPence: rpcResult.required_pence,
                shortfallPence: rpcResult.shortfall_pence,
            }
        }
        if (rpcResult.code === 'NO_WALLET') {
            return {
                error: 'Please top up your wallet before confirming a booking.',
                code: 'NO_WALLET',
            }
        }
        return { error: rpcResult.error }
    }

    // --- Core booking is now atomically committed. Steps 4-7 are secondary ---
    // Failures in these steps are logged but don't fail the overall operation.

    // 4. Withdraw other offers for this booking
    const { error: step4Error } = await supabase
        .from('booking_offers')
        .update({ status: 'withdrawn' })
        .eq('booking_id', offer.booking_id)
        .neq('id', offerId)

    if (step4Error) {
        console.error('Failed to withdraw competing offers:', step4Error)
    }

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
            // Don't fail — core booking is confirmed
        } else {
            thread = newThread
        }
    }

    if (thread) {
        // Add participants
        const { error: participantError } = await supabase
            .from('thread_participants')
            .upsert([
                { thread_id: thread.id, profile_id: offer.booking.coach_id },
                { thread_id: thread.id, profile_id: offer.referee_id },
            ], { onConflict: 'thread_id, profile_id' })

        if (participantError) {
            console.error('Failed to add thread participants:', participantError)
        }

        // Add system message
        const { error: messageError } = await supabase
            .from('messages')
            .insert({
                thread_id: thread.id,
                sender_id: null,
                kind: 'system',
                body: 'Booking confirmed. Use chat to finalise details.',
            })

        if (messageError) {
            console.error('Failed to add system message:', messageError)
        }
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
    const bookingDate = offer.booking.match_date
    const bookingTime = offer.booking.kickoff_time

    const { error: availError } = await supabase
        .from('referee_date_availability')
        .delete()
        .eq('referee_id', offer.referee_id)
        .eq('date', bookingDate)
        .lte('start_time', bookingTime)
        .gte('end_time', bookingTime)

    if (availError) {
        console.error('Failed to remove availability slot:', availError)
    }

    revalidatePath('/app/bookings')
    revalidatePath(`/app/bookings/${offer.booking_id}`)
    revalidatePath('/app/messages')
    revalidatePath('/app/wallet')

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
        await createNotification({
            userId: booking.coach_id,
            title: 'Offer Declined',
            message: `A referee declined your booking request for ${booking.ground_name || booking.location_postcode}.`,
            type: 'info',
            link: '/app/bookings'
        })
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

    const kickoff = criteria.kickoff_time + ':00'

    // Step 1: Get referee IDs who have availability for this date/time
    const { data: availableReferees, error: availError } = await supabase
        .from('referee_date_availability')
        .select('referee_id')
        .eq('date', criteria.match_date)
        .lte('start_time', kickoff)
        .gte('end_time', kickoff)

    if (availError) {
        return { error: availError.message }
    }

    if (!availableReferees || availableReferees.length === 0) {
        return { data: [] }
    }

    const refereeIds = availableReferees.map(a => a.referee_id)

    // Step 2: Get referee profiles for those who have availability and match county
    const { data: results, error } = await supabase
        .from('referee_profiles')
        .select(`
            county,
            level,
            verified,
            travel_radius_km,
            fa_verification_status,
            dbs_status,
            profile:profiles!inner(
                id,
                full_name,
                avatar_url
            )
        `)
        .eq('county', criteria.county)
        .in('profile_id', refereeIds)

    if (error) {
        return { error: error.message }
    }

    // Format the results
    const formattedResults: RefereeSearchResult[] = ((results || []) as RefereeProfileQueryResult[])
        .map(r => {
            const profile = Array.isArray(r.profile) ? r.profile[0] : r.profile
            return {
                id: profile.id,
                full_name: profile.full_name,
                avatar_url: profile.avatar_url,
                level: r.level,
                county: r.county,
                travel_radius_km: r.travel_radius_km ?? 0,
                verified: r.verified,
                fa_verification_status: r.fa_verification_status,
                dbs_status: r.dbs_status || 'not_provided',
                reliability_score: null,
                total_matches_completed: null,
                average_rating: null,
                match_score: null,
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

    const rateLimitError = checkSearchRateLimit(user.id)
    if (rateLimitError) {
        return { error: rateLimitError }
    }

    // 1. Get Booking Details
    const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .is('deleted_at', null)
        .single()

    if (bookingError || !booking) return { error: 'Booking not found' }

    // Verify the requesting user owns this booking
    if (booking.coach_id !== user.id) {
        return { error: 'Unauthorized' }
    }

    if (['cancelled', 'completed'].includes(booking.status)) {
        return { error: 'Cannot search referees for this booking' }
    }

    // 2. Prepare Match Criteria
    const kickoff = booking.kickoff_time

    // 3. Step 1: Get referee IDs who have availability for this date/time
    const { data: availableReferees, error: availError } = await supabase
        .from('referee_date_availability')
        .select('referee_id')
        .eq('date', booking.match_date)
        .lte('start_time', kickoff)
        .gte('end_time', kickoff)

    if (availError) {
        return { error: availError.message }
    }

    if (!availableReferees || availableReferees.length === 0) {
        return { data: [] }
    }

    let refereeIds = availableReferees.map(a => a.referee_id)

    // 3b. Exclude referees who already have a confirmed booking assignment at the same date/time
    const { data: bookedReferees } = await supabase
        .from('booking_assignments')
        .select('referee_id, booking:bookings!inner(match_date, kickoff_time, status)')
        .in('referee_id', refereeIds)

    if (bookedReferees && bookedReferees.length > 0) {
        const bookedIds = new Set(
            bookedReferees
                .filter(b => {
                    const bk = Array.isArray(b.booking) ? b.booking[0] : b.booking
                    return bk &&
                        bk.match_date === booking.match_date &&
                        bk.status !== 'cancelled'
                })
                .map(b => b.referee_id)
        )
        refereeIds = refereeIds.filter(id => !bookedIds.has(id))
    }

    if (refereeIds.length === 0) {
        return { data: [] }
    }

    // 4. Step 2: Get referee profiles for those who have availability
    // If booking has coordinates, use spatial RPC for distance-sorted results
    let spatialMap: Map<string, number> | null = null
    if (booking.latitude && booking.longitude) {
        const { data: spatialResults } = await supabase.rpc('find_referees_within_radius', {
            p_latitude: booking.latitude,
            p_longitude: booking.longitude,
            p_radius_km: 50,
        })
        if (spatialResults) {
            spatialMap = new Map(
                (spatialResults as { profile_id: string; distance_km: number }[]).map(r => [r.profile_id, r.distance_km])
            )
            // Only show referees who are both available AND within distance
            refereeIds = refereeIds.filter(id => spatialMap!.has(id))
        }
    }

    if (refereeIds.length === 0) {
        return { data: [] }
    }

    let query = supabase
        .from('referee_profiles')
        .select(`
            county,
            level,
            verified,
            travel_radius_km,
            fa_verification_status,
            dbs_status,
            central_venue_opt_in,
            reliability_score,
            total_matches_completed,
            average_rating,
            profile:profiles!inner(
                id,
                full_name,
                avatar_url
            )
        `)
        .in('profile_id', refereeIds)

    // Fall back to county match if no spatial data
    if (!spatialMap && booking.county) {
        query = query.eq('county', booking.county)
    }

    // Apply Central Venue opt-in if needed
    if (booking.booking_type === 'central') {
        query = query.eq('central_venue_opt_in', true)
    }

    const { data: results, error } = await query

    if (error) return { error: error.message }

    // 5. Format and sort by match score (distance used internally for scoring only, not exposed)
    const formattedResults: RefereeSearchResult[] = ((results || []) as (RefereeProfileQueryResult & {
        reliability_score?: number
        total_matches_completed?: number
        average_rating?: number
    })[])
        .map(r => {
            const profile = Array.isArray(r.profile) ? r.profile[0] : r.profile
            const distKm = spatialMap?.get(profile.id) ?? null
            // Smart match scoring: distance (30%) + reliability (30%) + rating (20%) + experience (20%)
            const distScore = distKm != null ? Math.max(0, 100 - (distKm * 2)) : 50 // 0km=100, 50km=0
            const reliabilityVal = r.reliability_score ?? 0
            const ratingVal = (r.average_rating ?? 0) * 20 // normalize 5-star to 0-100
            const experienceVal = Math.min((r.total_matches_completed ?? 0) * 5, 100) // cap at 20 matches
            const score = Math.round(
                (distScore * 0.3) + (reliabilityVal * 0.3) + (ratingVal * 0.2) + (experienceVal * 0.2)
            )

            return {
                id: profile.id,
                full_name: profile.full_name,
                avatar_url: profile.avatar_url,
                level: r.level,
                county: r.county,
                travel_radius_km: r.travel_radius_km ?? 0,
                verified: r.verified,
                fa_verification_status: r.fa_verification_status,
                dbs_status: r.dbs_status || 'not_provided',
                reliability_score: r.reliability_score ?? null,
                total_matches_completed: r.total_matches_completed ?? null,
                average_rating: r.average_rating ?? null,
                match_score: score,
            }
        })
        .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))

    return { data: formattedResults }
}

export async function sendBookingRequest(bookingId: string, refereeId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    const rateLimitError = checkOfferRateLimit(user.id)
    if (rateLimitError) {
        return { error: rateLimitError }
    }

    // Verify user owns this booking and it's in a valid state
    const { data: bookingCheck, error: bookingCheckError } = await supabase
        .from('bookings')
        .select('coach_id, status, deleted_at')
        .eq('id', bookingId)
        .is('deleted_at', null)
        .single()

    if (bookingCheckError || !bookingCheck) return { error: 'Booking not found' }
    if (bookingCheck.coach_id !== user.id) return { error: 'Unauthorized' }
    if (!['pending', 'offered'].includes(bookingCheck.status)) {
        return { error: 'Cannot send offers for this booking' }
    }

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

// ── Ratings ────────────────────────────────────────────────────────────────

interface RatingInput {
    rating: number
    punctuality?: number
    communication?: number
    professionalism?: number
    comment?: string
}

export async function rateReferee(bookingId: string, refereeId: string, input: RatingInput) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // Validate rating values
    if (input.rating < 1 || input.rating > 5) return { error: 'Rating must be between 1 and 5' }

    // Verify the booking is completed and belongs to this coach
    const { data: booking } = await supabase
        .from('bookings')
        .select('id, coach_id, status')
        .eq('id', bookingId)
        .single()

    if (!booking) return { error: 'Booking not found' }
    if (booking.coach_id !== user.id) return { error: 'Only the booking coach can rate' }
    if (booking.status !== 'completed') return { error: 'Can only rate completed matches' }

    // Check no existing rating
    const { data: existing } = await supabase
        .from('match_ratings')
        .select('id')
        .eq('booking_id', bookingId)
        .eq('reviewer_id', user.id)
        .maybeSingle()

    if (existing) return { error: 'You have already rated this match' }

    const { error } = await supabase
        .from('match_ratings')
        .insert({
            booking_id: bookingId,
            reviewer_id: user.id,
            referee_id: refereeId,
            rating: input.rating,
            punctuality: input.punctuality || null,
            communication: input.communication || null,
            professionalism: input.professionalism || null,
            comment: input.comment || null,
        })

    if (error) return { error: error.message }

    // Notify the referee
    await createNotification({
        userId: refereeId,
        title: 'New Rating Received',
        message: `You received a ${input.rating}-star rating for your recent match.`,
        type: 'success',
        link: '/app/profile',
    })

    revalidatePath(`/app/bookings/${bookingId}`)
    return { success: true }
}

export async function getRating(bookingId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized', data: null }

    const { data, error } = await supabase
        .from('match_ratings')
        .select('*')
        .eq('booking_id', bookingId)
        .eq('reviewer_id', user.id)
        .maybeSingle()

    if (error) return { error: error.message, data: null }
    return { data, error: null }
}
