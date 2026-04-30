'use server'

import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { BookingFormData, BookingStatus, SearchCriteria, RefereeSearchResult, DBSStatus, FAVerificationStatus } from '@/lib/types'
import { createNotification } from '@/lib/notifications'
import { checkBookingRateLimit, checkSearchRateLimit, checkOfferRateLimit } from '@/lib/rate-limit'
import { validate, bookingSchema, confirmPriceSchema, offerPriceSchema } from '@/lib/validation'
import { geocodePostcode } from '@/lib/mapbox/geocode'
import { requiresDBS, BOOKING_FEE_PENCE } from '@/lib/constants'

/** Fetch the current travel cost rate from platform settings */
export async function getTravelRate(): Promise<number> {
    const supabase = await createClient()
    const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'travel_cost_per_km_pence')
        .single()
    return data ? parseInt(data.value, 10) : 28
}

/**
 * Fetch the current platform booking fee in pence.
 * Falls back to BOOKING_FEE_PENCE constant (99) if the setting is missing.
 */
export async function getBookingFeePence(): Promise<number> {
    const supabase = await createClient()
    const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'booking_fee_pence')
        .single()
    if (!data) return BOOKING_FEE_PENCE
    const parsed = parseInt(data.value, 10)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : BOOKING_FEE_PENCE
}

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

    // Re-geocode if postcode changed so spatial referee search stays accurate
    let geoLat: number | null = null
    let geoLng: number | null = null
    if (data.location_postcode !== undefined && data.location_postcode) {
        const geo = await geocodePostcode(data.location_postcode)
        if (geo) {
            geoLat = geo.lat
            geoLng = geo.lng
        }
    }

    // Core fields that should always exist
    const coreUpdateData: Record<string, unknown> = {}
    if (data.match_date !== undefined) coreUpdateData.match_date = data.match_date
    if (data.kickoff_time !== undefined) coreUpdateData.kickoff_time = data.kickoff_time + ':00'
    if (data.location_postcode !== undefined) coreUpdateData.location_postcode = data.location_postcode
    if (geoLat !== null && geoLng !== null) {
        coreUpdateData.latitude = geoLat
        coreUpdateData.longitude = geoLng
    }
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

    // Withdraw any active offers so they no longer appear in the referee's
    // "New Offers" / Feed badge. Without this, refs see a count that doesn't
    // match the visible list, because getMyOffers / count queries skip
    // soft-deleted bookings via the booking join.
    await supabase
        .from('booking_offers')
        .update({ status: 'withdrawn' })
        .eq('booking_id', bookingId)
        .in('status', ['sent', 'accepted_priced'])

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

/**
 * Mark a booking as completed by the calling user (coach or assigned ref).
 * Phase 2 dual-confirmation flow:
 *   - first to mark sets their timestamp; the OTHER side gets a nudge.
 *   - second to mark also sets booking.status = 'completed' and
 *     both_confirmed_at; both sides get a "release scheduled" notification.
 *
 * The cron at /api/cron/escrow-release reads both_confirmed_at and applies
 * the 48h cooling-off window before releasing escrow.
 *
 * All authz / status / dispute / kickoff checks live inside the
 * mark_booking_complete RPC (single transaction, FOR UPDATE lock on the
 * booking row to prevent races between concurrent clicks).
 */
export async function completeBooking(bookingId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // Pull the booking + escrow amount up-front so we can craft notifications
    // with the actual money figure, not just a generic "match completed".
    const { data: booking } = await supabase
        .from('bookings')
        .select('coach_id, escrow_amount_pence, ground_name, location_postcode, match_date, kickoff_time, assignments:booking_assignments(referee_id)')
        .eq('id', bookingId)
        .is('deleted_at', null)
        .single()

    if (!booking) {
        return { error: 'Booking not found' }
    }

    const assignments = Array.isArray(booking.assignments)
        ? booking.assignments
        : booking.assignments ? [booking.assignments] : []
    const refereeId = assignments[0]?.referee_id as string | undefined

    // Atomic mark via RPC. Returns the resulting state so we can drive
    // the notification copy correctly.
    const { data: rpcResult, error: rpcError } = await supabase.rpc('mark_booking_complete', {
        p_booking_id: bookingId,
    })

    if (rpcError) {
        Sentry.captureException(rpcError, {
            tags: { 'booking.flow': 'mark_complete' },
            user: { id: user.id },
            extra: { bookingId },
        })
        return { error: rpcError.message }
    }

    if (rpcResult?.error) {
        return { error: rpcResult.error }
    }

    const yourRole = rpcResult?.your_role as 'coach' | 'referee' | undefined
    const bothConfirmed = rpcResult?.both_confirmed === true
    const alreadyMarked = rpcResult?.already_marked === true

    // Notification logic — only fire on a state-changing call (not idempotent
    // re-clicks) so users don't get spammed.
    if (!alreadyMarked) {
        const venue = booking.ground_name || booking.location_postcode
        const escrowDisplay = booking.escrow_amount_pence != null
            ? `£${(booking.escrow_amount_pence / 100).toFixed(2)}`
            : 'the match fee'

        if (bothConfirmed) {
            // Second confirmer just clicked. Both parties are now confirmed —
            // escrow releases on the next cron tick (within 15 min).
            const otherUserId = yourRole === 'coach' ? refereeId : booking.coach_id
            if (otherUserId) {
                await createNotification({
                    userId: otherUserId,
                    title: 'Match Confirmed',
                    message: `Both parties have confirmed the match at ${venue}. ${escrowDisplay} is releasing — funds typically appear within 15 minutes.`,
                    type: 'success',
                    link: `/app/bookings/${bookingId}`,
                })
            }
        } else {
            // First confirmer. Nudge the other side to confirm.
            const otherUserId = yourRole === 'coach' ? refereeId : booking.coach_id
            const youLabel = yourRole === 'coach' ? 'The coach' : 'The referee'
            const ctaLabel = yourRole === 'coach' ? 'Confirm to release' : 'Confirm to receive'
            if (otherUserId) {
                await createNotification({
                    userId: otherUserId,
                    title: 'Confirm match completion',
                    message: `${youLabel} has confirmed the match at ${venue}. ${ctaLabel} ${escrowDisplay} — auto-release 48 hours after kickoff if no response.`,
                    type: 'warning',
                    link: `/app/bookings/${bookingId}`,
                })
            }
        }
    }

    revalidatePath(`/app/bookings/${bookingId}`)
    revalidatePath('/app/bookings')
    return { success: true, both_confirmed: bothConfirmed, your_role: yourRole, already_marked: alreadyMarked }
}

export async function acceptOffer(offerId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const validationError = validate(confirmPriceSchema, { offerId })
    if (validationError) {
        return { error: validationError }
    }

    // Get the offer to verify ownership and fetch booking details
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

    if (!offer.price_pence || offer.price_pence <= 0) {
        return { error: 'This offer has no valid price' }
    }

    // Record responded_at timestamp
    await supabase
        .from('booking_offers')
        .update({ responded_at: new Date().toISOString() })
        .eq('id', offerId)

    // Confirm booking atomically: accept offer → escrow hold → create assignment.
    // Platform booking fee is held alongside price_pence so the coach is charged
    // (price + fee) into escrow; on release the fee goes to the platform, not the ref.
    const platformFeePence = await getBookingFeePence()
    const { data: rpcResult, error: rpcError } = await supabase.rpc('confirm_booking', {
        p_offer_id: offerId,
        p_platform_fee_pence: platformFeePence,
    })

    if (rpcError) {
        return { error: 'Failed to confirm booking: ' + rpcError.message }
    }

    if (rpcResult?.error) {
        if (rpcResult.code === 'INSUFFICIENT_FUNDS') {
            return {
                error: `The coach doesn't have enough funds to cover this booking. Please ask them to top up their wallet.`,
                code: 'INSUFFICIENT_FUNDS',
            }
        }
        if (rpcResult.code === 'NO_WALLET') {
            return {
                error: 'The coach needs to set up their wallet before this booking can be confirmed.',
                code: 'NO_WALLET',
            }
        }
        return { error: rpcResult.error }
    }

    // --- Core booking is now atomically committed. Steps below are secondary ---

    // Withdraw other offers for this booking
    const { error: withdrawError } = await supabase
        .from('booking_offers')
        .update({ status: 'withdrawn' })
        .eq('booking_id', offer.booking_id)
        .neq('id', offerId)

    if (withdrawError) {
        console.error('Failed to withdraw competing offers:', withdrawError)
    }

    // Create or get a thread for communication
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
        } else {
            thread = newThread
        }
    }

    if (thread) {
        const { error: participantError } = await supabase
            .from('thread_participants')
            .upsert([
                { thread_id: thread.id, profile_id: offer.booking.coach_id },
                { thread_id: thread.id, profile_id: offer.referee_id },
            ], { onConflict: 'thread_id, profile_id' })

        if (participantError) {
            console.error('Failed to add thread participants:', participantError)
        }

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

    // Notify Coach that referee accepted
    const { data: refereeProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

    await createNotification({
        userId: offer.booking.coach_id,
        title: 'Booking Confirmed!',
        message: `${refereeProfile?.full_name || 'A referee'} has accepted your offer for ${offer.booking.ground_name || offer.booking.location_postcode}.`,
        type: 'success',
        link: `/app/bookings/${offer.booking_id}`
    })

    // Auto-remove availability slot
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
    revalidatePath('/app/offers')

    return { success: true, threadId: thread?.id }
}

// confirmPrice is no longer needed — referee acceptance now triggers
// confirmation directly via acceptOffer(). Kept as a no-op for safety
// in case any old UI code references it.
export async function confirmPrice(_offerId: string) {
    return { error: 'This action is no longer available. The referee now confirms the booking when accepting.' }
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
    const { data: offerData } = await supabase.from('booking_offers').select('booking:bookings(id, coach_id, ground_name, location_postcode)').eq('id', offerId).single()

    // Handle Supabase join sometimes returning array
    const booking = offerData?.booking ? (Array.isArray(offerData.booking) ? offerData.booking[0] : offerData.booking) : null

    if (booking) {
        await createNotification({
            userId: booking.coach_id,
            title: 'Offer Declined',
            message: `A referee declined your booking request for ${booking.ground_name || booking.location_postcode}.`,
            type: 'info',
            link: `/app/bookings/${booking.id}`,
        })
    }

    revalidatePath('/app/bookings')
    return { success: true }
}

/**
 * Coach confirms a referee-initiated "I'm Available" offer.
 * Sets the price (if not already set), runs the atomic confirm_booking RPC
 * which moves funds into escrow, marks the offer accepted, and creates a thread.
 * Returns the threadId so the caller can redirect to the messenger.
 */
export async function coachConfirmInterest(
    offerId: string,
    pricePounds: number,
): Promise<{ success?: boolean; threadId?: string; error?: string; code?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    if (!Number.isFinite(pricePounds) || pricePounds <= 0 || pricePounds > 500) {
        return { error: 'Enter a valid match fee (£1 — £500)' }
    }

    const { data: offer, error: offerError } = await supabase
        .from('booking_offers')
        .select('id, booking_id, referee_id, status, price_pence, booking:bookings(id, coach_id, ground_name, location_postcode, match_date, kickoff_time)')
        .eq('id', offerId)
        .single()

    if (offerError || !offer) {
        return { error: 'Offer not found' }
    }

    const booking = Array.isArray(offer.booking) ? offer.booking[0] : offer.booking
    if (!booking || booking.coach_id !== user.id) {
        return { error: 'Unauthorized' }
    }

    if (offer.status !== 'sent') {
        return { error: 'This offer is no longer pending' }
    }

    // Set the price on the offer (overwrite if previously null) so confirm_booking has a price.
    const pricePence = Math.round(pricePounds * 100)
    const { error: priceError } = await supabase
        .from('booking_offers')
        .update({ price_pence: pricePence })
        .eq('id', offerId)

    if (priceError) {
        return { error: 'Failed to set price: ' + priceError.message }
    }

    // Atomic confirm via RPC (handles escrow, assignment, booking status).
    // Platform booking fee is held on top so the ref's gross stays equal to price_pence.
    const platformFeePence = await getBookingFeePence()
    const { data: rpcResult, error: rpcError } = await supabase.rpc('confirm_booking', {
        p_offer_id: offerId,
        p_platform_fee_pence: platformFeePence,
    })

    if (rpcError) {
        return { error: 'Failed to confirm booking: ' + rpcError.message }
    }
    if (rpcResult?.error) {
        return { error: rpcResult.error, code: rpcResult.code }
    }

    // Withdraw competing offers
    await supabase
        .from('booking_offers')
        .update({ status: 'withdrawn' })
        .eq('booking_id', offer.booking_id)
        .neq('id', offerId)

    // Create / find thread and add participants (mirrors acceptOffer flow)
    let { data: thread } = await supabase
        .from('threads')
        .select('id')
        .eq('booking_id', offer.booking_id)
        .maybeSingle()

    if (!thread) {
        const { data: newThread } = await supabase
            .from('threads')
            .insert({
                booking_id: offer.booking_id,
                title: `Booking: ${booking.ground_name || booking.location_postcode}`,
            })
            .select('id')
            .single()
        thread = newThread ?? null
    }

    if (thread) {
        await supabase
            .from('thread_participants')
            .upsert([
                { thread_id: thread.id, profile_id: booking.coach_id },
                { thread_id: thread.id, profile_id: offer.referee_id },
            ], { onConflict: 'thread_id, profile_id' })

        await supabase
            .from('messages')
            .insert({
                thread_id: thread.id,
                sender_id: null,
                kind: 'system',
                body: 'Booking confirmed. Use chat to finalise details.',
            })
    }

    // Notify the referee that the coach accepted their availability
    await createNotification({
        userId: offer.referee_id,
        title: 'You\'re Booked In!',
        message: `The coach confirmed you for ${booking.ground_name || booking.location_postcode}. Open the chat to finalise details.`,
        type: 'success',
        link: thread ? `/app/messages/${thread.id}` : `/app/bookings/${offer.booking_id}`,
    })

    revalidatePath(`/app/bookings/${offer.booking_id}`)
    revalidatePath('/app/bookings')

    return { success: true, threadId: thread?.id }
}

/**
 * Coach declines a referee-initiated "I'm Available" offer.
 * Marks the offer 'withdrawn' and notifies the referee.
 */
export async function coachDeclineInterest(offerId: string): Promise<{ success?: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const { data: offer, error: offerError } = await supabase
        .from('booking_offers')
        .select('id, booking_id, referee_id, status, booking:bookings(coach_id, ground_name, location_postcode)')
        .eq('id', offerId)
        .single()

    if (offerError || !offer) {
        return { error: 'Offer not found' }
    }

    const booking = Array.isArray(offer.booking) ? offer.booking[0] : offer.booking
    if (!booking || booking.coach_id !== user.id) {
        return { error: 'Unauthorized' }
    }

    if (offer.status !== 'sent') {
        return { error: 'This offer is no longer pending' }
    }

    const { error } = await supabase
        .from('booking_offers')
        .update({ status: 'withdrawn', responded_at: new Date().toISOString() })
        .eq('id', offerId)

    if (error) {
        return { error: error.message }
    }

    await createNotification({
        userId: offer.referee_id,
        title: 'Availability Declined',
        message: `The coach declined your availability for ${booking.ground_name || booking.location_postcode}.`,
        type: 'info',
        link: `/app/feed`,
    })

    revalidatePath(`/app/bookings/${offer.booking_id}`)
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
    // Check both date-specific availability AND recurring weekly availability
    const matchDate = new Date(criteria.match_date + 'T00:00:00')
    const dayOfWeek = matchDate.getDay() // 0=Sunday, 6=Saturday (matches DB convention)

    const [dateAvailResult, weeklyAvailResult] = await Promise.all([
        supabase
            .from('referee_date_availability')
            .select('referee_id')
            .eq('date', criteria.match_date)
            .lte('start_time', kickoff)
            .gte('end_time', kickoff),
        supabase
            .from('referee_availability')
            .select('referee_id')
            .eq('day_of_week', dayOfWeek)
            .lte('start_time', kickoff)
            .gte('end_time', kickoff),
    ])

    if (dateAvailResult.error) {
        return { error: dateAvailResult.error.message }
    }

    // Merge referee IDs from both date-specific and weekly recurring availability
    const refereeIdSet = new Set<string>()
    for (const r of (dateAvailResult.data || [])) refereeIdSet.add(r.referee_id)
    for (const r of (weeklyAvailResult.data || [])) refereeIdSet.add(r.referee_id)

    // Also include referees with the general is_available toggle on,
    // so newly registered referees appear even before setting specific availability slots.
    const { data: generallyAvailable } = await supabase
        .from('referee_profiles')
        .select('profile_id')
        .eq('is_available', true)

    if (generallyAvailable) {
        for (const r of generallyAvailable) {
            refereeIdSet.add(r.profile_id)
        }
    }

    if (refereeIdSet.size === 0) {
        return { data: [] }
    }

    const refereeIds = Array.from(refereeIdSet)

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
        .eq('is_available', true)
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
                distance_km: null,
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

export async function searchRefereesForBooking(bookingId: string): Promise<{
    data?: RefereeSearchResult[],
    bookingFeePounds?: number | null,
    bookingFeedVisible?: boolean,
    error?: string,
}> {
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
    // Check both date-specific availability AND recurring weekly availability
    const matchDate = new Date(booking.match_date + 'T00:00:00')
    const dayOfWeek = matchDate.getDay() // 0=Sunday, 6=Saturday (matches DB convention)

    const [dateAvailResult, weeklyAvailResult] = await Promise.all([
        supabase
            .from('referee_date_availability')
            .select('referee_id')
            .eq('date', booking.match_date)
            .lte('start_time', kickoff)
            .gte('end_time', kickoff),
        supabase
            .from('referee_availability')
            .select('referee_id')
            .eq('day_of_week', dayOfWeek)
            .lte('start_time', kickoff)
            .gte('end_time', kickoff),
    ])

    if (dateAvailResult.error) {
        return { error: dateAvailResult.error.message }
    }

    // Merge referee IDs from both date-specific and weekly recurring availability
    const refereeIdSet = new Set<string>()
    for (const r of (dateAvailResult.data || [])) refereeIdSet.add(r.referee_id)
    for (const r of (weeklyAvailResult.data || [])) refereeIdSet.add(r.referee_id)

    // Also include referees who have the general is_available toggle on,
    // so newly registered referees appear even before setting specific date slots.
    const { data: generallyAvailable2 } = await supabase
        .from('referee_profiles')
        .select('profile_id')
        .eq('is_available', true)

    if (generallyAvailable2) {
        for (const r of generallyAvailable2) {
            refereeIdSet.add(r.profile_id)
        }
    }

    if (refereeIdSet.size === 0) {
        return { data: [] }
    }

    let refereeIds = Array.from(refereeIdSet)

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
    // If booking has coordinates, use spatial RPC for distance enrichment (not hard filtering)
    let spatialMap: Map<string, number> | null = null
    if (booking.latitude && booking.longitude) {
        const { data: spatialResults } = await supabase.rpc('find_referees_within_radius', {
            p_latitude: booking.latitude,
            p_longitude: booking.longitude,
            p_radius_km: 50,
        })
        if (spatialResults && spatialResults.length > 0) {
            spatialMap = new Map(
                (spatialResults as { profile_id: string; distance_km: number }[]).map(r => [r.profile_id, r.distance_km])
            )
        }
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
        .eq('is_available', true)
        .in('profile_id', refereeIds)

    // When no spatial data is available, filter by county instead
    if (!spatialMap && booking.county) {
        query = query.eq('county', booking.county)
    }

    // Apply Central Venue opt-in if needed
    if (booking.booking_type === 'central') {
        query = query.eq('central_venue_opt_in', true)
    }

    const { data: results, error } = await query

    if (error) return { error: error.message }

    // 4b. DBS enforcement: U16 and under require verified DBS — filter out non-verified referees
    const dbsRequired = requiresDBS(booking.age_group)
    const filteredResults = dbsRequired
        ? (results || []).filter((r: RefereeProfileQueryResult) => r.dbs_status === 'verified')
        : (results || [])

    // 5. Format and sort by match score (distance used internally for scoring only, not exposed)
    const formattedResults: RefereeSearchResult[] = (filteredResults as (RefereeProfileQueryResult & {
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
                distance_km: distKm,
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

    return {
        data: formattedResults,
        bookingFeePounds: booking.budget_pounds ?? null,
        // Match is discoverable on the referee feed only when geocoding succeeded —
        // find_bookings_near_referee filters `WHERE b.location IS NOT NULL`.
        bookingFeedVisible: booking.latitude != null && booking.longitude != null,
    }
}

export async function sendBookingRequest(
    bookingId: string,
    refereeId: string,
    matchFeePounds: number,
    refereeDistanceKm: number | null,
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    const rateLimitError = checkOfferRateLimit(user.id)
    if (rateLimitError) {
        return { error: rateLimitError }
    }

    // Validate match fee
    const validationError = validate(offerPriceSchema, { pricePounds: matchFeePounds })
    if (validationError) {
        return { error: validationError }
    }

    const matchFeePence = Math.round(matchFeePounds * 100)

    // Fetch travel cost rate from platform settings
    const { data: travelSetting } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'travel_cost_per_km_pence')
        .single()

    const costPerKmPence = travelSetting ? parseInt(travelSetting.value, 10) : 28
    const distanceKm = refereeDistanceKm && refereeDistanceKm > 0 ? refereeDistanceKm : 0
    const travelCostPence = Math.round(distanceKm * costPerKmPence)
    const totalPricePence = matchFeePence + travelCostPence

    // Verify user owns this booking and it's in a valid state
    const { data: bookingCheck, error: bookingCheckError } = await supabase
        .from('bookings')
        .select('coach_id, status, deleted_at, age_group')
        .eq('id', bookingId)
        .is('deleted_at', null)
        .single()

    if (bookingCheckError || !bookingCheck) return { error: 'Booking not found' }
    if (bookingCheck.coach_id !== user.id) return { error: 'Unauthorized' }
    if (!['pending', 'offered'].includes(bookingCheck.status)) {
        return { error: 'Cannot send offers for this booking' }
    }

    // DBS enforcement: U16 and under require a verified DBS check
    if (requiresDBS(bookingCheck.age_group)) {
        const { data: refereeProfile } = await supabase
            .from('referee_profiles')
            .select('dbs_status')
            .eq('profile_id', refereeId)
            .single()

        if (!refereeProfile || refereeProfile.dbs_status !== 'verified') {
            return { error: 'This referee does not have a verified DBS check, which is required for U16 and under matches.' }
        }
    }

    // 1. Create Offer with price breakdown
    const { error: offerError } = await supabase
        .from('booking_offers')
        .insert({
            booking_id: bookingId,
            referee_id: refereeId,
            status: 'sent',
            price_pence: totalPricePence,
            match_fee_pence: matchFeePence,
            travel_distance_km: distanceKm > 0 ? distanceKm : null,
            travel_cost_pence: travelCostPence > 0 ? travelCostPence : null,
            currency: 'GBP',
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

    // 3. Notify Referee with total price
    const totalPounds = (totalPricePence / 100).toFixed(2)
    const { data: booking } = await supabase.from('bookings').select('match_date, ground_name, location_postcode').eq('id', bookingId).single()

    if (booking) {
        await createNotification({
            userId: refereeId,
            title: 'New Offer: £' + totalPounds,
            message: `A coach has offered £${totalPounds} for a match on ${booking.match_date} at ${booking.ground_name || booking.location_postcode}.`,
            type: 'info',
            link: '/app/offers'
        })
    }

    revalidatePath(`/app/bookings/${bookingId}`)
    revalidatePath(`/app/bookings/${bookingId}/match`)
    revalidatePath('/app/bookings')

    return { success: true, travelCostPence, totalPricePence }
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
        .select('id, coach_id, status, ground_name, location_postcode, match_date')
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
    const ratingVenue = booking.ground_name || booking.location_postcode
    const ratingDate = new Date(booking.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    await createNotification({
        userId: refereeId,
        title: 'New Rating Received',
        message: `You received a ${input.rating}-star rating for your match at ${ratingVenue} on ${ratingDate}.`,
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
