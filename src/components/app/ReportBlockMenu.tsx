'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Flag, Ban } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { REPORT_CATEGORIES, type ReportCategory } from '@/lib/validation'
import { reportContent, blockUser, unblockUser } from '@/app/app/messages/actions'

interface ReportBlockMenuProps {
    threadId: string
    otherUserId: string
    otherUserName: string
    initialBlocked: boolean
}

const CATEGORY_LABELS: Record<ReportCategory, string> = {
    spam: 'Spam',
    harassment: 'Harassment',
    hate_or_abuse: 'Hate or abuse',
    inappropriate: 'Inappropriate content',
    safety_concern: 'Safety concern',
    other: 'Other',
}

const REASON_MIN = 10
const REASON_MAX = 2000

export function ReportBlockMenu({ threadId, otherUserId, otherUserName, initialBlocked }: ReportBlockMenuProps) {
    const router = useRouter()
    const { showToast } = useToast()
    const [menuOpen, setMenuOpen] = useState(false)
    const [reportOpen, setReportOpen] = useState(false)
    const [blocked, setBlocked] = useState(initialBlocked)
    const [category, setCategory] = useState<ReportCategory | ''>('')
    const [reason, setReason] = useState('')
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

    const reasonLength = reason.trim().length
    const tooShort = reasonLength < REASON_MIN

    const handleSubmitReport = () => {
        if (!category) {
            showToast({ message: 'Choose a category that best describes the issue', type: 'error' })
            return
        }
        if (tooShort) {
            showToast({ message: `Please describe the issue in at least ${REASON_MIN} characters`, type: 'error' })
            return
        }

        startTransition(async () => {
            const result = await reportContent({
                category,
                reason: reason.trim(),
                threadId,
                reportedUserId: otherUserId,
            })
            if (result.error) {
                showToast({ message: result.error, type: 'error' })
            } else {
                showToast({ message: 'Report submitted. Our team will review it shortly.', type: 'success' })
                setReportOpen(false)
                setCategory('')
                setReason('')
            }
        })
    }

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

            <Modal isOpen={reportOpen} onClose={() => setReportOpen(false)} title={`Report ${otherUserName}`} size="md">
                <div className="space-y-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        Reports are sent to our moderation team. We review objectionable content and act on it, which may
                        include removing messages or suspending accounts.
                    </div>

                    <div>
                        <label htmlFor="report-category" className="text-sm font-semibold block mb-1">
                            What&apos;s the issue? <span className="text-red-600">*</span>
                        </label>
                        <select
                            id="report-category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value as ReportCategory | '')}
                            className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                        >
                            <option value="">Select a category…</option>
                            {REPORT_CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                    {CATEGORY_LABELS[c]}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="report-reason" className="text-sm font-semibold block mb-1">
                            Tell us more <span className="text-red-600">*</span>
                        </label>
                        <textarea
                            id="report-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
                            placeholder={`At least ${REASON_MIN} characters. Include what happened and any context.`}
                            rows={5}
                            className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] resize-y"
                        />
                        <div className="mt-1 flex items-center justify-between text-xs text-[var(--foreground-muted)]">
                            <span className={tooShort ? 'text-red-600' : undefined}>
                                {tooShort ? `${REASON_MIN - reasonLength} more characters needed` : 'Minimum length met'}
                            </span>
                            <span>{REASON_MAX - reasonLength} chars left</span>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button
                            onClick={() => setReportOpen(false)}
                            disabled={isPending}
                            className="flex-1 py-3 px-4 rounded-lg border border-[var(--border-color)] font-medium text-sm disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <Button
                            onClick={handleSubmitReport}
                            loading={isPending}
                            disabled={!category || tooShort}
                            variant="danger"
                            className="flex-1"
                        >
                            Submit report
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
