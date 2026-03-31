import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWallet, getTransactions } from './actions'
import Link from 'next/link'

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
        <div className="mx-auto max-w-2xl space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Wallet</h1>
                <Link href="/app" className="text-sm text-muted-foreground hover:underline">
                    &larr; Back to Dashboard
                </Link>
            </div>

            {topupStatus === 'success' && (
                <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4">
                    <p className="text-green-700 dark:text-green-400 font-medium">
                        Top-up successful! Your balance has been updated.
                    </p>
                </div>
            )}

            {topupStatus === 'cancelled' && (
                <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 p-4">
                    <p className="text-yellow-700 dark:text-yellow-400">
                        Top-up was cancelled. No charges were made.
                    </p>
                </div>
            )}

            <div className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-muted-foreground">Available Balance</p>
                        <p className="text-3xl font-bold">
                            &pound;{((wallet?.balance_pence ?? 0) / 100).toFixed(2)}
                        </p>
                    </div>
                    {isCoach && (
                        <div>
                            <p className="text-sm text-muted-foreground">Held in Escrow</p>
                            <p className="text-3xl font-bold text-amber-600">
                                &pound;{((wallet?.escrow_pence ?? 0) / 100).toFixed(2)}
                            </p>
                        </div>
                    )}
                </div>

                <div className="mt-4 flex gap-3">
                    {isCoach && (
                        <Link
                            href="/app/wallet/top-up"
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        >
                            Add Funds
                        </Link>
                    )}
                    {isReferee && (
                        <Link
                            href="/app/wallet/withdraw"
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        >
                            Withdraw
                        </Link>
                    )}
                </div>
            </div>

            <div className="rounded-xl border bg-card shadow-sm">
                <div className="border-b p-4">
                    <h2 className="text-lg font-semibold">Transaction History</h2>
                </div>

                {(!transactions || transactions.length === 0) ? (
                    <div className="p-8 text-center text-muted-foreground">
                        <p>No transactions yet.</p>
                        {isCoach && (
                            <p className="mt-1 text-sm">Add funds to get started.</p>
                        )}
                    </div>
                ) : (
                    <ul className="divide-y">
                        {transactions.map((tx) => (
                            <li key={tx.id} className="flex items-center justify-between p-4">
                                <div>
                                    <p className="font-medium text-sm">
                                        {formatTransactionType(tx.type)}
                                    </p>
                                    {tx.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {tx.description}
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(tx.created_at).toLocaleDateString('en-GB', {
                                            day: 'numeric', month: 'short', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit',
                                        })}
                                    </p>
                                </div>
                                <span className={`font-semibold ${
                                    tx.direction === 'credit'
                                        ? 'text-green-600'
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
