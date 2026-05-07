import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { getOneHourAgoIso } from '@/lib/admin/triage-windows'

export default async function StuckWithdrawalsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
    if (profile?.role !== 'admin') redirect('/app')

    const admin = createAdminClient()
    const oneHourAgoIso = getOneHourAgoIso()

    const { data: rows } = admin
        ? await admin
            .from('withdrawal_requests')
            .select('id, user_id, amount_pence, status, created_at, error, user:profiles!withdrawal_requests_user_id_fkey(full_name)')
            .in('status', ['failed', 'pending'])
            .lt('created_at', oneHourAgoIso)
            .order('created_at', { ascending: true })
        : { data: null }

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            <div className="mb-6 flex items-center gap-3">
                <Link href="/app" className="-ml-2 rounded-lg p-2 hover:bg-[var(--neutral-100)]">
                    <ChevronLeft className="h-5 w-5" />
                </Link>
                <div>
                    <h1 className="text-lg font-semibold">Withdrawals stuck</h1>
                    <p className="text-sm text-[var(--foreground-muted)]">
                        Failed or pending withdrawal_requests rows older than 1 hour.
                    </p>
                </div>
            </div>

            {rows && rows.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-white">
                    <table className="w-full text-sm">
                        <thead className="bg-[var(--neutral-50)] text-xs uppercase tracking-wide text-[var(--foreground-muted)]">
                            <tr>
                                <th className="px-3 py-2 text-left">Request</th>
                                <th className="px-3 py-2 text-left">Referee</th>
                                <th className="px-3 py-2 text-left">Created</th>
                                <th className="px-3 py-2 text-left">Status</th>
                                <th className="px-3 py-2 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => {
                                const u = Array.isArray(r.user) ? r.user[0] : r.user
                                const userName = (u as { full_name?: string } | null)?.full_name ?? 'Unknown'
                                const pence = (r.amount_pence as number | null) ?? 0
                                return (
                                    <tr key={r.id as string} className="border-t border-[var(--border-color)]">
                                        <td className="px-3 py-2 font-mono text-xs">{(r.id as string).slice(0, 8)}</td>
                                        <td className="px-3 py-2">{userName}</td>
                                        <td className="px-3 py-2 text-xs">{(r.created_at as string).slice(0, 16).replace('T', ' ')}</td>
                                        <td className="px-3 py-2">
                                            <span className={r.status === 'failed' ? 'font-semibold text-red-700' : 'text-amber-700'}>
                                                {r.status as string}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono">£{(pence / 100).toFixed(2)}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <EmptyState title="All clear" description="No withdrawal requests are stuck or failed beyond the 1-hour window." />
            )}
        </div>
    )
}
