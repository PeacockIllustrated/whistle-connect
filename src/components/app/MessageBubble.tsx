import { cn } from '@/lib/utils'
import { MessageWithSender } from '@/lib/types'
import { ReportMessageButton } from '@/components/app/ReportMessageButton'

export interface MessageBubbleProps {
    message: MessageWithSender
    isOwn: boolean
    showSender?: boolean
    className?: string
}

export function MessageBubble({ message, isOwn, showSender = false, className }: MessageBubbleProps) {
    const isSystem = message.kind === 'system'

    if (isSystem) {
        return (
            <div className={cn('flex justify-center my-3', className)}>
                <div className="px-3 py-1.5 bg-[var(--neutral-100)] rounded-full">
                    <p className="text-xs text-[var(--foreground-muted)] text-center">
                        {message.body}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div
            className={cn(
                'flex mb-2',
                isOwn ? 'justify-end' : 'justify-start',
                className
            )}
        >
            <div className={cn('max-w-[80%]')}>
                {/* Sender name */}
                {showSender && !isOwn && message.sender && (
                    <p className="text-xs text-[var(--foreground-muted)] mb-1 ml-3">
                        {message.sender.full_name}
                    </p>
                )}

                {/* Bubble */}
                <div
                    className={cn(
                        'px-4 py-2.5 rounded-2xl',
                        isOwn
                            ? 'bg-[var(--color-primary)] text-white rounded-br-md'
                            : 'bg-[var(--neutral-100)] text-[var(--foreground)] rounded-bl-md'
                    )}
                >
                    <p className="text-sm whitespace-pre-wrap break-words">
                        {message.body}
                    </p>
                </div>

                {/* Timestamp + (incoming only) per-message report control */}
                <div className={cn(
                    'flex items-center gap-1.5 mt-1',
                    isOwn ? 'justify-end mr-1' : 'ml-3'
                )}>
                    <p className="text-[10px] text-[var(--neutral-400)]">
                        {new Date(message.created_at).toLocaleTimeString('en', {
                            hour: 'numeric',
                            minute: '2-digit'
                        })}
                    </p>
                    {!isOwn && message.sender_id && (
                        <ReportMessageButton
                            messageId={message.id}
                            threadId={message.thread_id}
                            reportedUserId={message.sender_id}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}

// Date separator for message lists
export function MessageDateSeparator({ date }: { date: string }) {
    return (
        <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-[var(--border-color)]" />
            <span className="text-xs text-[var(--foreground-muted)] font-medium">
                {new Date(date).toLocaleDateString('en', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                })}
            </span>
            <div className="flex-1 h-px bg-[var(--border-color)]" />
        </div>
    )
}
