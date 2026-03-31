'use client'

import { useState, useEffect } from 'react'
import { getWallet } from '@/app/app/wallet/actions'
import TopUpModal from './TopUpModal'
import Link from 'next/link'
import type { Wallet } from '@/lib/types'

interface WalletWidgetProps {
    userRole: string
}

export default function WalletWidget({ userRole }: WalletWidgetProps) {
    const [wallet, setWallet] = useState<Wallet | null>(null)
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
            <div className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-muted-foreground">Wallet</h3>
                    <Link href="/app/wallet" className="text-xs text-primary hover:underline">
                        View all &rarr;
                    </Link>
                </div>

                {loading ? (
                    <div className="h-8 w-24 animate-pulse rounded bg-muted" />
                ) : (
                    <div className="space-y-2">
                        <div className="flex items-end justify-between">
                            <div>
                                <p className="text-2xl font-bold">
                                    &pound;{((wallet?.balance_pence ?? 0) / 100).toFixed(2)}
                                </p>
                                <p className="text-xs text-muted-foreground">Available</p>
                            </div>
                            {isCoach && (wallet?.escrow_pence ?? 0) > 0 && (
                                <div className="text-right">
                                    <p className="text-lg font-semibold text-amber-600">
                                        &pound;{((wallet?.escrow_pence ?? 0) / 100).toFixed(2)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">In escrow</p>
                                </div>
                            )}
                        </div>

                        {isCoach ? (
                            <button
                                onClick={() => setShowTopUp(true)}
                                className="w-full rounded-lg bg-primary/10 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition"
                            >
                                + Add Funds
                            </button>
                        ) : (
                            <Link
                                href="/app/wallet/withdraw"
                                className="block w-full rounded-lg bg-primary/10 py-2 text-center text-sm font-medium text-primary hover:bg-primary/20 transition"
                            >
                                Withdraw
                            </Link>
                        )}
                    </div>
                )}
            </div>

            <TopUpModal open={showTopUp} onClose={() => setShowTopUp(false)} />
        </>
    )
}
