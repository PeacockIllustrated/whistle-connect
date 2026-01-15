'use client'

import { useState, useRef, useEffect } from 'react'
import { sendMessage } from '../actions'

interface MessageInputProps {
    threadId: string
}

export function MessageInput({ threadId }: MessageInputProps) {
    const [message, setMessage] = useState('')
    const [sending, setSending] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!message.trim() || sending) return

        setSending(true)
        try {
            const result = await sendMessage(threadId, message.trim())
            if (result && 'error' in result) {
                console.error('Failed to send message:', result.error)
                alert(`Error: ${result.error}`)
                return
            }
            setMessage('')
            inputRef.current?.focus()
        } catch (error) {
            console.error('Failed to send message:', error)
            alert('An unexpected error occurred while sending the message.')
        } finally {
            setSending(false)
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
                disabled={sending}
            />
            <button
                type="submit"
                disabled={!message.trim() || sending}
                className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
                {sending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                )}
            </button>
        </form>
    )
}
