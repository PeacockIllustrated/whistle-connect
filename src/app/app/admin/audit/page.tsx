import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRecentAdminActivity } from '@/lib/admin/audit'

function timeAgo(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime()
    const mins = Math.round(ms / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.round(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.round(hrs / 24)}d ago`
}

export default async function AuditLogPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
    if (profile?.role !== 'admin') redirect('/app')

    const entries = await getRecentAdminActivity(100)

    return (
        <div className="mx-auto max-w-[var(--content-max-width)] px-4 py-6 pb-24">
            <h1 className="text-2xl font-bold">Admin audit log</h1>
            <p className="mb-6 mt-1 text-sm text-[var(--foreground-muted)]">
                Every consequential admin action — who did what, to whom, and when.
            </p>
            {entries.length === 0 ? (
                <p className="text-sm text-[var(--foreground-muted)]">No admin actions recorded yet.</p>
            ) : (
                <ul className="space-y-2">
                    {entries.map((e) => (
                        <li key={e.id} className="rounded-lg border border-[var(--border-color)] bg-white p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 text-sm">
                                    <span className="font-medium text-[var(--foreground)]">{e.actor_name || 'Admin'}</span>
                                    <span className="text-[var(--foreground-muted)]"> — {e.summary || e.action}</span>
                                    {e.target_name && <span className="text-[var(--foreground)]"> ({e.target_name})</span>}
                                </div>
                                <time className="flex-shrink-0 text-xs text-[var(--foreground-muted)]" dateTime={e.created_at}>
                                    {timeAgo(e.created_at)}
                                </time>
                            </div>
                            <div className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--neutral-400)]">
                                {e.action}
                                {e.target_type ? ` • ${e.target_type}` : ''}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
