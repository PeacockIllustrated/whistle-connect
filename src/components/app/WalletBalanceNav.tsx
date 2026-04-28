'use client'

import { useState, useEffect } from 'react'
import { getWallet } from '@/app/app/wallet/actions'
import Link from 'next/link'

export default function WalletBalanceNav() {
    const [balance, setBalance] = useState<number | null>(null)
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
        async function load() {
            const { data } = await getWallet()
            setBalance(data?.balance_pence ?? 0)
            setLoaded(true)
        }
        load()
    }, [])

    // Always show the wallet pill once loaded, even with zero / no wallet,
    // so the entry point never disappears during the trial.
    if (!loaded) return null

    const display = `£${((balance ?? 0) / 100).toFixed(2)}`

    return (
        <Link
            href="/app/wallet"
            className="flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-medium hover:bg-emerald-200 transition dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
        >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 110-6h5.25A2.25 2.25 0 0121 6v6zm0 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6" />
            </svg>
            {display}
        </Link>
    )
}
