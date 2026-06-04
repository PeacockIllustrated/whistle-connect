'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Flag, Ban } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { ReportDialog } from '@/components/app/ReportDialog'
import { blockUser, unblockUser } from '@/app/app/messages/actions'

interface ReportBlockMenuProps {
    threadId: string
    otherUserId: string
    otherUserName: string
    initialBlocked: boolean
}

export function ReportBlockMenu({ threadId, otherUserId, otherUserName, initialBlocked }: ReportBlockMenuProps) {
    const router = useRouter()
    const { showToast } = useToast()
    const [menuOpen, setMenuOpen] = useState(false)
    const [reportOpen, setReportOpen] = useState(false)
    const [blocked, setBlocked] = useState(initialBlocked)
    const [isPending, startTransition] = useTransition()
    const menuRef = useRef<HTMLDivElement>(null)

    // Close the dropdown on outside click.
    useEffect(() => {
        if (!menuOpen) return
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [menuOpen])

    const handleToggleBlock = () => {
        startTransition(async () => {
            const result = blocked
                ? await unblockUser(otherUserId)
                : await blockUser(otherUserId)
            if (result.error) {
                showToast({ message: result.error, type: 'error' })
                return
            }
            const nowBlocked = !blocked
            setBlocked(nowBlocked)
            setMenuOpen(false)
            showToast({
                message: nowBlocked
                    ? `You have blocked ${otherUserName}.`
                    : `You have unblocked ${otherUserName}.`,
                type: 'success',
            })
            router.refresh()
        })
    }

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setMenuOpen((o) => !o)}
                className="p-2 hover:bg-[var(--neutral-100)] rounded-lg"
                aria-label="More options"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
            >
                <MoreVertical className="w-5 h-5" />
            </button>

            {menuOpen && (
                <div
                    role="menu"
                    className="absolute right-0 top-full mt-1 w-52 rounded-xl border border-[var(--border-color)] bg-[var(--background-elevated)] shadow-lg py-1 z-20"
                >
                    <button
                        role="menuitem"
                        onClick={() => {
                            setMenuOpen(false)
                            setReportOpen(true)
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--foreground)] hover:bg-[var(--neutral-100)]"
                    >
                        <Flag className="w-4 h-4 text-[var(--foreground-muted)]" />
                        Report
                    </button>
                    <button
                        role="menuitem"
                        onClick={handleToggleBlock}
                        disabled={isPending}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-[var(--neutral-100)] disabled:opacity-50"
                    >
                        <Ban className="w-4 h-4" />
                        {blocked ? `Unblock ${otherUserName}` : `Block ${otherUserName}`}
                    </button>
                </div>
            )}

            <ReportDialog
                isOpen={reportOpen}
                onClose={() => setReportOpen(false)}
                title={`Report ${otherUserName}`}
                target={{ threadId, reportedUserId: otherUserId }}
            />
        </div>
    )
}
