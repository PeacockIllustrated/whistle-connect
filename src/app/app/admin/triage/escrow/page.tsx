import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { getSevenDaysAgoDate } from '@/lib/admin/triage-windows'

export default async function StuckEscrowPage() {
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
    const sevenDaysAgoStr = getSevenDaysAgoDate()

    const { data: rows } = admin
        ? await admin
            .from('bookings')
            .select('id, match_date, status, escrow_amount_pence, coach_id, coach:profiles!bookings_coach_id_fkey(full_name)')
            .eq('status', 'confirmed')
            .lt('match_date', sevenDaysAgoStr)
            .is('escrow_released_at', null)
            .is('deleted_at', null)
            .order('match_date', { ascending: true })
        : { data: null }

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            <div className="mb-6 flex items-center gap-3">
                <Link href="/app" className="-ml-2 rounded-lg p-2 hover:bg-[var(--neutral-100)]">
                    <ChevronLeft className="h-5 w-5" />
                </Link>
                <div>
                    <h1 className="text-lg font-semibold">Stuck escrow</h1>
                    <p className="text-sm text-[var(--foreground-muted)]">
                        Confirmed bookings older than 7 days with escrow not released.
                    </p>
                </div>
            </div>

            {rows && rows.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-white">
                    <table className="w-full text-sm">
                        <thead className="bg-[var(--neutral-50)] text-xs uppercase tracking-wide text-[var(--foreground-muted)]">
                            <tr>
                                <th className="px-3 py-2 text-left">Booking</th>
                                <th className="px-3 py-2 text-left">Coach</th>
                                <th className="px-3 py-2 text-left">Match date</th>
                                <th className="px-3 py-2 text-right">Escrow</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => {
                                const coach = Array.isArray(r.coach) ? r.coach[0] : r.coach
                                const coachName = (coach as { full_name?: string } | null)?.full_name ?? 'Unknown'
                                const pence = (r.escrow_amount_pence as number | null) ?? 0
                                return (
                                    <tr key={r.id as string} className="border-t border-[var(--border-color)]">
                                        <td className="px-3 py-2 font-mono text-xs">
                                            <Link href={`/app/bookings/${r.id}`} className="text-[var(--brand-primary)] hover:underline">
                                                {(r.id as string).slice(0, 8)}
                                            </Link>
                                        </td>
                                        <td className="px-3 py-2">{coachName}</td>
                                        <td className="px-3 py-2">{r.match_date as string}</td>
                                        <td className="px-3 py-2 text-right font-mono">£{(pence / 100).toFixed(2)}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <EmptyState title="All clear" description="No confirmed bookings have escrow stuck beyond 7 days." />
            )}
        </div>
    )
}
