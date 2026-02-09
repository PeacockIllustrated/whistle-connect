'use client'

import { useRef, useEffect } from 'react'
import { MessageWithSender } from '@/lib/types'
import { MessageList, MessageListHandle } from './MessageList'
import { MessageInput } from './MessageInput'
import { useUnreadMessages } from '@/components/app/UnreadMessagesProvider'

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

    // Mark thread as read in the unread context on mount
    useEffect(() => {
        markThreadRead(threadId)
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
