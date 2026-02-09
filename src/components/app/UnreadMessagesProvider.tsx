'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface RealtimeMessage {
    id: string
    thread_id: string
    sender_id: string | null
    kind: string
    body: string
    created_at: string
}

interface UnreadMessagesContextValue {
    totalUnread: number
    getThreadUnread: (threadId: string) => number
    markThreadRead: (threadId: string) => void
    subscribeToNewMessages: (callback: (message: RealtimeMessage) => void) => () => void
}

const UnreadMessagesContext = createContext<UnreadMessagesContextValue>({
    totalUnread: 0,
    getThreadUnread: () => 0,
    markThreadRead: () => {},
    subscribeToNewMessages: () => () => {},
})

export function useUnreadMessages() {
    return useContext(UnreadMessagesContext)
}

interface ThreadData {
    threadId: string
    lastReadAt: string | null
}

interface UnreadMessagesProviderProps {
    userId: string
    initialThreadData: ThreadData[]
    initialUnreadCounts: Record<string, number>
    children: React.ReactNode
}

export function UnreadMessagesProvider({
    userId,
    initialThreadData,
    initialUnreadCounts,
    children,
}: UnreadMessagesProviderProps) {
    const supabase = createClient()

    // Track per-thread unread counts
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>(initialUnreadCounts)

    // Track last read timestamps per thread
    const lastReadRef = useRef<Record<string, string | null>>(
        Object.fromEntries(initialThreadData.map(t => [t.threadId, t.lastReadAt]))
    )

    // Track known thread IDs
    const threadIdsRef = useRef<Set<string>>(
        new Set(initialThreadData.map(t => t.threadId))
    )

    // Callback registry for new message subscribers
    const subscribersRef = useRef<Set<(message: RealtimeMessage) => void>>(new Set())

    const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0)

    const getThreadUnread = useCallback((threadId: string) => {
        return unreadCounts[threadId] || 0
    }, [unreadCounts])

    const markThreadRead = useCallback((threadId: string) => {
        lastReadRef.current[threadId] = new Date().toISOString()
        setUnreadCounts(prev => {
            if (!prev[threadId]) return prev
            const next = { ...prev }
            delete next[threadId]
            return next
        })
    }, [])

    const subscribeToNewMessages = useCallback((callback: (message: RealtimeMessage) => void) => {
        subscribersRef.current.add(callback)
        return () => {
            subscribersRef.current.delete(callback)
        }
    }, [])

    // Supabase Realtime subscription for new messages across all threads
    useEffect(() => {
        const channel = supabase
            .channel('global-messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                },
                (payload) => {
                    const newMsg = payload.new as RealtimeMessage

                    // Notify all subscribers (ThreadListClient, etc.)
                    subscribersRef.current.forEach(cb => cb(newMsg))

                    // Only increment unread if message is from someone else
                    if (newMsg.sender_id === userId) return

                    // Only count for known threads
                    if (!threadIdsRef.current.has(newMsg.thread_id)) {
                        // New thread we haven't seen — add it
                        threadIdsRef.current.add(newMsg.thread_id)
                        lastReadRef.current[newMsg.thread_id] = null
                    }

                    setUnreadCounts(prev => ({
                        ...prev,
                        [newMsg.thread_id]: (prev[newMsg.thread_id] || 0) + 1,
                    }))
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Global messages subscription active')
                }
            })

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userId, supabase])

    return (
        <UnreadMessagesContext.Provider
            value={{
                totalUnread,
                getThreadUnread,
                markThreadRead,
                subscribeToNewMessages,
            }}
        >
            {children}
        </UnreadMessagesContext.Provider>
    )
}
