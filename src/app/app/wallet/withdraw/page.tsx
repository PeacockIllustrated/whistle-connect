'use client'

import { useState, useEffect } from 'react'
import { getWallet, requestWithdrawal, createStripeConnectLink } from '../actions'
import Link from 'next/link'
import type { Wallet } from '@/lib/types'

export default function WithdrawPage() {
    const [wallet, setWallet] = useState<Wallet | null>(null)
    const [loading, setLoading] = useState(true)
    const [withdrawAmount, setWithdrawAmount] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        async function load() {
            const { data } = await getWallet()
            setWallet(data ?? null)
            setLoading(false)
        }
        load()
    }, [])

    const amount = parseFloat(withdrawAmount)
    const isValid = !isNaN(amount) && amount >= 5 && amount <= (wallet?.balance_pence ?? 0) / 100

    async function handleWithdraw() {
        if (!isValid) return
        setSubmitting(true)
        setError(null)

        const result = await requestWithdrawal(amount)

        if (result.error) {
            setError(result.error)
            setSubmitting(false)
            return
        }

        setSuccess(true)
        setSubmitting(false)
        const { data } = await getWallet()
        setWallet(data ?? null)
        setWithdrawAmount('')
    }

    async function handleStripeConnect() {
        setSubmitting(true)
        setError(null)

        const result = await createStripeConnectLink()

        if (result.error) {
            setError(result.error)
            setSubmitting(false)
            return
        }

        if (result.url) {
            window.location.href = result.url
        }
    }

    if (loading) {
        return (
            <div className="mx-auto max-w-md p-4">
                <p className="text-muted-foreground">Loading...</p>
            </div>
        )
    }

    const needsOnboarding = !wallet?.stripe_connect_id || !wallet?.stripe_connect_onboarded

    return (
        <div className="mx-auto max-w-md space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Withdraw</h1>
                <Link href="/app/wallet" className="text-sm text-muted-foreground hover:underline">
                    &larr; Back
                </Link>
            </div>

            <div className="rounded-xl border bg-card p-6">
                <p className="text-sm text-muted-foreground">Available to withdraw</p>
                <p className="text-3xl font-bold">
                    &pound;{((wallet?.balance_pence ?? 0) / 100).toFixed(2)}
                </p>
            </div>

            {needsOnboarding ? (
                <div className="rounded-xl border bg-card p-6 space-y-4">
                    <h2 className="font-semibold">Connect your bank account</h2>
                    <p className="text-sm text-muted-foreground">
                        To withdraw funds, you need to complete Stripe verification.
                        This is a one-time setup that verifies your identity and bank details.
                    </p>
                    <button
                        onClick={handleStripeConnect}
                        disabled={submitting}
                        className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 py-3 text-center font-semibold text-white disabled:opacity-50 transition-colors"
                    >
                        {submitting ? 'Redirecting...' : 'Set Up Withdrawals'}

                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {success && (
                        <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4">
                            <p className="text-green-700 dark:text-green-400 font-medium">
                                Withdrawal initiated! Funds will arrive in your bank account within 2-3 business days.
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="text-sm font-medium">Withdrawal amount</label>
                        <div className="relative mt-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">&pound;</span>
                            <input
                                type="number"
                                min="5"
                                max={(wallet?.balance_pence ?? 0) / 100}
                                step="0.01"
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                placeholder="5.00"
                                className="w-full rounded-lg border bg-background py-3 pl-8 pr-4 text-lg"
                            />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Minimum &pound;5</p>
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <button
                        onClick={handleWithdraw}
                        disabled={!isValid || submitting}
                        className="w-full rounded-lg bg-primary py-3 text-center font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? 'Processing...' : 'Withdraw Funds'}
                    </button>
                </div>
            )}
        </div>
    )
}
