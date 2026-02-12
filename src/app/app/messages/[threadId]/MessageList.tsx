'use client'

import { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageWithSender, MessageKind } from '@/lib/types'
import { MessageBubble, MessageDateSeparator } from '@/components/app/MessageBubble'
import { markThreadAsRead } from '../actions'

export interface MessageListHandle {
    addMessage: (message: MessageWithSender) => void
    replaceMessageId: (tempId: string, realId: string) => void
    removeMessage: (id: string) => void
}

interface MessageListProps {
    initialMessages: MessageWithSender[]
    threadId: string
    currentUserId: string
}

export const MessageList = forwardRef<MessageListHandle, MessageListProps>(
    function MessageList({ initialMessages, threadId, currentUserId }, ref) {
        const [messages, setMessages] = useState<MessageWithSender[]>(initialMessages)
        const scrollRef = useRef<HTMLDivElement>(null)
        const supabase = createClient()

        const scrollToBottom = () => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            }
        }

        // Expose imperative methods for optimistic updates
        useImperativeHandle(ref, () => ({
            addMessage: (message: MessageWithSender) => {
                setMessages(prev => {
                    if (prev.some(m => m.id === message.id)) return prev
                    return [...prev, message]
                })
            },
            replaceMessageId: (tempId: string, realId: string) => {
                setMessages(prev =>
                    prev.map(m => m.id === tempId ? { ...m, id: realId } : m)
                )
            },
            removeMessage: (id: string) => {
                setMessages(prev => prev.filter(m => m.id !== id))
            },
        }))

        // Scroll to bottom when messages change
        useEffect(() => {
            scrollToBottom()
        }, [messages])

        useEffect(() => {
            // Scroll to bottom on initial load
            scrollToBottom()
        }, [])

        useEffect(() => {
            setMessages(initialMessages)
        }, [initialMessages])

        useEffect(() => {
            // Subscribe to new messages
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
                    async (payload: { new: Record<string, string> }) => {
                        const newMessage = payload.new as { id: string; thread_id: string; sender_id: string; kind: MessageKind; body: string; created_at: string }

                        // Fetch the sender's profile to match MessageWithSender type
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
                            // Check for exact ID match (handles normal dedup + replaced optimistic IDs)
                            if (prev.some((m: MessageWithSender) => m.id === messageWithSender.id)) return prev

                            // Fallback dedup: check for matching sender + body within 10 seconds
                            // This catches optimistic messages whose ID hasn't been replaced yet
                            if (newMessage.sender_id === currentUserId) {
                                const now = new Date(newMessage.created_at).getTime()
                                const isDuplicate = prev.some((m: MessageWithSender) =>
                                    m.sender_id === newMessage.sender_id &&
                                    m.body === newMessage.body &&
                                    Math.abs(new Date(m.created_at).getTime() - now) < 10000
                                )
                                if (isDuplicate) {
                                    // Replace the optimistic message with the real one
                                    return prev.map((m: MessageWithSender) =>
                                        m.sender_id === newMessage.sender_id &&
                                        m.body === newMessage.body &&
                                        Math.abs(new Date(m.created_at).getTime() - now) < 10000
                                            ? messageWithSender
                                            : m
                                    )
                                }
                            }

                            return [...prev, messageWithSender]
                        })

                        // Mark as read if the message is from someone else
                        if (newMessage.sender_id !== currentUserId) {
                            markThreadAsRead(threadId)
                        }
                    }
                )
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }, [threadId, supabase, currentUserId])

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
)
