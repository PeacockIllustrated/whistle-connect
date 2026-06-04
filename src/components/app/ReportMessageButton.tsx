'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import { ReportDialog } from '@/components/app/ReportDialog'

interface ReportMessageButtonProps {
    messageId: string
    threadId: string
    reportedUserId: string
}

/**
 * Small per-message "report" affordance shown on incoming messages. Opens the
 * shared ReportDialog pre-targeted at this specific message (Apple 1.2).
 */
export function ReportMessageButton({ messageId, threadId, reportedUserId }: ReportMessageButtonProps) {
    const [open, setOpen] = useState(false)

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                aria-label="Report message"
                title="Report message"
                className="text-[var(--neutral-400)] hover:text-red-600 transition-colors"
            >
                <Flag className="w-3 h-3" />
            </button>
            <ReportDialog
                isOpen={open}
                onClose={() => setOpen(false)}
                title="Report message"
                target={{ messageId, threadId, reportedUserId }}
            />
        </>
    )
}
