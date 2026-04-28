'use client'

import { useState } from 'react'
import { createTopUpSession } from '@/app/app/wallet/actions'
import { calculateChargeAmount } from '@/lib/stripe/config'
import { X, CreditCard } from 'lucide-react'

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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
            <div
                className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-[var(--background-elevated)] border border-[var(--border-color)] shadow-xl p-5 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--wc-green)]/10 to-[var(--wc-green)]/5 flex items-center justify-center">
                            <CreditCard className="w-4 h-4 text-[var(--wc-green)]" />
                        </div>
                        <h2 className="text-lg font-semibold text-[var(--foreground)]">Add Funds</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-[var(--neutral-100)] flex items-center justify-center text-[var(--neutral-500)] hover:text-[var(--foreground)] transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Preset amounts */}
                <div className="grid grid-cols-3 gap-2">
                    {PRESET_AMOUNTS.map((preset) => (
                        <button
                            key={preset}
                            onClick={() => { setAmount(preset); setCustomAmount('') }}
                            className={`rounded-xl border-2 py-3.5 text-center font-bold text-sm transition-all duration-200 ${
                                amount === preset
                                    ? 'border-[var(--wc-green)] bg-[var(--wc-green)]/10 text-[var(--wc-green)] shadow-sm'
                                    : 'border-[var(--border-color)] bg-[var(--background-soft)] text-[var(--foreground)] hover:border-[var(--wc-green)]/50'
                            }`}
                        >
                            &pound;{preset}
                        </button>
                    ))}
                </div>

                {/* Custom amount */}
                <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)] text-sm font-medium">&pound;</span>
                    <input
                        type="number"
                        min="5"
                        max="500"
                        step="0.01"
                        value={customAmount}
                        onChange={(e) => { setCustomAmount(e.target.value); setAmount(null) }}
                        placeholder="Custom amount"
                        className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--background-soft)] py-3 pl-8 pr-4 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:border-[var(--wc-green)] focus:ring-1 focus:ring-[var(--wc-green)]/30 transition-all"
                    />
                </div>

                {/* Fee breakdown */}
                {feeInfo && isValid && (
                    <div className="rounded-xl bg-[var(--background-soft)] border border-[var(--border-color)] p-3 text-xs space-y-1">
                        <div className="flex justify-between text-[var(--foreground-muted)]">
                            <span>Wallet credit</span>
                            <span>&pound;{effectiveAmount!.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[var(--foreground-muted)]">
                            <span>Processing fee</span>
                            <span>~&pound;{(feeInfo.estimatedFeePence / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-semibold text-[var(--foreground)] border-t border-[var(--border-color)] pt-1.5 mt-1.5">
                            <span>You pay</span>
                            <span>&pound;{(feeInfo.chargePence / 100).toFixed(2)}</span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3">
                        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                    </div>
                )}

                {/* Submit button */}
                <button
                    onClick={handleSubmit}
                    disabled={!isValid || loading}
                    className="w-full rounded-xl py-3 text-sm font-semibold bg-gradient-to-r from-[var(--wc-green)] to-[var(--wc-green-dark)] text-white shadow-lg shadow-[var(--wc-green)]/20 hover:shadow-xl hover:shadow-[var(--wc-green)]/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg transition-all duration-200"
                >
                    {loading ? 'Redirecting to Stripe...' : 'Pay with Stripe'}
                </button>
            </div>
        </div>
    )
}
