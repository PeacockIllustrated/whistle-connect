import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWallet, getTransactions } from './actions'
import Link from 'next/link'
import {
    ChevronLeft, Wallet, Lock, Plus, ArrowUpRight,
    ArrowDownLeft, ArrowUpFromLine, Shield, RotateCcw, Receipt
} from 'lucide-react'

export default async function WalletPage({
    searchParams,
}: {
    searchParams: Promise<{ topup?: string }>
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    const { data: wallet } = await getWallet()
    const { data: transactions } = await getTransactions(50)

    const params = await searchParams
    const topupStatus = params.topup

    const isCoach = profile?.role === 'coach'
    const isReferee = profile?.role === 'referee'

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto pb-24">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/app" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold text-[var(--foreground)]">Wallet</h1>
                    <p className="text-sm text-[var(--foreground-muted)]">
                        Manage your funds
                    </p>
                </div>
            </div>

            {/* Status banners */}
            {topupStatus === 'success' && (
                <div className="card p-4 mb-4 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
                    <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                        Top-up successful! Your balance has been updated.
                    </p>
                </div>
            )}

            {topupStatus === 'cancelled' && (
                <div className="card p-4 mb-4 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                        Top-up was cancelled. No charges were made.
                    </p>
                </div>
            )}

            {/* Balance Cards */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="card p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <Wallet className="w-4 h-4 text-emerald-600" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-[var(--foreground)]">
                        &pound;{((wallet?.balance_pence ?? 0) / 100).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-[var(--foreground-muted)] uppercase font-medium">Available</p>
                </div>

                {isCoach && (
                    <div className="card p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <Lock className="w-4 h-4 text-amber-600" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-amber-600">
                            &pound;{((wallet?.escrow_pence ?? 0) / 100).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-[var(--foreground-muted)] uppercase font-medium">In Escrow</p>
                    </div>
                )}

                {isReferee && (
                    <div className="card p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <Receipt className="w-4 h-4 text-blue-600" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-[var(--foreground)]">
                            {transactions?.length ?? 0}
                        </p>
                        <p className="text-[10px] text-[var(--foreground-muted)] uppercase font-medium">Transactions</p>
                    </div>
                )}
            </div>

            {/* Action Button */}
            <div className="mb-6">
                {isCoach && (
                    <Link
                        href="/app/wallet/top-up"
                        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-dark)] text-white shadow-lg shadow-[var(--brand-primary)]/20 hover:shadow-xl hover:shadow-[var(--brand-primary)]/30 hover:-translate-y-0.5 transition-all duration-200"
                    >
                        <Plus className="w-4 h-4" />
                        Add Funds
                    </Link>
                )}
                {isReferee && (
                    <Link
                        href="/app/wallet/withdraw"
                        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-dark)] text-white shadow-lg shadow-[var(--brand-primary)]/20 hover:shadow-xl hover:shadow-[var(--brand-primary)]/30 hover:-translate-y-0.5 transition-all duration-200"
                    >
                        <ArrowUpRight className="w-4 h-4" />
                        Withdraw
                    </Link>
                )}
            </div>

            {/* Transaction History */}
            <div className="card overflow-hidden">
                <div className="p-4 border-b border-[var(--border-color)] bg-[var(--neutral-50)]">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--foreground-muted)]">
                        Transaction History
                    </h2>
                </div>

                {(!transactions || transactions.length === 0) ? (
                    <div className="p-8 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--neutral-100)] flex items-center justify-center mx-auto mb-3">
                            <Receipt className="w-6 h-6 text-[var(--neutral-400)]" />
                        </div>
                        <p className="text-sm font-medium text-[var(--foreground)]">No transactions yet</p>
                        {isCoach && (
                            <p className="mt-1 text-xs text-[var(--foreground-muted)]">Add funds to get started.</p>
                        )}
                    </div>
                ) : (
                    <ul className="divide-y divide-[var(--border-color)]">
                        {transactions.map((tx) => (
                            <li key={tx.id} className="flex items-center gap-3 p-4">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                    tx.direction === 'credit'
                                        ? 'bg-emerald-100 dark:bg-emerald-900/30'
                                        : 'bg-red-100 dark:bg-red-900/30'
                                }`}>
                                    {getTransactionIcon(tx.type, tx.direction)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-[var(--foreground)]">
                                        {formatTransactionType(tx.type)}
                                    </p>
                                    {tx.description && (
                                        <p className="text-xs text-[var(--foreground-muted)] truncate mt-0.5">
                                            {tx.description}
                                        </p>
                                    )}
                                    <p className="text-[10px] text-[var(--foreground-muted)] mt-0.5">
                                        {new Date(tx.created_at).toLocaleDateString('en-GB', {
                                            day: 'numeric', month: 'short', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit',
                                        })}
                                    </p>
                                </div>
                                <span className={`font-bold text-sm flex-shrink-0 ${
                                    tx.direction === 'credit'
                                        ? 'text-emerald-600'
                                        : 'text-red-500'
                                }`}>
                                    {tx.direction === 'credit' ? '+' : '-'}
                                    &pound;{(tx.amount_pence / 100).toFixed(2)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}

function getTransactionIcon(type: string, direction: string) {
    const iconClass = direction === 'credit' ? 'w-4 h-4 text-emerald-600' : 'w-4 h-4 text-red-500'

    switch (type) {
        case 'top_up': return <ArrowDownLeft className={iconClass} />
        case 'escrow_hold': return <Lock className={iconClass} />
        case 'escrow_release': return <ArrowUpFromLine className={iconClass} />
        case 'escrow_refund': return <RotateCcw className={iconClass} />
        case 'withdrawal': return <ArrowUpRight className={iconClass} />
        case 'admin_credit':
        case 'admin_debit': return <Shield className={iconClass} />
        default: return <Receipt className={iconClass} />
    }
}

function formatTransactionType(type: string): string {
    const labels: Record<string, string> = {
        top_up: 'Wallet Top-Up',
        escrow_hold: 'Escrow Hold',
        escrow_release: 'Payment Released',
        escrow_refund: 'Escrow Refund',
        withdrawal: 'Withdrawal',
        platform_fee: 'Platform Fee',
        admin_credit: 'Admin Credit',
        admin_debit: 'Admin Debit',
    }
    return labels[type] ?? type
}
