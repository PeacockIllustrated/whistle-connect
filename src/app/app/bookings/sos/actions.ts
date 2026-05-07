'use server'

import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotification } from '@/lib/notifications'
import { ensureBookingThread } from '@/lib/messaging/ensure-thread'
import { geocodePostcode } from '@/lib/mapbox/geocode'
import { validate, bookingSchema } from '@/lib/validation'
import { toLocalDateString } from '@/lib/utils'
import { SOS_FEE_PENCE } from '@/lib/constants'

interface SOSBookingData {
    location_postcode: string
    kickoff_time: string
    age_group?: string
    format?: string
    budget_pounds?: number
    ground_name?: string
    notes?: string
    home_team?: string
    away_team?: string
}

export async function createSOSBooking(data: SOSBookingData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // Validate
    const today = toLocalDateString(new Date())
    const validationError = validate(bookingSchema, {
        match_date: today,
        kickoff_time: data.kickoff_time,
        location_postcode: data.location_postcode,
    })
    if (validationError) return { error: validationError }

    // ── Premium fee pre-flight check ──────────────────────────────────────
    // SOS broadcasts page every nearby available ref with an urgent push, so
    // we charge a small per-broadcast fee to gate spam / accidental presses.
    // We probe the wallet first so the user gets a clean error before any
    // side effect (booking insert, geocoding, broadcast) — much better UX
    // than charging then rolling back. The atomic charge_sos_fee RPC below
    // re-checks balance under FOR UPDATE so this isn't a TOCTOU bug; it's
    // just for friendlier UX in the common case.
    const { data: wallet } = await supabase
        .from('wallets')
        .select('balance_pence')
        .eq('user_id', user.id)
        .maybeSingle()

    const balancePence = wallet?.balance_pence ?? 0
    if (balancePence < SOS_FEE_PENCE) {
        return {
            error: `Broadcasting an SOS costs £${(SOS_FEE_PENCE / 100).toFixed(2)} but your wallet has £${(balancePence / 100).toFixed(2)}. Top up to continue.`,
            code: 'INSUFFICIENT_FUNDS',
            requiredPence: SOS_FEE_PENCE,
            currentBalancePence: balancePence,
        }
    }

    // Geocode the postcode
    let latitude: number | null = null
    let longitude: number | null = null
    const geo = await geocodePostcode(data.location_postcode)
    if (geo) {
        latitude = geo.lat
        longitude = geo.lng
    }

    // Create SOS booking
    const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
            coach_id: user.id,
            status: 'pending',
            match_date: today,
            kickoff_time: data.kickoff_time + ':00',
            location_postcode: data.location_postcode,
            ground_name: data.ground_name || null,
            age_group: data.age_group || null,
            format: data.format || null,
            budget_pounds: data.budget_pounds || null,
            notes: data.notes || null,
            home_team: data.home_team || null,
            away_team: data.away_team || null,
            is_sos: true,
            sos_expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
            latitude,
            longitude,
        })
        .select()
        .single()

    if (bookingError) return { error: bookingError.message }

    // ── Atomic premium-fee debit ──────────────────────────────────────────
    // Booking row exists; now charge the £1.99 fee under FOR UPDATE on the
    // wallet (migration 0154). If this fails (race with a concurrent debit
    // that just drained the wallet), we delete the booking we just inserted
    // so the user isn't left with a stuck SOS draft they didn't pay for.
    const { data: chargeResult, error: chargeRpcError } = await supabase.rpc('charge_sos_fee', {
        p_user_id: user.id,
        p_amount_pence: SOS_FEE_PENCE,
        p_booking_id: booking.id,
    })

    const chargeOk =
        !chargeRpcError &&
        (chargeResult as { success?: boolean; error?: string } | null)?.success === true

    if (!chargeOk) {
        // Roll back the booking insert. Best-effort — if the delete also fails,
        // a Sentry alert + reconcile sweep will surface the orphan.
        const { error: deleteError } = await supabase
            .from('bookings')
            .delete()
            .eq('id', booking.id)
            .eq('coach_id', user.id)

        if (deleteError) {
            Sentry.captureException(deleteError, {
                tags: { 'sos.fee': 'rollback-failed' },
                user: { id: user.id },
                extra: { bookingId: booking.id },
                level: 'fatal',
            })
        }

        const charge = chargeResult as { error?: string; code?: string } | null
        return {
            error:
                charge?.error ||
                chargeRpcError?.message ||
                'Could not charge the SOS fee. Please try again.',
            code: charge?.code,
        }
    }

    // Find nearby available referees and create offers + notify
    if (latitude && longitude) {
        const { data: nearbyReferees } = await supabase.rpc('find_referees_within_radius', {
            p_latitude: latitude,
            p_longitude: longitude,
            p_radius_km: 30,
        })

        if (nearbyReferees && nearbyReferees.length > 0) {
            // Filter to available referees only, limit to 15
            const availableRefs = nearbyReferees
                .filter((r: { is_available: boolean }) => r.is_available)
                .slice(0, 15)

            // Create offers for all matched referees
            if (availableRefs.length > 0) {
                const offers = availableRefs.map((r: { profile_id: string }) => ({
                    booking_id: booking.id,
                    referee_id: r.profile_id,
                    status: 'sent',
                }))

                await supabase.from('booking_offers').insert(offers)

                // Update booking to offered
                await supabase
                    .from('bookings')
                    .update({ status: 'offered' })
                    .eq('id', booking.id)

                // Notify all matched referees
                const notificationPromises = availableRefs.map((r: { profile_id: string; distance_km: number }) =>
                    createNotification({
                        userId: r.profile_id,
                        title: 'SOS - Referee Needed!',
                        message: `Urgent: A match needs a referee today at ${data.kickoff_time}! ${Math.round(r.distance_km)} km from you. First to accept gets it.`,
                        type: 'warning',
                        link: `/app/bookings/${booking.id}`,
                        urgency: 'sos',
                    })
                )

                await Promise.allSettled(notificationPromises)
            }
        }
    }

    revalidatePath('/app/bookings')
    return { success: true, bookingId: booking.id }
}

export async function claimSOSBooking(bookingId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // Call the atomic claim RPC
    const { data, error } = await supabase.rpc('claim_sos_booking', {
        p_booking_id: bookingId,
        p_referee_id: user.id,
    })

    if (error) return { error: error.message }

    const result = data as { success?: boolean; error?: string }
    if (result.error) return { error: result.error }

    // Get coach info to notify them
    const { data: booking } = await supabase
        .from('bookings')
        .select('coach_id, ground_name, location_postcode')
        .eq('id', bookingId)
        .single()

    const { data: referee } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

    let threadId: string | undefined
    if (booking) {
        // The claim_sos_booking RPC confirms the booking + creates an
        // assignment in one atomic step but does NOT create a chat thread.
        // Without this call, the coach + ref would land on the booking
        // page with the assignment visible but no Message button (the
        // button only renders when a thread row exists).
        const threadResult = await ensureBookingThread({
            bookingId,
            coachId: booking.coach_id,
            refereeId: user.id,
            venueLabel: booking.ground_name || booking.location_postcode,
        })
        threadId = threadResult.threadId
        if (threadResult.error) {
            Sentry.captureMessage(`claim-sos: thread creation degraded for booking ${bookingId}: ${threadResult.error}`, {
                level: 'warning',
                tags: { 'msg.flow': 'claim-sos' },
                extra: { bookingId, refereeId: user.id },
            })
        }

        await createNotification({
            userId: booking.coach_id,
            title: 'SOS Claimed!',
            message: `${referee?.full_name || 'A referee'} has claimed your SOS match at ${booking.ground_name || booking.location_postcode}. Open the chat to finalise details.`,
            type: 'success',
            link: threadId ? `/app/messages/${threadId}` : `/app/bookings/${bookingId}`,
            urgency: 'sos',
        })
    }

    revalidatePath(`/app/bookings/${bookingId}`)
    revalidatePath('/app/bookings')
    revalidatePath('/app/feed')
    revalidatePath('/app/messages')

    return { success: true, threadId }
}
