'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'
import { revalidatePath } from 'next/cache'
import { validate } from '@/lib/validation'
import { disputeSchema } from '@/lib/validation'
import type { Dispute } from '@/lib/types'

export async function raiseDispute(bookingId: string, reason: string): Promise<{
    success?: boolean
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const validationError = validate(disputeSchema, { bookingId, reason })
    if (validationError) {
        return { error: validationError }
    }

    const { data: booking } = await supabase
        .from('bookings')
        .select('id, coach_id, status, booking_assignments(referee_id)')
        .eq('id', bookingId)
        .eq('status', 'confirmed')
        .single()

    if (!booking) {
        return { error: 'Booking not found or not in confirmed status' }
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

        if (admins) {
            await Promise.allSettled(
                admins.map(admin =>
                    createNotification({
                        userId: admin.id,
                        title: 'New Dispute Raised',
                        message: `A dispute has been raised for a booking. Reason: ${reason.substring(0, 100)}`,
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
        .select('*, booking:bookings(id, coach_id, escrow_amount_pence, escrow_released_at)')
        .eq('id', disputeId)
        .eq('status', 'open')
        .single()

    if (!dispute) {
        return { error: 'Dispute not found or already resolved' }
    }

    const booking = dispute.booking as unknown as {
        id: string; coach_id: string; escrow_amount_pence: number; escrow_released_at: string | null
    }

    const adminSupabase = createAdminClient()
    if (!adminSupabase) {
        return { error: 'Admin client unavailable' }
    }

    if (resolution === 'resolved_coach') {
        const { error: rpcError } = await adminSupabase.rpc('escrow_refund', {
            p_booking_id: booking.id,
        })
        if (rpcError) {
            return { error: 'Failed to refund escrow: ' + rpcError.message }
        }
    } else if (resolution === 'resolved_referee') {
        const { error: rpcError } = await adminSupabase.rpc('escrow_release', {
            p_booking_id: booking.id,
            p_platform_fee_pence: 0,
        })
        if (rpcError) {
            return { error: 'Failed to release escrow: ' + rpcError.message }
        }
    } else if (resolution === 'resolved_split' && splitCoachPence !== undefined) {
        const { error: refundErr } = await adminSupabase.rpc('escrow_refund', {
            p_booking_id: booking.id,
            p_refund_pence: splitCoachPence,
        })
        if (refundErr) {
            return { error: 'Failed to process split refund: ' + refundErr.message }
        }

        const { error: releaseErr } = await adminSupabase.rpc('escrow_release', {
            p_booking_id: booking.id,
            p_platform_fee_pence: 0,
        })
        if (releaseErr) {
            return { error: 'Failed to process split release: ' + releaseErr.message }
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
