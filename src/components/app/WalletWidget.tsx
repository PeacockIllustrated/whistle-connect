'use client'

import { useState, useEffect } from 'react'
import { getWallet } from '@/app/app/wallet/actions'
import TopUpModal from './TopUpModal'
import Link from 'next/link'
import { Wallet, Plus, ArrowUpRight } from 'lucide-react'
import type { Wallet as WalletType } from '@/lib/types'

interface WalletWidgetProps {
    userRole: string
}

export default function WalletWidget({ userRole }: WalletWidgetProps) {
    const [wallet, setWallet] = useState<WalletType | null>(null)
    const [loading, setLoading] = useState(true)
    const [showTopUp, setShowTopUp] = useState(false)

    useEffect(() => {
        async function load() {
            const { data } = await getWallet()
            setWallet(data ?? null)
            setLoading(false)
        }
        load()
    }, [])

    const isCoach = userRole === 'coach'

    return (
        <>
            <div className="rounded-2xl overflow-hidden mb-6 border border-[var(--border-color)] shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[var(--wc-green)] to-[var(--wc-green-dark)]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
                            <Wallet className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="font-semibold text-sm text-white">Wallet</span>
                        <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/20 text-white">
                            Trial
                        </span>
                    </div>
                    <Link href="/app/wallet" className="text-xs text-white/70 hover:text-white transition-colors">
                        View all &rarr;
                    </Link>
                </div>

                {/* Content */}
                <div className="px-4 py-4 bg-[var(--background-soft)]">
                    {loading ? (
                        <div className="h-10 w-28 animate-pulse rounded-lg bg-[var(--neutral-100)]" />
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-2xl font-bold text-[var(--foreground)]">
                                        &pound;{((wallet?.balance_pence ?? 0) / 100).toFixed(2)}
                                    </p>
                                    <p className="text-xs text-[var(--foreground-muted)]">Available balance</p>
                                </div>
                                {isCoach && (wallet?.escrow_pence ?? 0) > 0 && (
                                    <div className="text-right">
                                        <p className="text-lg font-semibold text-amber-600">
                                            &pound;{((wallet?.escrow_pence ?? 0) / 100).toFixed(2)}
                                        </p>
                                        <p className="text-xs text-[var(--foreground-muted)]">In escrow</p>
                                    </div>
                                )}
                            </div>

                            {isCoach ? (
                                <button
                                    onClick={() => setShowTopUp(true)}
                                    className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold bg-gradient-to-r from-[var(--wc-green)] to-[var(--wc-green-dark)] text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Funds
                                </button>
                            ) : (
                                <Link
                                    href="/app/wallet/withdraw"
                                    className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold bg-gradient-to-r from-[var(--wc-green)] to-[var(--wc-green-dark)] text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                                >
                                    <ArrowUpRight className="w-4 h-4" />
                                    Withdraw
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <TopUpModal open={showTopUp} onClose={() => setShowTopUp(false)} />
        </>
    )
}
