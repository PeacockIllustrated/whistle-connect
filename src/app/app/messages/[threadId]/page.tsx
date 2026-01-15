import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { MessageInput } from './MessageInput'
import { MessageList } from './MessageList'
import { markThreadAsRead } from '../actions'

export default async function ThreadPage({
    params,
}: {
    params: Promise<{ threadId: string }>
}) {
    const { threadId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login')
    }

    // Get thread with messages - use maybeSingle to avoid 404 on slight delays
    const { data: thread, error } = await supabase
        .from('threads')
        .select(`
      *,
      booking:bookings(id, ground_name, location_postcode, match_date, coach_id)
    `)
        .eq('id', threadId)
        .maybeSingle()

    if (error || !thread) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h1 className="text-xl font-bold mb-2">Conversation not found</h1>
                <p className="text-[var(--foreground-muted)] mb-6 max-w-xs">
                    We couldn't load this conversation. It might have been deleted or you might not have access.
                </p>
                <Link href="/app/messages" className="px-6 py-2 bg-[var(--brand-navy)] text-white rounded-lg font-medium">
                    Back to Messages
                </Link>
            </div>
        )
    }

    // Verify user is participant or involved in booking
    const { data: participation } = await supabase
        .from('thread_participants')
        .select('*')
        .eq('thread_id', threadId)
        .eq('profile_id', user.id)
        .maybeSingle()

    // If no participation record found, but they have access to the thread (they passed RLS),
    // they are likely the coach or referee who hasn't been added yet (rare case)
    if (!participation && thread.booking?.coach_id !== user.id) {
        // Double check if they are the referee for the booking
        const { data: isRef } = await supabase.rpc('check_is_booking_referee', {
            p_booking_id: thread.booking_id,
            p_user_id: user.id
        })

        if (!isRef) {
            return redirect('/app/messages')
        }
    }

    // Get participants
    const { data: participants } = await supabase
        .from('thread_participants')
        .select('profile:profiles(*)')
        .eq('thread_id', threadId)

    const otherParticipant = participants?.find(
        (p: any) => p.profile?.id !== user.id
    )?.profile as { id: string; full_name: string } | undefined

    // Get messages
    const { data: messages } = await supabase
        .from('messages')
        .select('*, sender:profiles(*)')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })

    // Mark as read
    await markThreadAsRead(threadId)

    return (
        <div className="flex flex-col h-[calc(100vh-var(--header-height)-var(--bottom-nav-height))]">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)] bg-white">
                <Link href="/app/messages" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>

                <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-[var(--brand-green)] flex items-center justify-center text-white font-semibold">
                        {otherParticipant?.full_name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="font-semibold truncate">
                            {otherParticipant?.full_name || 'Unknown'}
                        </h1>
                        {thread.booking && (
                            <p className="text-xs text-[var(--foreground-muted)] truncate">
                                {thread.booking.ground_name || thread.booking.location_postcode}
                            </p>
                        )}
                    </div>
                </div>

                {thread.booking && (
                    <Link
                        href={`/app/bookings/${thread.booking.id}`}
                        className="p-2 hover:bg-[var(--neutral-100)] rounded-lg"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </Link>
                )}
            </div>

            {/* Messages */}
            <MessageList
                initialMessages={messages || []}
                threadId={threadId}
                currentUserId={user.id}
            />

            {/* Input */}
            <MessageInput threadId={threadId} />
        </div>
    )
}
