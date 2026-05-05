'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useUnreadMessages } from '@/components/app/UnreadMessagesProvider'
import { EmptyState } from '@/components/ui/EmptyState'
import { SwipeableCard } from '@/components/ui/SwipeableCard'
import { formatDate, truncate } from '@/lib/utils'
import { archiveThread, unarchiveThread } from '@/app/app/messages/actions'
import { MessageCircle, Archive, RotateCcw } from 'lucide-react'

export interface ThreadListItem {
    id: string
    updated_at: string
    /** Viewer's per-user archive timestamp from thread_participants. */
    archived_at?: string | null
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
    view?: 'active' | 'archived'
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ThreadListClient({ initialThreads, currentUserId: _currentUserId, view = 'active' }: ThreadListClientProps) {
    const router = useRouter()
    const [threads, setThreads] = useState<ThreadListItem[]>(initialThreads)
    const [, startTransition] = useTransition()
    const { getThreadUnread, subscribeToNewMessages } = useUnreadMessages()

    // Sync with initial data when it changes (e.g. navigation between tabs)
    useEffect(() => {
        setThreads(initialThreads)
    }, [initialThreads])

    // Subscribe to new messages for live updates — only matters on the
    // active view (archived threads stay in the archive even if a new
    // message lands; the user explicitly chose to hide them).
    useEffect(() => {
        if (view !== 'active') return

        const unsubscribe = subscribeToNewMessages((newMsg) => {
            setThreads((prev) => {
                const threadIndex = prev.findIndex((t) => t.id === newMsg.thread_id)
                if (threadIndex === -1) return prev

                const updated = [...prev]
                const thread = { ...updated[threadIndex] }

                thread.last_message = {
                    id: newMsg.id,
                    body: newMsg.body,
                    kind: newMsg.kind,
                    created_at: newMsg.created_at,
                    sender_id: newMsg.sender_id,
                }
                thread.updated_at = newMsg.created_at

                updated.splice(threadIndex, 1)
                updated.unshift(thread)

                return updated
            })
        })

        return unsubscribe
    }, [subscribeToNewMessages, view])

    async function handleArchive(threadId: string) {
        // Optimistic — drop the thread immediately so the swipe-out animation
        // settles to an empty space, then call the server. If it fails, we
        // re-fetch via router.refresh() which restores the row.
        setThreads((prev) => prev.filter((t) => t.id !== threadId))
        const result = await archiveThread(threadId)
        if (result?.error) {
            console.error('archiveThread failed:', result.error)
            startTransition(() => router.refresh())
        } else {
            // Refresh to update the count badges in the parent server component.
            startTransition(() => router.refresh())
        }
    }

    async function handleUnarchive(threadId: string) {
        setThreads((prev) => prev.filter((t) => t.id !== threadId))
        const result = await unarchiveThread(threadId)
        if (result?.error) {
            console.error('unarchiveThread failed:', result.error)
        }
        startTransition(() => router.refresh())
    }

    if (threads.length === 0) {
        return (
            <EmptyState
                icon={
                    view === 'archived' ? (
                        <Archive className="w-12 h-12" strokeWidth={1.5} />
                    ) : (
                        <MessageCircle className="w-12 h-12" strokeWidth={1.5} />
                    )
                }
                title={view === 'archived' ? 'No archived threads' : 'No messages yet'}
                description={
                    view === 'archived'
                        ? 'Archived conversations land here. You can restore any of them back to your active list.'
                        : 'Messages will appear here when you have confirmed bookings with referees or coaches'
                }
            />
        )
    }

    return (
        <div className="space-y-2">
            {threads.map((thread) => {
                const unreadCount = getThreadUnread(thread.id)
                const isArchived = view === 'archived'

                const card = (
                    <Link
                        href={`/app/messages/${thread.id}`}
                        className="block card p-4 hover:shadow-md transition-shadow"
                    >
                        <div className="flex items-start gap-3">
                            {/* Avatar */}
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[var(--brand-primary)] relative overflow-hidden flex items-center justify-center text-white font-semibold">
                                {thread.other_participant?.avatar_url ? (
                                    <Image
                                        src={thread.other_participant.avatar_url}
                                        alt={thread.other_participant.full_name}
                                        width={48}
                                        height={48}
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

                                {thread.booking && (
                                    <p className="text-xs text-[var(--foreground-muted)]">
                                        {thread.booking.ground_name || thread.booking.location_postcode} &bull; {formatDate(thread.booking.match_date)}
                                    </p>
                                )}

                                {thread.last_message && (
                                    <p className={`text-sm mt-1 truncate ${unreadCount > 0 && !isArchived ? 'font-medium text-[var(--foreground)]' : 'text-[var(--foreground-muted)]'}`}>
                                        {thread.last_message.kind === 'system' ? (
                                            <span className="italic">{truncate(thread.last_message.body, 50)}</span>
                                        ) : (
                                            truncate(thread.last_message.body, 50)
                                        )}
                                    </p>
                                )}

                                {isArchived && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            handleUnarchive(thread.id)
                                        }}
                                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] hover:underline"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        Restore
                                    </button>
                                )}
                            </div>

                            {/* Unread indicator (active view only) */}
                            {!isArchived && unreadCount > 0 && (
                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-primary)] text-white text-xs font-bold flex items-center justify-center">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </div>
                            )}
                        </div>
                    </Link>
                )

                // Active threads support swipe-to-archive (mirrors BookingCard).
                // Archived threads use the inline "Restore" button instead — no
                // swipe wrapping so the row reads as obviously inert until acted on.
                if (isArchived) {
                    return <div key={thread.id}>{card}</div>
                }

                return (
                    <SwipeableCard
                        key={thread.id}
                        onArchive={() => handleArchive(thread.id)}
                        actionLabel="Archive"
                    >
                        {card}
                    </SwipeableCard>
                )
            })}
        </div>
    )
}
