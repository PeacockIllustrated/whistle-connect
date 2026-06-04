'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { REPORT_CATEGORIES, type ReportCategory } from '@/lib/validation'
import { reportContent } from '@/app/app/messages/actions'

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

interface ReportDialogProps {
    isOpen: boolean
    onClose: () => void
    title: string
    /** At least one of these must be set (enforced by reportSchema). */
    target: { messageId?: string; threadId?: string; reportedUserId?: string }
    onReported?: () => void
}

/**
 * Shared "report objectionable content" dialog (Apple Guideline 1.2). Used both
 * for reporting a user/thread (ReportBlockMenu) and a single message
 * (ReportMessageButton) — the only difference is the `target` ids passed in.
 */
export function ReportDialog({ isOpen, onClose, title, target, onReported }: ReportDialogProps) {
    const { showToast } = useToast()
    const [category, setCategory] = useState<ReportCategory | ''>('')
    const [reason, setReason] = useState('')
    const [isPending, startTransition] = useTransition()

    const reasonLength = reason.trim().length
    const tooShort = reasonLength < REASON_MIN

    function handleSubmit() {
        if (!category) {
            showToast({ message: 'Choose a category that best describes the issue', type: 'error' })
            return
        }
        if (tooShort) {
            showToast({ message: `Please describe the issue in at least ${REASON_MIN} characters`, type: 'error' })
            return
        }
        startTransition(async () => {
            const result = await reportContent({ category, reason: reason.trim(), ...target })
            if (result.error) {
                showToast({ message: result.error, type: 'error' })
            } else {
                showToast({ message: 'Report submitted. Our team will review it shortly.', type: 'success' })
                setCategory('')
                setReason('')
                onClose()
                onReported?.()
            }
        })
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
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
                        onClick={onClose}
                        disabled={isPending}
                        className="flex-1 py-3 px-4 rounded-lg border border-[var(--border-color)] font-medium text-sm disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <Button
                        onClick={handleSubmit}
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
    )
}
