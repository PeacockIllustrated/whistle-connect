import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWallet, getTransactions } from './actions'
import { BOOKING_FEE_PENCE } from '@/lib/constants'
import Link from 'next/link'
import {
    ChevronLeft, Wallet, Lock, Plus, ArrowUpRight,
    ArrowDownLeft, ArrowUpFromLine, Shield, RotateCcw, Receipt, Hourglass
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

    // Phase 2: pending earnings for refs — sum of (escrow_amount - platform fee)
    // across bookings they're assigned to where escrow hasn't released yet.
    // Includes both 'confirmed' (waiting on someone to mark complete) and
    // 'completed' (both confirmed, in 48h cooling-off) statuses.
    type PendingBooking = {
        id: string
        ground_name: string | null
        location_postcode: string
        escrow_amount_pence: number | null
        coach_marked_complete_at: string | null
        referee_marked_complete_at: string | null
        both_confirmed_at: string | null
        match_date: string
        kickoff_time: string
    }
    let pendingBookings: PendingBooking[] = []
    if (isReferee) {
        const { data } = await supabase
            .from('booking_assignments')
            .select(`
                booking:bookings!inner(
                    id, ground_name, location_postcode, escrow_amount_pence,
                    coach_marked_complete_at, referee_marked_complete_at,
                    both_confirmed_at, match_date, kickoff_time
                )
            `)
            .eq('referee_id', user.id)
            .is('booking.escrow_released_at', null)
            .not('booking.escrow_amount_pence', 'is', null)
            .in('booking.status', ['confirmed', 'completed'])
        pendingBookings = ((data || [])
            .map((row) => Array.isArray(row.booking) ? row.booking[0] : row.booking)
            .filter(Boolean) as unknown as PendingBooking[])
    }
    const pendingTotalPence = pendingBookings.reduce((sum, b) => {
        const net = (b.escrow_amount_pence ?? 0) - BOOKING_FEE_PENCE
        return sum + Math.max(0, net)
    }, 0)

    /** Compute the expected release date for a single pending booking. */
    function expectedReleaseDate(b: PendingBooking): { date: Date; reason: 'mutual' | 'fallback-coach' | 'fallback-ref' | 'awaiting' } {
        // Mutually confirmed → cron releases on the next tick (within ~15 min).
        // Surface "now-ish" by using both_confirmed_at as the sort timestamp.
        if (b.both_confirmed_at) {
            return {
                date: new Date(b.both_confirmed_at),
                reason: 'mutual',
            }
        }
        // Otherwise: kickoff + 48h is the absolute backstop, regardless of
        // whether one party or neither has marked.
        const backstop = new Date(new Date(`${b.match_date}T${b.kickoff_time}`).getTime() + 48 * 60 * 60 * 1000)
        if (b.coach_marked_complete_at && !b.referee_marked_complete_at) {
            return { date: backstop, reason: 'fallback-coach' }
        }
        if (b.referee_marked_complete_at && !b.coach_marked_complete_at) {
            return { date: backstop, reason: 'fallback-ref' }
        }
        return { date: backstop, reason: 'awaiting' }
    }

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto pb-24">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/app" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg font-semibold text-[var(--foreground)]">Wallet</h1>
                    </div>
                    <p className="text-sm text-[var(--foreground-muted)]">
                        Manage your funds
                    </p>
                </div>
            </div>

            {/* Trial banner */}
            <div className="card p-3 mb-4 border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30">
                <p className="text-xs text-emerald-800 dark:text-emerald-300">
                    <span className="font-semibold">Wallet is in trial.</span>{' '}
                    Top-ups, escrow holds and withdrawals are processed via Stripe.
                    Report any issues so we can iron them out before launch.
                </p>
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
                            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <Hourglass className="w-4 h-4 text-amber-600" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-amber-600">
                            &pound;{(pendingTotalPence / 100).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-[var(--foreground-muted)] uppercase font-medium">Pending Earnings</p>
                    </div>
                )}
            </div>

            {/* Pending earnings detail — referee only, only if there's anything pending */}
            {isReferee && pendingBookings.length > 0 && (
                <div className="card overflow-hidden mb-6">
                    <div className="p-4 border-b border-[var(--border-color)] bg-[var(--neutral-50)]">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--foreground-muted)]">
                            Pending Releases
                        </h2>
                    </div>
                    <ul className="divide-y divide-[var(--border-color)]">
                        {pendingBookings.map((b) => {
                            const net = Math.max(0, (b.escrow_amount_pence ?? 0) - BOOKING_FEE_PENCE)
                            const release = expectedReleaseDate(b)
                            const reasonText = (() => {
                                switch (release.reason) {
                                    case 'mutual':
                                        return 'Both parties confirmed — releasing now'
                                    case 'fallback-coach':
                                        return 'Coach confirmed — auto-release at kickoff + 48h'
                                    case 'fallback-ref':
                                        return 'You confirmed — auto-release at kickoff + 48h if coach is silent'
                                    case 'awaiting':
                                        return 'Awaiting confirmation — auto-release at kickoff + 48h'
                                }
                            })()
                            return (
                                <li key={b.id} className="flex items-center gap-3 p-4">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-100 dark:bg-amber-900/30">
                                        <Hourglass className="w-4 h-4 text-amber-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <Link href={`/app/bookings/${b.id}`} className="block">
                                            <p className="font-medium text-sm text-[var(--foreground)] truncate hover:underline">
                                                {b.ground_name || b.location_postcode}
                                            </p>
                                        </Link>
                                        <p className="text-[11px] text-[var(--foreground-muted)] mt-0.5">
                                            {reasonText}
                                            {release.reason !== 'mutual' && (
                                                <>
                                                    {' '}({release.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })})
                                                </>
                                            )}
                                        </p>
                                    </div>
                                    <span className="font-bold text-sm flex-shrink-0 text-amber-600">
                                        &pound;{(net / 100).toFixed(2)}
                                    </span>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            )}

            {/* Action Button */}
            <div className="mb-6">
                {isCoach && (
                    <Link
                        href="/app/wallet/top-up"
                        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold bg-gradient-to-r from-[var(--wc-green)] to-[var(--wc-green-dark)] text-white shadow-lg shadow-[var(--wc-green)]/20 hover:shadow-xl hover:shadow-[var(--wc-green)]/30 hover:-translate-y-0.5 transition-all duration-200"
                    >
                        <Plus className="w-4 h-4" />
                        Add Funds
                    </Link>
                )}
                {isReferee && (
                    <Link
                        href="/app/wallet/withdraw"
                        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold bg-gradient-to-r from-[var(--wc-green)] to-[var(--wc-green-dark)] text-white shadow-lg shadow-[var(--wc-green)]/20 hover:shadow-xl hover:shadow-[var(--wc-green)]/30 hover:-translate-y-0.5 transition-all duration-200"
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
