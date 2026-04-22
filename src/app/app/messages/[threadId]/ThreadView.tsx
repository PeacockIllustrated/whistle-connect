'use client'

import { useRef, useEffect } from 'react'
import { MessageWithSender } from '@/lib/types'
import { MessageList, MessageListHandle } from './MessageList'
import { MessageInput } from './MessageInput'
import { useUnreadMessages } from '@/components/app/UnreadMessagesProvider'
import { markThreadAsRead } from '@/app/app/messages/actions'

interface ThreadViewProps {
    initialMessages: MessageWithSender[]
    threadId: string
    currentUserId: string
    currentUserName: string
}

export function ThreadView({
    initialMessages,
    threadId,
    currentUserId,
    currentUserName,
}: ThreadViewProps) {
    const messageListRef = useRef<MessageListHandle>(null)
    const { markThreadRead } = useUnreadMessages()

    // Mark thread as read — both in the local unread context (so the badge
    // updates immediately) AND on the server (so the badge doesn't reappear
    // on reload because last_read_at never got written).
    useEffect(() => {
        markThreadRead(threadId)
        markThreadAsRead(threadId).catch(err => {
            // Non-blocking; worst case user sees the unread badge again on
            // reload and we try to write it next time they open the thread.
            console.error('Failed to persist thread-read timestamp:', err)
        })
    }, [threadId, markThreadRead])

    const handleOptimisticSend = (message: MessageWithSender) => {
        messageListRef.current?.addMessage(message)
    }

    const handleSendConfirmed = (tempId: string, realId: string) => {
        messageListRef.current?.replaceMessageId(tempId, realId)
    }

    const handleSendFailed = (tempId: string) => {
        messageListRef.current?.removeMessage(tempId)
    }

    return (
        <>
            <MessageList
                ref={messageListRef}
                initialMessages={initialMessages}
                threadId={threadId}
                currentUserId={currentUserId}
            />
            <MessageInput
                threadId={threadId}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                onOptimisticSend={handleOptimisticSend}
                onSendConfirmed={handleSendConfirmed}
                onSendFailed={handleSendFailed}
            />
        </>
    )
}
