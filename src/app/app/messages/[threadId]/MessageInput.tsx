'use client'

import { useState, useRef } from 'react'
import { sendMessage } from '../actions'
import { useToast } from '@/components/ui/Toast'
import { MessageWithSender } from '@/lib/types'

interface MessageInputProps {
    threadId: string
    currentUserId: string
    currentUserName: string
    onOptimisticSend?: (message: MessageWithSender, tempId: string) => void
    onSendConfirmed?: (tempId: string, realId: string) => void
    onSendFailed?: (tempId: string) => void
}

export function MessageInput({
    threadId,
    currentUserId,
    currentUserName,
    onOptimisticSend,
    onSendConfirmed,
    onSendFailed,
}: MessageInputProps) {
    const [message, setMessage] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)
    const { showToast } = useToast()

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const body = message.trim()
        if (!body) return

        // Generate a temporary ID for optimistic update
        const tempId = crypto.randomUUID()

        // Immediately add the message optimistically
        if (onOptimisticSend) {
            const optimisticMessage: MessageWithSender = {
                id: tempId,
                thread_id: threadId,
                sender_id: currentUserId,
                kind: 'user',
                body,
                created_at: new Date().toISOString(),
                sender: {
                    id: currentUserId,
                    full_name: currentUserName,
                    role: 'coach' as const,
                    phone: null,
                    postcode: null,
                    avatar_url: null,
                    created_at: '',
                    updated_at: '',
                },
            }
            onOptimisticSend(optimisticMessage, tempId)
        }

        // Clear input immediately
        setMessage('')
        inputRef.current?.focus()

        // Send in background
        try {
            const result = await sendMessage(threadId, body)
            if (result && 'error' in result) {
                console.error('Failed to send message:', result.error)
                onSendFailed?.(tempId)
                showToast({ message: `Failed to send: ${result.error}`, type: 'error' })
                return
            }
            // Replace temp ID with real ID so realtime dedup catches it
            if (result && 'messageId' in result && result.messageId) {
                onSendConfirmed?.(tempId, result.messageId)
            }
        } catch (error) {
            console.error('Failed to send message:', error)
            onSendFailed?.(tempId)
            showToast({ message: 'Failed to send message. Please try again.', type: 'error' })
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-t border-[var(--border-color)] bg-white safe-area-bottom"
        >
            <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2.5 bg-[var(--neutral-100)] rounded-full border-0 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            <button
                type="submit"
                disabled={!message.trim()}
                className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
            </button>
        </form>
    )
}
