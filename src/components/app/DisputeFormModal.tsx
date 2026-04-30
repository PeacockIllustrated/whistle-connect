'use client'

import { useState, useTransition } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { raiseDispute } from '@/app/app/disputes/actions'

interface DisputeFormModalProps {
    bookingId: string
    onClose: () => void
    onRaised: () => void
}

const CATEGORY_OPTIONS: Array<{ value: string; label: string; helper: string }> = [
    { value: 'match_did_not_happen', label: 'Match did not happen', helper: 'Cancelled, postponed, or never started' },
    { value: 'referee_no_show', label: 'Referee no-show', helper: 'Referee did not turn up' },
    { value: 'coach_no_show', label: 'Coach / team no-show', helper: 'Coach or team did not turn up' },
    { value: 'fee_dispute', label: 'Fee / payment dispute', helper: 'Disagreement over the agreed fee or extras' },
    { value: 'conduct_issue', label: 'Conduct issue', helper: 'Behaviour, abuse, or unprofessional conduct' },
    { value: 'service_quality', label: 'Service quality concern', helper: 'Refereeing standard or match management' },
    { value: 'safety_concern', label: 'Safety concern', helper: 'Safeguarding, injury, or unsafe environment' },
    { value: 'other', label: 'Other', helper: 'Something else not covered above' },
]

const OUTCOME_OPTIONS: Array<{ value: string; label: string; helper: string }> = [
    { value: 'refund_full', label: 'Full refund to coach', helper: 'Return the full booking fee — service was not provided' },
    { value: 'refund_partial', label: 'Partial refund', helper: 'Split the fee — admin to decide a fair share' },
    { value: 'release_full', label: 'Release full payment to referee', helper: 'Service was provided in full — pay the referee' },
    { value: 'mediation', label: 'I just want admin mediation', helper: 'Help us reach a resolution — outcome flexible' },
]

const REASON_MIN = 50
const REASON_MAX = 2000

export function DisputeFormModal({ bookingId, onClose, onRaised }: DisputeFormModalProps) {
    const [category, setCategory] = useState('')
    const [reason, setReason] = useState('')
    const [desiredOutcome, setDesiredOutcome] = useState('')
    const [incidentAt, setIncidentAt] = useState('')
    const [isPending, startTransition] = useTransition()
    const { showToast } = useToast()

    const reasonLength = reason.trim().length
    const tooShort = reasonLength < REASON_MIN
    const remaining = REASON_MAX - reasonLength

    const handleSubmit = () => {
        if (!category) {
            showToast({ message: 'Choose a category that best describes the issue', type: 'error' })
            return
        }
        if (tooShort) {
            showToast({ message: `Please describe the issue in at least ${REASON_MIN} characters`, type: 'error' })
            return
        }
        if (!desiredOutcome) {
            showToast({ message: 'Tell us what outcome you\'re seeking', type: 'error' })
            return
        }

        startTransition(async () => {
            // The schema accepts an ISO datetime with offset. <input type="datetime-local">
            // gives "YYYY-MM-DDTHH:mm" with no offset, so coerce via Date before sending.
            const incidentIso = incidentAt
                ? new Date(incidentAt).toISOString()
                : undefined

            const result = await raiseDispute({
                bookingId,
                category,
                reason: reason.trim(),
                desiredOutcome,
                incidentAt: incidentIso,
            })

            if (result.error) {
                showToast({ message: result.error, type: 'error' })
            } else {
                showToast({ message: 'Dispute raised. An admin will review it shortly.', type: 'success' })
                onRaised()
            }
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl safe-area-bottom">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-[var(--border-color)] p-4 flex items-center justify-between rounded-t-2xl z-10">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        <h2 className="font-bold text-base">Raise a dispute</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-[var(--neutral-100)] flex items-center justify-center hover:bg-[var(--neutral-200)] transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-4 space-y-5">
                    {/* Intro */}
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        Disputes pause the escrow release. An admin will review the details and either refund, release, or split the held amount based on the evidence.
                    </div>

                    {/* Category */}
                    <div>
                        <label className="text-sm font-semibold block mb-2">
                            What happened? <span className="text-red-600">*</span>
                        </label>
                        <div className="space-y-2">
                            {CATEGORY_OPTIONS.map(opt => (
                                <label
                                    key={opt.value}
                                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                                        category === opt.value
                                            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                                            : 'border-[var(--border-color)] hover:bg-[var(--neutral-50)]'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="dispute-category"
                                        value={opt.value}
                                        checked={category === opt.value}
                                        onChange={() => setCategory(opt.value)}
                                        className="mt-0.5 accent-[var(--brand-primary)]"
                                    />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium leading-tight">{opt.label}</p>
                                        <p className="text-xs text-[var(--foreground-muted)] mt-0.5">{opt.helper}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Incident timestamp (optional) */}
                    <div>
                        <label className="text-sm font-semibold block mb-1">
                            When did it happen? <span className="text-[var(--foreground-muted)] font-normal">(optional)</span>
                        </label>
                        <p className="text-xs text-[var(--foreground-muted)] mb-2">
                            Helps the admin pin down the timeline if it differs from kickoff.
                        </p>
                        <input
                            type="datetime-local"
                            value={incidentAt}
                            onChange={(e) => setIncidentAt(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                        />
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="text-sm font-semibold block mb-1">
                            Tell us what happened <span className="text-red-600">*</span>
                        </label>
                        <p className="text-xs text-[var(--foreground-muted)] mb-2">
                            Please include who was involved, what went wrong, and any context an admin would need to reach a fair decision.
                        </p>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
                            placeholder={`At least ${REASON_MIN} characters. The more detail, the faster admins can resolve this.`}
                            rows={6}
                            className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] resize-y"
                        />
                        <div className="mt-1 flex items-center justify-between text-xs">
                            <span className={tooShort ? 'text-red-600' : 'text-[var(--foreground-muted)]'}>
                                {tooShort
                                    ? `${REASON_MIN - reasonLength} more characters needed`
                                    : 'Minimum length met'}
                            </span>
                            <span className="text-[var(--foreground-muted)]">
                                {remaining} chars left
                            </span>
                        </div>
                    </div>

                    {/* Desired outcome */}
                    <div>
                        <label className="text-sm font-semibold block mb-2">
                            What outcome are you seeking? <span className="text-red-600">*</span>
                        </label>
                        <div className="space-y-2">
                            {OUTCOME_OPTIONS.map(opt => (
                                <label
                                    key={opt.value}
                                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                                        desiredOutcome === opt.value
                                            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                                            : 'border-[var(--border-color)] hover:bg-[var(--neutral-50)]'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="dispute-outcome"
                                        value={opt.value}
                                        checked={desiredOutcome === opt.value}
                                        onChange={() => setDesiredOutcome(opt.value)}
                                        className="mt-0.5 accent-[var(--brand-primary)]"
                                    />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium leading-tight">{opt.label}</p>
                                        <p className="text-xs text-[var(--foreground-muted)] mt-0.5">{opt.helper}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                        <p className="text-xs text-[var(--foreground-muted)] mt-2">
                            Admins can choose any resolution — your preference helps but doesn&apos;t bind them.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
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
                            disabled={!category || tooShort || !desiredOutcome}
                            variant="danger"
                            className="flex-1"
                        >
                            Submit dispute
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
