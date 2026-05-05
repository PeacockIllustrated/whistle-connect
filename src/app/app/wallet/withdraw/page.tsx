'use client'

import { useState, useEffect } from 'react'
import { getWallet, requestWithdrawal, createStripeConnectLink } from '../actions'
import Link from 'next/link'
import {
    Wallet as WalletIcon,
    ArrowLeft,
    Building2,
    CheckCircle2,
    AlertCircle,
    Info,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
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

    const balancePounds = (wallet?.balance_pence ?? 0) / 100
    const amount = parseFloat(withdrawAmount)
    const isValid = !isNaN(amount) && amount >= 5 && amount <= balancePounds

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

    function resetSuccess() {
        setSuccess(false)
        setError(null)
    }

    const needsOnboarding = !wallet?.stripe_connect_id || !wallet?.stripe_connect_onboarded

    return (
        <div className="mx-auto max-w-md space-y-5 p-4 pb-24">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Link
                    href="/app/wallet"
                    className="inline-flex w-9 h-9 items-center justify-center rounded-full border border-[var(--border-color)] bg-white text-[var(--foreground)] hover:bg-[var(--neutral-50)] transition-colors"
                    aria-label="Back to wallet"
                >
                    <ArrowLeft className="w-4 h-4" />
                </Link>
                <h1 className="text-xl font-bold text-[var(--foreground)]">Withdraw Funds</h1>
            </div>

            {/* Balance hero card */}
            <div className="rounded-2xl overflow-hidden border border-[var(--border-color)] shadow-sm">
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[var(--wc-green)] to-[var(--wc-green-dark)]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
                            <WalletIcon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="font-semibold text-sm text-white">Available to withdraw</span>
                    </div>
                </div>
                <div className="px-5 py-5 bg-[var(--background-soft)]">
                    {loading ? (
                        <div className="space-y-2">
                            <div className="h-8 w-32 animate-pulse rounded-lg bg-[var(--neutral-100)]" />
                            <div className="h-3 w-20 animate-pulse rounded bg-[var(--neutral-100)]" />
                        </div>
                    ) : (
                        <>
                            <p className="text-3xl font-bold text-[var(--foreground)]">
                                &pound;{balancePounds.toFixed(2)}
                            </p>
                            <p className="text-xs text-[var(--foreground-muted)] mt-1">
                                Wallet balance
                            </p>
                        </>
                    )}
                </div>
            </div>

            {/* Body */}
            {loading ? (
                <div className="rounded-2xl border border-[var(--border-color)] bg-white p-6 space-y-3">
                    <div className="h-5 w-40 animate-pulse rounded bg-[var(--neutral-100)]" />
                    <div className="h-4 w-full animate-pulse rounded bg-[var(--neutral-100)]" />
                    <div className="h-11 w-full animate-pulse rounded-xl bg-[var(--neutral-100)]" />
                </div>
            ) : needsOnboarding ? (
                <div className="rounded-2xl border border-[var(--border-color)] bg-white p-6 space-y-4 shadow-sm">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--wc-green)]/10 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-5 h-5 text-[var(--wc-green-dark)]" />
                        </div>
                        <div className="flex-1">
                            <h2 className="font-semibold text-[var(--foreground)]">
                                Connect your bank account
                            </h2>
                            <p className="text-sm text-[var(--foreground-muted)] mt-1">
                                Whistle Connect uses Stripe to verify your identity and bank
                                details. This is a one-time setup.
                            </p>
                        </div>
                    </div>

                    {error && <ErrorBanner message={error} />}

                    <Button
                        variant="primary"
                        fullWidth
                        loading={submitting}
                        onClick={handleStripeConnect}
                    >
                        Set Up Withdrawals
                    </Button>
                </div>
            ) : success ? (
                <div className="rounded-2xl border border-[var(--border-color)] bg-white p-6 space-y-4 shadow-sm">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--wc-green)]/10 flex items-center justify-center flex-shrink-0">
                            <CheckCircle2 className="w-5 h-5 text-[var(--wc-green-dark)]" />
                        </div>
                        <div className="flex-1">
                            <h2 className="font-semibold text-[var(--foreground)]">
                                Withdrawal initiated
                            </h2>
                            <p className="text-sm text-[var(--foreground-muted)] mt-1">
                                Funds will arrive in your bank account within 2&ndash;3 business days.
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        fullWidth
                        onClick={resetSuccess}
                    >
                        Make another withdrawal
                    </Button>
                </div>
            ) : (
                <div className="rounded-2xl border border-[var(--border-color)] bg-white p-6 space-y-4 shadow-sm">
                    <div>
                        <label
                            htmlFor="amount"
                            className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
                        >
                            Amount
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)] text-base pointer-events-none">
                                &pound;
                            </span>
                            <input
                                id="amount"
                                type="number"
                                inputMode="decimal"
                                min="5"
                                max={balancePounds}
                                step="0.01"
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                placeholder="5.00"
                                className="w-full min-h-[44px] pl-7 pr-4 py-2.5 text-base text-[var(--foreground)] bg-white border border-[var(--border-color)] rounded-[var(--radius-md)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent transition-colors"
                            />
                        </div>
                        <p className="text-xs text-[var(--foreground-muted)] mt-1.5">
                            Minimum &pound;5 &middot; Maximum &pound;{balancePounds.toFixed(2)}
                        </p>
                    </div>

                    {error && <ErrorBanner message={error} />}

                    <Button
                        variant="primary"
                        fullWidth
                        loading={submitting}
                        disabled={!isValid}
                        onClick={handleWithdraw}
                    >
                        {isValid ? `Withdraw £${amount.toFixed(2)}` : 'Withdraw Funds'}
                    </Button>
                </div>
            )}

            {/* Footer note */}
            {!loading && (
                <div className="flex items-start gap-2 px-1">
                    <Info className="w-4 h-4 text-[var(--foreground-muted)] flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-[var(--foreground-muted)]">
                        Withdrawals usually arrive in 2&ndash;3 business days. Stripe Connect
                        is used to verify your bank details.
                    </p>
                </div>
            )}
        </div>
    )
}

function ErrorBanner({ message }: { message: string }) {
    return (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{message}</p>
        </div>
    )
}
