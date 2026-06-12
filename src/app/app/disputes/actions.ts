'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'
import { revalidatePath } from 'next/cache'
import { validate } from '@/lib/validation'
import { disputeSchema } from '@/lib/validation'
import { BOOKING_FEE_PENCE, SOS_FEE_PENCE } from '@/lib/constants'
import type { Dispute } from '@/lib/types'

/** Read the current platform booking fee from settings, falling back to the constant. */
async function readPlatformFeePence(): Promise<number> {
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

/** Human-readable label for each category — kept server-side so the
 *  admin notification email + the admin UI both render consistently. */
const CATEGORY_LABELS: Record<string, string> = {
    match_did_not_happen: 'Match did not happen',
    referee_no_show: 'Referee no-show',
    coach_no_show: 'Coach / team no-show',
    fee_dispute: 'Fee / payment dispute',
    conduct_issue: 'Conduct issue',
    service_quality: 'Service quality concern',
    safety_concern: 'Safety concern',
    other: 'Other',
}

export interface RaiseDisputeInput {
    bookingId: string
    category: string
    reason: string
    desiredOutcome: string
    incidentAt?: string
}

export async function raiseDispute(input: RaiseDisputeInput): Promise<{
    success?: boolean
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const validationError = validate(disputeSchema, input)
    if (validationError) {
        return { error: validationError }
    }

    const { bookingId, category, reason, desiredOutcome, incidentAt } = input

    const { data: booking } = await supabase
        .from('bookings')
        .select('id, coach_id, status, both_confirmed_at, escrow_released_at, ground_name, location_postcode, home_team, away_team, match_date, kickoff_time, booking_assignments(referee_id)')
        .eq('id', bookingId)
        .in('status', ['confirmed', 'completed'])
        .single()

    if (!booking) {
        return { error: 'Booking not found or no longer disputable' }
    }

    if (booking.escrow_released_at) {
        return { error: 'Cannot dispute — payment has already been released' }
    }

    const assignment = (booking.booking_assignments as unknown as { referee_id: string }[])[0]
    const isCoach = booking.coach_id === user.id
    const isReferee = assignment?.referee_id === user.id

    if (!isCoach && !isReferee) {
        return { error: 'You are not involved in this booking' }
    }

    const { data: existing } = await supabase
        .from('disputes')
        .select('id')
        .eq('booking_id', bookingId)
        .maybeSingle()

    if (existing) {
        return { error: 'A dispute has already been raised for this booking' }
    }

    const { error: insertError } = await supabase
        .from('disputes')
        .insert({
            booking_id: bookingId,
            raised_by: user.id,
            category,
            desired_outcome: desiredOutcome,
            incident_at: incidentAt && incidentAt.length > 0 ? incidentAt : null,
            reason,
        })

    if (insertError) {
        return { error: insertError.message }
    }

    const adminSupabase = createAdminClient()
    if (adminSupabase) {
        const { data: admins } = await adminSupabase
            .from('profiles')
            .select('id')
            .eq('role', 'admin')

        const venue = booking.ground_name || booking.location_postcode
        const categoryLabel = CATEGORY_LABELS[category] || category
        const role = isCoach ? 'coach' : 'referee'
        const reasonExcerpt = reason.length > 150 ? reason.substring(0, 150) + '…' : reason

        // Build a booking identifier admins can pattern-match on at a glance.
        // Prefer team names when set, fall back to date + venue.
        const bookingLabel = booking.home_team && booking.away_team
            ? `${booking.home_team} v ${booking.away_team}`
            : `${new Date(booking.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} at ${venue}`

        if (admins) {
            await Promise.allSettled(
                admins.map(admin =>
                    createNotification({
                        userId: admin.id,
                        title: `Dispute (${categoryLabel}) — ${bookingLabel}`,
                        message: `A ${role} raised a dispute for the match at ${venue}. ${reasonExcerpt}`,
                        type: 'warning',
                        link: '/app/disputes',
                    })
                )
            )
        }
    }

    revalidatePath('/app/disputes')
    revalidatePath(`/app/bookings/${bookingId}`)
    return { success: true }
}

export async function getDisputes(): Promise<{ data?: Dispute[]; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const { data, error } = await supabase
        .from('disputes')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        return { error: error.message }
    }

    return { data: data ?? [] }
}

export async function resolveDispute(
    disputeId: string,
    resolution: 'resolved_coach' | 'resolved_referee' | 'resolved_split',
    adminNotes: string,
    splitCoachPence?: number
): Promise<{ success?: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return { error: 'Only admins can resolve disputes' }
    }

    if (!adminNotes || adminNotes.length < 5) {
        return { error: 'Please provide a reason for the resolution' }
    }

    const { data: dispute } = await supabase
        .from('disputes')
        .select('*, booking:bookings(id, coach_id, escrow_amount_pence, escrow_released_at, is_sos)')
        .eq('id', disputeId)
        .eq('status', 'open')
        .single()

    if (!dispute) {
        return { error: 'Dispute not found or already resolved' }
    }

    const booking = dispute.booking as unknown as {
        id: string; coach_id: string; escrow_amount_pence: number; escrow_released_at: string | null; is_sos: boolean | null
    }

    const adminSupabase = createAdminClient()
    if (!adminSupabase) {
        return { error: 'Admin client unavailable' }
    }

    // SOS bookings pooled the £1.99 premium into the platform fee at confirm
    // time (see confirm_booking call in bookings/actions.ts). Mirror that here
    // so the platform retains the premium on release, exactly as the
    // escrow-release cron does — otherwise it leaks to the referee.
    const releaseFeePence = (await readPlatformFeePence()) + (booking.is_sos ? SOS_FEE_PENCE : 0)

    if (resolution === 'resolved_coach') {
        // Full refund to coach — they get the booking fee back too since no service was rendered.
        // escrow_refund returns logical failures ('No escrow to refund' etc.) as a
        // SUCCESSFUL call with a JSON error body — check data?.error too, else a
        // failed money move gets silently marked resolved.
        const { data, error: rpcError } = await adminSupabase.rpc('escrow_refund', {
            p_booking_id: booking.id,
        })
        if (rpcError || data?.error) {
            return { error: 'Failed to refund escrow: ' + (rpcError?.message || data?.error) }
        }
    } else if (resolution === 'resolved_referee') {
        // Ref takes the gross; platform retains its booking fee (+ SOS premium).
        const { data, error: rpcError } = await adminSupabase.rpc('escrow_release', {
            p_booking_id: booking.id,
            p_platform_fee_pence: releaseFeePence,
        })
        if (rpcError || data?.error) {
            return { error: 'Failed to release escrow: ' + (rpcError?.message || data?.error) }
        }
    } else if (resolution === 'resolved_split' && splitCoachPence !== undefined) {
        // Bound the split: the coach refund must be strictly within the escrow,
        // otherwise escrow_refund would over-refund (or no-op on 0).
        if (
            !Number.isInteger(splitCoachPence) ||
            splitCoachPence <= 0 ||
            splitCoachPence >= booking.escrow_amount_pence
        ) {
            return { error: 'Split amount must be between £0.01 and the full escrow amount' }
        }

        const { data: refundData, error: refundErr } = await adminSupabase.rpc('escrow_refund', {
            p_booking_id: booking.id,
            p_refund_pence: splitCoachPence,
        })
        if (refundErr || refundData?.error) {
            return { error: 'Failed to process split refund: ' + (refundErr?.message || refundData?.error) }
        }

        // The remaining escrow still includes the booking fee (+ SOS premium) — retain it on release.
        const { data: releaseData, error: releaseErr } = await adminSupabase.rpc('escrow_release', {
            p_booking_id: booking.id,
            p_platform_fee_pence: releaseFeePence,
        })
        if (releaseErr || releaseData?.error) {
            return { error: 'Failed to process split release: ' + (releaseErr?.message || releaseData?.error) }
        }
    }

    await adminSupabase
        .from('disputes')
        .update({
            status: resolution,
            admin_notes: adminNotes,
            admin_user_id: user.id,
            resolved_at: new Date().toISOString(),
        })
        .eq('id', disputeId)

    await adminSupabase
        .from('bookings')
        .update({ status: resolution === 'resolved_coach' ? 'cancelled' : 'completed' })
        .eq('id', booking.id)

    revalidatePath('/app/disputes')
    revalidatePath(`/app/bookings/${booking.id}`)
    return { success: true }
}
