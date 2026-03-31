'use client'

import { useState } from 'react'
import { createTopUpSession } from '@/app/app/wallet/actions'
import { calculateChargeAmount } from '@/lib/stripe/config'

const PRESET_AMOUNTS = [10, 20, 50]

interface TopUpModalProps {
    open: boolean
    onClose: () => void
    prefillAmount?: number
}

export default function TopUpModal({ open, onClose, prefillAmount }: TopUpModalProps) {
    const [amount, setAmount] = useState<number | null>(prefillAmount ?? null)
    const [customAmount, setCustomAmount] = useState(prefillAmount ? '' : '')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    if (!open) return null

    const effectiveAmount = amount ?? (customAmount ? parseFloat(customAmount) : null)
    const isValid = effectiveAmount !== null && effectiveAmount >= 5 && effectiveAmount <= 500

    const feeInfo = effectiveAmount && effectiveAmount >= 5
        ? calculateChargeAmount(Math.round(effectiveAmount * 100))
        : null

    async function handleSubmit() {
        if (!effectiveAmount || !isValid) return
        setLoading(true)
        setError(null)

        const result = await createTopUpSession(effectiveAmount)

        if (result.error) {
            setError(result.error)
            setLoading(false)
            return
        }

        if (result.url) {
            window.location.href = result.url
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div
                className="w-full max-w-sm rounded-xl bg-card border shadow-lg p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Add Funds</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">
                        &times;
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {PRESET_AMOUNTS.map((preset) => (
                        <button
                            key={preset}
                            onClick={() => { setAmount(preset); setCustomAmount('') }}
                            className={`rounded-lg border-2 py-3 text-center font-semibold text-sm transition ${
                                amount === preset
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border hover:border-primary/50'
                            }`}
                        >
                            &pound;{preset}
                        </button>
                    ))}
                </div>

                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">&pound;</span>
                    <input
                        type="number"
                        min="5"
                        max="500"
                        step="0.01"
                        value={customAmount}
                        onChange={(e) => { setCustomAmount(e.target.value); setAmount(null) }}
                        placeholder="Custom amount"
                        className="w-full rounded-lg border bg-background py-2.5 pl-7 pr-4 text-sm"
                    />
                </div>

                {feeInfo && isValid && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                        <div className="flex justify-between">
                            <span>Wallet credit: &pound;{effectiveAmount!.toFixed(2)}</span>
                            <span>Fee: ~&pound;{(feeInfo.estimatedFeePence / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-medium text-foreground">
                            <span>Total charge</span>
                            <span>&pound;{(feeInfo.chargePence / 100).toFixed(2)}</span>
                        </div>
                    </div>
                )}

                {error && <p className="text-xs text-red-500">{error}</p>}

                <button
                    onClick={handleSubmit}
                    disabled={!isValid || loading}
                    className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Redirecting...' : 'Pay with Stripe'}
                </button>
            </div>
        </div>
    )
}
