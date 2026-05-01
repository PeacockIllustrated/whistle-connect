'use server'

/**
 * Idempotent helper that guarantees a confirmed booking has a usable
 * messaging thread for the coach + assigned referee.
 *
 * Background: thread creation used to live inline in `acceptOffer` (and was
 * missing entirely from the SOS claim flow). Each insert was guarded with
 * a `console.error`-and-continue, so a transient failure during the
 * threads / thread_participants / first-message inserts could leave the
 * booking confirmed with no chat. Coach + ref then had no way to reach
 * each other from the booking detail page (the Message button only
 * renders when `thread.id` exists).
 *
 * This helper:
 *   - Uses the service-role client so RLS edge cases can't block the
 *     insert (the booking is already confirmed at this point — we already
 *     trust the caller's intent).
 *   - Re-runs cleanly. Upserting participants + skipping the system
 *     message if it already exists means we can call this multiple times
 *     for the same booking and converge on a working thread.
 *   - Returns the thread id on success or a clear error string on
 *     failure, so callers can surface "messaging temporarily unavailable,
 *     retry from the booking page" rather than redirect users into the
 *     void.
 */

import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/server'

export interface EnsureThreadParams {
    bookingId: string
    coachId: string
    refereeId: string
    /** Used in the thread title. Pass ground_name || location_postcode. */
    venueLabel: string
}

export interface EnsureThreadResult {
    threadId?: string
    error?: string
}

export async function ensureBookingThread(
    params: EnsureThreadParams,
): Promise<EnsureThreadResult> {
    const supabase = createAdminClient()
    if (!supabase) {
        return { error: 'Admin client unavailable — cannot create messaging thread.' }
    }

    const { bookingId, coachId, refereeId, venueLabel } = params

    if (!bookingId || !coachId || !refereeId) {
        return { error: 'Missing booking / coach / referee id for thread creation.' }
    }

    // 1. Find or create the thread row. One thread per booking_id.
    let threadId: string | undefined
    const { data: existing, error: findError } = await supabase
        .from('threads')
        .select('id')
        .eq('booking_id', bookingId)
        .maybeSingle()

    if (findError) {
        Sentry.captureException(findError, { tags: { 'msg.flow': 'ensure-thread.find' }, extra: { bookingId } })
        return { error: `Could not look up existing thread: ${findError.message}` }
    }

    if (existing) {
        threadId = existing.id
    } else {
        const { data: created, error: createError } = await supabase
            .from('threads')
            .insert({
                booking_id: bookingId,
                title: `Booking: ${venueLabel}`,
            })
            .select('id')
            .single()

        if (createError || !created) {
            Sentry.captureException(createError ?? new Error('Thread insert returned no row'), {
                tags: { 'msg.flow': 'ensure-thread.create' },
                extra: { bookingId, coachId, refereeId },
            })
            return { error: `Failed to create thread: ${createError?.message || 'no row returned'}` }
        }

        threadId = created.id
    }

    // 2. Upsert both participants. Idempotent thanks to the
    // (thread_id, profile_id) unique constraint.
    const { error: participantError } = await supabase
        .from('thread_participants')
        .upsert(
            [
                { thread_id: threadId, profile_id: coachId },
                { thread_id: threadId, profile_id: refereeId },
            ],
            { onConflict: 'thread_id,profile_id' },
        )

    if (participantError) {
        Sentry.captureException(participantError, {
            tags: { 'msg.flow': 'ensure-thread.participants' },
            extra: { bookingId, threadId, coachId, refereeId },
        })
        return { error: `Failed to add participants: ${participantError.message}` }
    }

    // 3. Insert the system "Booking confirmed" message only if no system
    // messages exist on this thread yet. Avoids spamming on retry.
    const { count: systemCount } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('thread_id', threadId)
        .eq('kind', 'system')

    if ((systemCount ?? 0) === 0) {
        const { error: messageError } = await supabase
            .from('messages')
            .insert({
                thread_id: threadId,
                sender_id: null,
                kind: 'system',
                body: 'Booking confirmed. Use chat to finalise details.',
            })

        if (messageError) {
            // Non-fatal — thread + participants exist, both parties can chat.
            // Just log to Sentry so we know the system message didn't land.
            Sentry.captureException(messageError, {
                tags: { 'msg.flow': 'ensure-thread.system-message' },
                extra: { bookingId, threadId },
                level: 'warning',
            })
        }
    }

    return { threadId }
}
