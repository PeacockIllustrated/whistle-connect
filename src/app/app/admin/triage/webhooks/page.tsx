import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { getTwentyFourHoursAgoIso } from '@/lib/admin/triage-windows'

export default async function WebhookFailuresPage() {
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
    const twentyFourHoursAgoIso = getTwentyFourHoursAgoIso()

    const { data: rows } = admin
        ? await admin
            .from('webhook_events')
            .select('id, type, received_at, processed_at, error')
            .gte('received_at', twentyFourHoursAgoIso)
            .not('error', 'is', null)
            .order('received_at', { ascending: false })
        : { data: null }

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            <div className="mb-6 flex items-center gap-3">
                <Link href="/app" className="-ml-2 rounded-lg p-2 hover:bg-[var(--neutral-100)]">
                    <ChevronLeft className="h-5 w-5" />
                </Link>
                <div>
                    <h1 className="text-lg font-semibold">Webhook failures (24h)</h1>
                    <p className="text-sm text-[var(--foreground-muted)]">Stripe webhook events captured with an error in the last 24 hours.</p>
                </div>
            </div>

            {rows && rows.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-white">
                    <table className="w-full text-sm">
                        <thead className="bg-[var(--neutral-50)] text-xs uppercase tracking-wide text-[var(--foreground-muted)]">
                            <tr>
                                <th className="px-3 py-2 text-left">Event ID</th>
                                <th className="px-3 py-2 text-left">Type</th>
                                <th className="px-3 py-2 text-left">Received</th>
                                <th className="px-3 py-2 text-left">Error</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id as string} className="border-t border-[var(--border-color)]">
                                    <td className="px-3 py-2 font-mono text-xs">{r.id as string}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{r.type as string}</td>
                                    <td className="px-3 py-2 text-xs">{(r.received_at as string).slice(0, 16).replace('T', ' ')}</td>
                                    <td className="px-3 py-2 text-xs text-red-700">{(r.error as string | null) ?? ''}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <EmptyState title="All clear" description="No Stripe webhook errors in the last 24 hours." />
            )}
        </div>
    )
}
