'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageWithSender } from '@/lib/types'
import { MessageBubble, MessageDateSeparator } from '@/components/app/MessageBubble'
import { markThreadAsRead } from '../actions'

interface MessageListProps {
    initialMessages: MessageWithSender[]
    threadId: string
    currentUserId: string
}

export function MessageList({ initialMessages, threadId, currentUserId }: MessageListProps) {
    const [messages, setMessages] = useState<MessageWithSender[]>(initialMessages)
    const scrollRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()

    useEffect(() => {
        // Scroll to bottom on initial load
        scrollToBottom()
    }, [])

    useEffect(() => {
        setMessages(initialMessages)
    }, [initialMessages])

    useEffect(() => {
        // Subscribe to new messages
        console.log('Setting up subscription for thread:', threadId)
        const channel = supabase
            .channel(`thread:${threadId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `thread_id=eq.${threadId}`,
                },
                async (payload: any) => {
                    console.log('Received payload:', payload)
                    const newMessage = payload.new as any

                    // Fetch the sender's profile to match MessageWithSender type
                    // This is necessary because the Realtime payload doesn't include joined data
                    const { data: sender } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', newMessage.sender_id)
                        .single()

                    const messageWithSender: MessageWithSender = {
                        ...newMessage,
                        sender: sender || undefined
                    }

                    setMessages((prev: MessageWithSender[]) => {
                        // Avoid duplicates
                        if (prev.some((m: MessageWithSender) => m.id === messageWithSender.id)) return prev
                        return [...prev, messageWithSender]
                    })

                    // Mark as read if the message is from someone else
                    if (newMessage.sender_id !== currentUserId) {
                        markThreadAsRead(threadId)
                    }
                }
            )
            .subscribe((status) => {
                console.log('Subscription status:', status)
            })

        return () => {
            supabase.removeChannel(channel)
        }
    }, [threadId, supabase])

    // Scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }

    // Group messages by date
    const groupedMessages: { date: string; messages: MessageWithSender[] }[] = []
    let currentDate = ''

    messages.forEach((message: MessageWithSender) => {
        const messageDate = new Date(message.created_at).toDateString()
        if (messageDate !== currentDate) {
            currentDate = messageDate
            groupedMessages.push({ date: message.created_at, messages: [] })
        }
        groupedMessages[groupedMessages.length - 1].messages.push(message)
    })

    return (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            {groupedMessages.length > 0 ? (
                groupedMessages.map((group, groupIndex) => (
                    <div key={groupIndex}>
                        <MessageDateSeparator date={group.date} />
                        {group.messages.map((message) => (
                            <MessageBubble
                                key={message.id}
                                message={message}
                                isOwn={message.sender_id === currentUserId}
                                showSender={message.sender_id !== currentUserId && message.kind === 'user'}
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
    )
}
