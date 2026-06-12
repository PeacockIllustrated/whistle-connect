'use server'

import * as Sentry from '@sentry/nextjs'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotification } from '@/lib/notifications'
import { ensureBookingThread } from '@/lib/messaging/ensure-thread'
import { geocodePostcode } from '@/lib/mapbox/geocode'
import { validate, bookingSchema } from '@/lib/validation'
import { toLocalDateString } from '@/lib/utils'
import { requiresDBS, refereeBlockedFromAgeGroup } from '@/lib/constants'

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

    // The £1.99 SOS fee is no longer charged upfront — it's bundled into the
    // booking's platform fee (alongside the £1.00 booking fee) when the
    // coach confirms a referee, so it's held in escrow with the rest of the
    // total and only realised once a referee actually accepts. See
    // acceptOffer / coachConfirmInterest for the platform-fee bump.

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

    // Find nearby available referees and create offers + notify
    if (latitude && longitude) {
        const { data: nearbyReferees } = await supabase.rpc('find_referees_within_radius', {
            p_latitude: latitude,
            p_longitude: longitude,
            p_radius_km: 30,
        })

        if (nearbyReferees && nearbyReferees.length > 0) {
            // Filter to available referees only
            const candidateRefs = nearbyReferees
                .filter((r: { is_available: boolean }) => r.is_available)

            // Safeguarding gate on the broadcast list — never invite a
            // consent-locked, age-ineligible, or (where required) non-DBS ref.
            // Mirrors the hard gate in claimSOSBooking; this just keeps
            // ineligible refs off the invite/notify list. Fails closed: a
            // referee with no gate row, or a NULL/unparseable DOB, is excluded.
            const candidateIds = candidateRefs.map((r: { profile_id: string }) => r.profile_id)
            const eligibleIds = new Set<string>()
            if (candidateIds.length > 0) {
                const { data: gateRows } = await supabase
                    .from('referee_profiles')
                    .select('profile_id, parental_consent_status, dbs_status, profile:profiles!inner(date_of_birth)')
                    .in('profile_id', candidateIds)

                const dbsRequired = requiresDBS(data.age_group)
                for (const g of (gateRows || [])) {
                    if (g.parental_consent_status === 'awaiting' || g.parental_consent_status === 'rejected') continue
                    if (dbsRequired && g.dbs_status !== 'verified') continue
                    const gProfile = Array.isArray(g.profile) ? g.profile[0] : g.profile
                    if (refereeBlockedFromAgeGroup(gProfile?.date_of_birth, data.age_group, today)) continue
                    eligibleIds.add(g.profile_id)
                }
            }

            // Limit to 15 eligible referees
            const availableRefs = candidateRefs
                .filter((r: { profile_id: string }) => eligibleIds.has(r.profile_id))
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

    // Safeguarding gate for the claiming referee — mirrors acceptOffer /
    // sendBookingRequest. claim_sos_booking confirms + assigns atomically with
    // no eligibility check, so a consent-locked or age-ineligible minor (or a
    // non-DBS ref) must be blocked HERE, before the claim. Fails closed: a
    // NULL/unparseable DOB is treated as blocked by refereeBlockedFromAgeGroup.
    const { data: claimBooking } = await supabase
        .from('bookings')
        .select('age_group, match_date')
        .eq('id', bookingId)
        .single()

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
        if (requiresDBS(claimBooking?.age_group) && refGate?.dbs_status !== 'verified') {
            return { error: 'A verified DBS check is required for this age group.' }
        }

        // Age eligibility at the MATCH DATE.
        const refProfile = refGate && (Array.isArray(refGate.profile) ? refGate.profile[0] : refGate.profile)
        if (refereeBlockedFromAgeGroup(refProfile?.date_of_birth, claimBooking?.age_group, claimBooking?.match_date)) {
            return { error: 'You are not eligible for this age group.' }
        }
    }

    // claim_sos_booking is service-role-only (migration 0162): it trusts its
    // p_referee_id argument and had no internal auth.uid() check, so it must
    // run via the admin client with the referee id pinned to the authenticated
    // caller (never a client-supplied value).
    const admin = createAdminClient()
    if (!admin) {
        return { error: 'SOS claims are temporarily unavailable. Please try again shortly.' }
    }
    const { data, error } = await admin.rpc('claim_sos_booking', {
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
