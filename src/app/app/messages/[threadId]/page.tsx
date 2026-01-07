import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { MessageBubble, MessageDateSeparator } from '@/components/app/MessageBubble'
import { formatDate } from '@/lib/utils'
import { MessageInput } from './MessageInput'
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

    // Get thread with messages
    const { data: thread, error } = await supabase
        .from('threads')
        .select(`
      *,
      booking:bookings(id, ground_name, location_postcode, match_date)
    `)
        .eq('id', threadId)
        .single()

    if (error || !thread) {
        notFound()
    }

    // Verify user is participant
    const { data: participation } = await supabase
        .from('thread_participants')
        .select('*')
        .eq('thread_id', threadId)
        .eq('profile_id', user.id)
        .single()

    if (!participation) {
        notFound()
    }

    // Get participants
    const { data: participants } = await supabase
        .from('thread_participants')
        .select('profile:profiles(*)')
        .eq('thread_id', threadId)

    const otherParticipant = participants?.find(
        (p: any) => p.profile.id !== user.id
    )?.profile

    // Get messages
    const { data: messages } = await supabase
        .from('messages')
        .select('*, sender:profiles(*)')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })

    // Mark as read
    await markThreadAsRead(threadId)

    // Group messages by date
    const groupedMessages: { date: string; messages: any[] }[] = []
    let currentDate = ''

    messages?.forEach((message) => {
        const messageDate = new Date(message.created_at).toDateString()
        if (messageDate !== currentDate) {
            currentDate = messageDate
            groupedMessages.push({ date: message.created_at, messages: [] })
        }
        groupedMessages[groupedMessages.length - 1].messages.push(message)
    })

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
            <div className="flex-1 overflow-y-auto px-4 py-4">
                {groupedMessages.length > 0 ? (
                    groupedMessages.map((group, groupIndex) => (
                        <div key={groupIndex}>
                            <MessageDateSeparator date={group.date} />
                            {group.messages.map((message) => (
                                <MessageBubble
                                    key={message.id}
                                    message={message}
                                    isOwn={message.sender_id === user.id}
                                    showSender={message.sender_id !== user.id && message.kind === 'user'}
                                />
                            ))}
                        </div>
                    ))
                ) : (
                    <div className="flex items-center justify-center h-full text-[var(--foreground-muted)] text-sm">
                        No messages yet. Start the conversation!
                    </div>
                )}
            </div>

            {/* Input */}
            <MessageInput threadId={threadId} />
        </div>
    )
}
