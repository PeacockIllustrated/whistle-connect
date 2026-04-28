'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/Modal'
import { coachConfirmInterest, coachDeclineInterest } from '@/app/app/bookings/actions'
import { Check, X } from 'lucide-react'

interface CoachInterestActionsProps {
    offerId: string
    refereeName: string
    /** Defaults to budget_pounds if set, otherwise empty */
    defaultPricePounds: number | null
}

export function CoachInterestActions({
    offerId,
    refereeName,
    defaultPricePounds,
}: CoachInterestActionsProps) {
    const router = useRouter()
    const { showToast } = useToast()
    const [price, setPrice] = useState<string>(defaultPricePounds ? String(defaultPricePounds) : '')
    const [showDecline, setShowDecline] = useState(false)
    const [isPending, startTransition] = useTransition()

    const handleAccept = () => {
        const num = parseFloat(price)
        if (isNaN(num) || num <= 0) {
            showToast({ message: 'Enter a match fee before confirming', type: 'error' })
            return
        }
        startTransition(async () => {
            const result = await coachConfirmInterest(offerId, num)
            if (result.error) {
                if (result.code === 'INSUFFICIENT_FUNDS') {
                    showToast({ message: 'Not enough funds in your wallet — top up first.', type: 'error' })
                } else if (result.code === 'NO_WALLET') {
                    showToast({ message: 'Set up your wallet before confirming.', type: 'error' })
                } else {
                    showToast({ message: result.error, type: 'error' })
                }
                return
            }
            showToast({ message: `Booking confirmed with ${refereeName}`, type: 'success' })
            if (result.threadId) {
                router.push(`/app/messages/${result.threadId}`)
            } else {
                router.refresh()
            }
        })
    }

    const handleDecline = () => {
        startTransition(async () => {
            const result = await coachDeclineInterest(offerId)
            if (result.error) {
                showToast({ message: result.error, type: 'error' })
                return
            }
            showToast({ message: 'Offer declined', type: 'info' })
            router.refresh()
        })
    }

    return (
        <>
            <div className="mt-2 space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                <p className="text-xs font-semibold text-amber-800">
                    {refereeName} is available — confirm to book them.
                </p>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)] font-medium">£</span>
                    <input
                        type="number"
                        inputMode="decimal"
                        placeholder="Match fee"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 bg-white border border-[var(--border-color)] rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        min="1"
                        max="500"
                        step="0.01"
                        disabled={isPending}
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={handleAccept}
                        disabled={isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                        <Check className="w-4 h-4" />
                        Accept
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowDecline(true)}
                        disabled={isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold text-red-600 bg-white border border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                        <X className="w-4 h-4" />
                        Decline
                    </button>
                </div>
            </div>

            <ConfirmDialog
                isOpen={showDecline}
                onClose={() => setShowDecline(false)}
                onConfirm={handleDecline}
                title="Decline this offer?"
                message={`${refereeName} will be notified that you're not booking them for this match.`}
                confirmLabel="Decline"
                variant="danger"
            />
        </>
    )
}
