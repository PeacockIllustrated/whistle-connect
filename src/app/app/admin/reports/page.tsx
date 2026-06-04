import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ShieldAlert, Trash2, Check, X, UserX, UserCheck } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { resolveReport, removeMessage, suspendUser, unsuspendUser } from './actions'

const CATEGORY_LABELS: Record<string, string> = {
    spam: 'Spam',
    harassment: 'Harassment',
    hate_or_abuse: 'Hate or abuse',
    inappropriate: 'Inappropriate content',
    safety_concern: 'Safety concern',
    other: 'Other',
}

interface ReportRow {
    id: string
    category: string
    reason: string
    created_at: string
    message_id: string | null
    thread_id: string | null
    reported_user_id: string | null
    reporter: { id: string; full_name: string | null } | { id: string; full_name: string | null }[] | null
    reported: { id: string; full_name: string | null; suspended_at: string | null } | { id: string; full_name: string | null; suspended_at: string | null }[] | null
    message: { id: string; body: string; deleted_at: string | null } | { id: string; body: string; deleted_at: string | null }[] | null
}

function one<T>(rel: T | T[] | null): T | undefined {
    if (!rel) return undefined
    return Array.isArray(rel) ? rel[0] : rel
}

export default async function AdminReportsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login')
    }

    // Verify admin role (same guard as /app/admin/referees).
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        redirect('/app')
    }

    const { data: reports } = await supabase
        .from('reports')
        .select(`
      id, category, reason, created_at, message_id, thread_id, reported_user_id,
      reporter:profiles!reports_reporter_id_fkey(id, full_name),
      reported:profiles!reports_reported_user_id_fkey(id, full_name, suspended_at),
      message:messages!reports_message_id_fkey(id, body, deleted_at)
    `)
        .eq('status', 'open')
        .order('created_at', { ascending: false })

    const rows = (reports ?? []) as unknown as ReportRow[]

    // Server-action wrappers bound per-form. Using <form action={...}> keeps this
    // page a server component (so the admin guard + redirect work) with no client
    // JS — the actions re-verify admin server-side before mutating.
    async function resolveAction(reportId: string, formData: FormData) {
        'use server'
        const status = formData.get('status') === 'dismissed' ? 'dismissed' : 'resolved'
        const note = (formData.get('note') as string | null) ?? undefined
        await resolveReport(reportId, status, note)
    }

    async function removeMessageAction(messageId: string) {
        'use server'
        await removeMessage(messageId)
    }

    async function suspendAction(userId: string) {
        'use server'
        await suspendUser(userId)
    }

    async function unsuspendAction(userId: string) {
        'use server'
        await unsuspendUser(userId)
    }

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/app" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold">Reported content</h1>
                    <p className="text-sm text-[var(--foreground-muted)]">
                        {rows.length} open {rows.length === 1 ? 'report' : 'reports'}
                    </p>
                </div>
            </div>

            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>Review reported messages and users. Remove offending content or resolve / dismiss the report.</p>
            </div>

            {rows.length > 0 ? (
                <div className="space-y-3">
                    {rows.map((report) => {
                        const reporter = one(report.reporter)
                        const reported = one(report.reported)
                        const message = one(report.message)
                        const categoryLabel = CATEGORY_LABELS[report.category] || report.category
                        const messageRemoved = Boolean(message?.deleted_at)

                        return (
                            <div key={report.id} className="card p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-semibold">
                                                {categoryLabel}
                                            </span>
                                            <span className="text-xs text-[var(--foreground-muted)]">
                                                {new Date(report.created_at).toLocaleString('en-GB', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </span>
                                        </div>
                                        <p className="text-sm mt-2">
                                            <span className="text-[var(--foreground-muted)]">Reported by</span>{' '}
                                            <span className="font-medium">{reporter?.full_name || 'Unknown'}</span>
                                            {reported && (
                                                <>
                                                    {' '}
                                                    <span className="text-[var(--foreground-muted)]">against</span>{' '}
                                                    <span className="font-medium">{reported.full_name || 'Unknown'}</span>
                                                </>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {/* Reason */}
                                <p className="text-sm whitespace-pre-wrap break-words rounded-lg bg-[var(--background-soft)] p-3">
                                    {report.reason}
                                </p>

                                {/* Reported message preview */}
                                {message && (
                                    <div className="rounded-lg border border-[var(--border-color)] p-3">
                                        <p className="text-xs font-semibold text-[var(--foreground-muted)] mb-1">
                                            Reported message
                                        </p>
                                        <p className="text-sm whitespace-pre-wrap break-words">
                                            {messageRemoved ? (
                                                <span className="italic text-[var(--foreground-muted)]">
                                                    [removed by moderator]
                                                </span>
                                            ) : (
                                                message.body
                                            )}
                                        </p>
                                    </div>
                                )}

                                {/* Link to the conversation */}
                                {report.thread_id && (
                                    <Link
                                        href={`/app/messages/${report.thread_id}`}
                                        className="inline-block text-xs font-medium text-[var(--brand-primary)] hover:underline"
                                    >
                                        Open conversation →
                                    </Link>
                                )}

                                {/* Moderator actions */}
                                <div className="flex flex-col gap-3 border-t border-[var(--border-color)] pt-3">
                                    {report.message_id && !messageRemoved && (
                                        <form action={removeMessageAction.bind(null, report.message_id)}>
                                            <button
                                                type="submit"
                                                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                Remove message
                                            </button>
                                        </form>
                                    )}

                                    {report.reported_user_id && reported && (
                                        reported.suspended_at ? (
                                            <form action={unsuspendAction.bind(null, report.reported_user_id)}>
                                                <button
                                                    type="submit"
                                                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm font-medium text-[var(--foreground-muted)] hover:bg-[var(--neutral-50)]"
                                                >
                                                    <UserCheck className="h-4 w-4" />
                                                    Unsuspend {reported.full_name || 'user'}
                                                </button>
                                            </form>
                                        ) : (
                                            <form action={suspendAction.bind(null, report.reported_user_id)}>
                                                <button
                                                    type="submit"
                                                    className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
                                                >
                                                    <UserX className="h-4 w-4" />
                                                    Suspend {reported.full_name || 'user'}
                                                </button>
                                            </form>
                                        )
                                    )}

                                    <form action={resolveAction.bind(null, report.id)} className="space-y-2">
                                        <textarea
                                            name="note"
                                            rows={2}
                                            placeholder="Resolution note (optional)"
                                            className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] resize-y"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                type="submit"
                                                name="status"
                                                value="resolved"
                                                className="inline-flex items-center gap-2 rounded-lg bg-[var(--wc-green)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                                            >
                                                <Check className="h-4 w-4" />
                                                Resolve
                                            </button>
                                            <button
                                                type="submit"
                                                name="status"
                                                value="dismissed"
                                                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm font-medium text-[var(--foreground-muted)] hover:bg-[var(--neutral-50)]"
                                            >
                                                <X className="h-4 w-4" />
                                                Dismiss
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <EmptyState
                    title="No open reports"
                    description="Reported content will appear here for review."
                />
            )}
        </div>
    )
}
