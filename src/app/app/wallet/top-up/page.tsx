'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTopUpSession } from '../actions'
import { calculateChargeAmount } from '@/lib/stripe/config'
import Link from 'next/link'

const PRESET_AMOUNTS = [10, 20, 50]

export default function TopUpPage() {
    const router = useRouter()
    const [amount, setAmount] = useState<number | null>(null)
    const [customAmount, setCustomAmount] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

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
        <div className="mx-auto max-w-md space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Add Funds</h1>
                <Link href="/app/wallet" className="text-sm text-muted-foreground hover:underline">
                    &larr; Back
                </Link>
            </div>

            <div className="grid grid-cols-3 gap-3">
                {PRESET_AMOUNTS.map((preset) => (
                    <button
                        key={preset}
                        onClick={() => { setAmount(preset); setCustomAmount('') }}
                        className={`rounded-lg border-2 p-4 text-center font-semibold transition ${
                            amount === preset
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:border-primary/50'
                        }`}
                    >
                        &pound;{preset}
                    </button>
                ))}
            </div>

            <div>
                <label className="text-sm font-medium text-muted-foreground">
                    Or enter custom amount
                </label>
                <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">&pound;</span>
                    <input
                        type="number"
                        min="5"
                        max="500"
                        step="0.01"
                        value={customAmount}
                        onChange={(e) => { setCustomAmount(e.target.value); setAmount(null) }}
                        placeholder="5.00 — 500.00"
                        className="w-full rounded-lg border bg-background py-3 pl-8 pr-4 text-lg"
                    />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Minimum &pound;5, maximum &pound;500</p>
            </div>

            {feeInfo && isValid && (
                <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-1">
                    <div className="flex justify-between">
                        <span>Wallet credit</span>
                        <span>&pound;{effectiveAmount!.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                        <span>Processing fee</span>
                        <span>~&pound;{(feeInfo.estimatedFeePence / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                        <span>You pay</span>
                        <span>&pound;{(feeInfo.chargePence / 100).toFixed(2)}</span>
                    </div>
                </div>
            )}

            {error && (
                <p className="text-sm text-red-500">{error}</p>
            )}

            <button
                onClick={handleSubmit}
                disabled={!isValid || loading}
                className="w-full rounded-lg bg-primary py-3 text-center font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? 'Redirecting to payment...' : 'Proceed to Payment'}
            </button>
        </div>
    )
}
