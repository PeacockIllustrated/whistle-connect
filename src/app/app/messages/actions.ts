'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function sendMessage(threadId: string, body: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // Verify user is a participant
    const { data: participant } = await supabase
        .from('thread_participants')
        .select('*')
        .eq('thread_id', threadId)
        .eq('profile_id', user.id)
        .single()

    if (!participant) {
        return { error: 'Not a participant of this thread' }
    }

    // Insert message
    const { error } = await supabase
        .from('messages')
        .insert({
            thread_id: threadId,
            sender_id: user.id,
            kind: 'user',
            body,
        })

    if (error) {
        return { error: error.message }
    }

    // Update last_read_at for sender
    await supabase
        .from('thread_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('thread_id', threadId)
        .eq('profile_id', user.id)

    // Update thread updated_at
    await supabase
        .from('threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId)

    revalidatePath(`/app/messages/${threadId}`)
    revalidatePath('/app/messages')
    return { success: true }
}

export async function markThreadAsRead(threadId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    await supabase
        .from('thread_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('thread_id', threadId)
        .eq('profile_id', user.id)
}

export async function getThreads() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized', data: null }
    }

    const { data: participations } = await supabase
        .from('thread_participants')
        .select('thread_id, last_read_at')
        .eq('profile_id', user.id)

    if (!participations) {
        return { data: [], error: null }
    }

    const threadIds = participations.map(p => p.thread_id)

    const { data: threads } = await supabase
        .from('threads')
        .select(`
      *,
      booking:bookings(id, ground_name, location_postcode, match_date),
      participants:thread_participants(profile_id, profile:profiles(id, full_name, role))
    `)
        .in('id', threadIds)
        .order('updated_at', { ascending: false })

    // Get last message for each thread
    const threadsWithLastMessage = await Promise.all(
        (threads || []).map(async (thread) => {
            const { data: messages } = await supabase
                .from('messages')
                .select('*')
                .eq('thread_id', thread.id)
                .order('created_at', { ascending: false })
                .limit(1)

            // Get unread count
            const participation = participations.find(p => p.thread_id === thread.id)
            const lastReadAt = participation?.last_read_at || '1970-01-01'

            const { count } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('thread_id', thread.id)
                .gt('created_at', lastReadAt)

            return {
                ...thread,
                last_message: messages?.[0] || null,
                unread_count: count || 0,
            }
        })
    )

    return { data: threadsWithLastMessage, error: null }
}
