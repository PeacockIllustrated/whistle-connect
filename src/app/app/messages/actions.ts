'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotification } from '@/lib/notifications'

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

    // Notify other participants
    const { data: otherParticipants } = await supabase
        .from('thread_participants')
        .select('profile_id')
        .eq('thread_id', threadId)
        .neq('profile_id', user.id)

    if (otherParticipants && otherParticipants.length > 0) {
        const notificationPromises = otherParticipants.map((p) =>
            createNotification({
                userId: p.profile_id,
                title: 'New Message',
                message: `You have a new message: ${body.substring(0, 50)}${body.length > 50 ? '...' : ''}`,
                type: 'info',
                link: `/app/messages/${threadId}`
            })
        )

        const results = await Promise.allSettled(notificationPromises)
        const failed = results.filter(r => r.status === 'rejected')
        if (failed.length > 0) {
            console.error(`Failed to send ${failed.length} message notifications:`, failed)
        }
    }

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

    // Batch fetch last messages for all threads in a single query
    // Using a raw query to get the last message per thread efficiently
    const { data: allLastMessages } = await supabase
        .from('messages')
        .select('*')
        .in('thread_id', threadIds)
        .order('created_at', { ascending: false })

    // Group messages by thread_id and take the first (most recent) for each
    const lastMessageByThread = new Map<string, typeof allLastMessages extends (infer T)[] | null ? T : never>()
    if (allLastMessages) {
        for (const msg of allLastMessages) {
            if (!lastMessageByThread.has(msg.thread_id)) {
                lastMessageByThread.set(msg.thread_id, msg)
            }
        }
    }

    // Batch fetch unread counts for all threads
    // We need to count messages created after last_read_at for each thread
    const { data: allMessages } = await supabase
        .from('messages')
        .select('thread_id, created_at')
        .in('thread_id', threadIds)

    // Calculate unread counts for each thread
    const unreadCountByThread = new Map<string, number>()
    if (allMessages) {
        for (const msg of allMessages) {
            const participation = participations.find(p => p.thread_id === msg.thread_id)
            const lastReadAt = participation?.last_read_at || '1970-01-01'
            if (new Date(msg.created_at) > new Date(lastReadAt)) {
                unreadCountByThread.set(
                    msg.thread_id,
                    (unreadCountByThread.get(msg.thread_id) || 0) + 1
                )
            }
        }
    }

    // Combine all data
    const threadsWithLastMessage = (threads || []).map((thread) => ({
        ...thread,
        last_message: lastMessageByThread.get(thread.id) || null,
        unread_count: unreadCountByThread.get(thread.id) || 0,
    }))

    return { data: threadsWithLastMessage, error: null }
}
