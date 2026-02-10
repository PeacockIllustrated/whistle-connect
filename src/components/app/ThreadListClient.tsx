'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUnreadMessages } from '@/components/app/UnreadMessagesProvider'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, truncate } from '@/lib/utils'
import { MessageCircle } from 'lucide-react'

export interface ThreadListItem {
    id: string
    updated_at: string
    booking: {
        id: string
        ground_name: string | null
        location_postcode: string
        match_date: string
        status: string
    } | null
    other_participant: {
        id: string
        full_name: string
        avatar_url: string | null
    } | null
    last_message: {
        id: string
        body: string
        kind: string
        created_at: string
        sender_id: string | null
    } | null
    unread_count: number
}

interface ThreadListClientProps {
    initialThreads: ThreadListItem[]
    currentUserId: string
}

export function ThreadListClient({ initialThreads, currentUserId }: ThreadListClientProps) {
    const [threads, setThreads] = useState<ThreadListItem[]>(initialThreads)
    const { getThreadUnread, subscribeToNewMessages } = useUnreadMessages()

    // Sync with initial data when it changes (e.g. navigation)
    useEffect(() => {
        setThreads(initialThreads)
    }, [initialThreads])

    // Subscribe to new messages for live updates
    useEffect(() => {
        const unsubscribe = subscribeToNewMessages((newMsg) => {
            setThreads(prev => {
                const threadIndex = prev.findIndex(t => t.id === newMsg.thread_id)
                if (threadIndex === -1) return prev

                const updated = [...prev]
                const thread = { ...updated[threadIndex] }

                // Update the last message preview
                thread.last_message = {
                    id: newMsg.id,
                    body: newMsg.body,
                    kind: newMsg.kind,
                    created_at: newMsg.created_at,
                    sender_id: newMsg.sender_id,
                }
                thread.updated_at = newMsg.created_at

                // Remove from current position and move to top
                updated.splice(threadIndex, 1)
                updated.unshift(thread)

                return updated
            })
        })

        return unsubscribe
    }, [subscribeToNewMessages])

    if (threads.length === 0) {
        return (
            <EmptyState
                icon={
                    <MessageCircle className="w-12 h-12" strokeWidth={1.5} />
                }
                title="No messages yet"
                description="Messages will appear here when you have confirmed bookings with referees or coaches"
            />
        )
    }

    return (
        <div className="space-y-2">
            {threads.map((thread) => {
                const unreadCount = getThreadUnread(thread.id)

                return (
                    <Link
                        key={thread.id}
                        href={`/app/messages/${thread.id}`}
                        className="block card p-4 hover:shadow-md transition-shadow"
                    >
                        <div className="flex items-start gap-3">
                            {/* Avatar */}
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[var(--brand-primary)] relative overflow-hidden flex items-center justify-center text-white font-semibold">
                                {thread.other_participant?.avatar_url ? (
                                    <img
                                        src={thread.other_participant.avatar_url}
                                        alt={thread.other_participant.full_name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    thread.other_participant?.full_name?.charAt(0) || '?'
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="font-semibold truncate">
                                        {thread.other_participant?.full_name || 'Unknown'}
                                    </h3>
                                    {thread.last_message && (
                                        <span className="text-xs text-[var(--foreground-muted)] whitespace-nowrap">
                                            {new Date(thread.last_message.created_at).toLocaleDateString('en', {
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </span>
                                    )}
                                </div>

                                {/* Match reference */}
                                {thread.booking && (
                                    <p className="text-xs text-[var(--foreground-muted)]">
                                        {thread.booking.ground_name || thread.booking.location_postcode} &bull; {formatDate(thread.booking.match_date)}
                                    </p>
                                )}

                                {/* Last message preview */}
                                {thread.last_message && (
                                    <p className={`text-sm mt-1 truncate ${unreadCount > 0 ? 'font-medium text-[var(--foreground)]' : 'text-[var(--foreground-muted)]'}`}>
                                        {thread.last_message.kind === 'system' ? (
                                            <span className="italic">{truncate(thread.last_message.body, 50)}</span>
                                        ) : (
                                            truncate(thread.last_message.body, 50)
                                        )}
                                    </p>
                                )}
                            </div>

                            {/* Unread indicator */}
                            {unreadCount > 0 && (
                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-primary)] text-white text-xs font-bold flex items-center justify-center">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </div>
                            )}
                        </div>
                    </Link>
                )
            })}
        </div>
    )
}
