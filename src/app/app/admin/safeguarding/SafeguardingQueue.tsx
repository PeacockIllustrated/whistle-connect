'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ageOnDate } from '@/lib/constants'
import {
    approveParentalConsent,
    rejectParentalConsent,
    resendParentConsent,
    type MinorConsentRow,
} from './actions'
import { Check, X, Mail, ShieldCheck } from 'lucide-react'

type Feedback = { type: 'success' | 'error'; text: string }

export function SafeguardingQueue({ rows }: { rows: MinorConsentRow[] }) {
    const router = useRouter()
    const [pendingId, setPendingId] = useState<string | null>(null)
    const [feedback, setFeedback] = useState<Record<string, Feedback>>({})
    const [, startTransition] = useTransition()

    if (rows.length === 0) {
        return (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-6 text-center">
                <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-emerald-600" />
                <p className="text-sm font-medium text-emerald-800">All clear</p>
                <p className="text-xs text-[var(--foreground-muted)]">No under-18 accounts are awaiting consent.</p>
            </div>
        )
    }

    function run(
        refereeId: string,
        fn: (id: string) => Promise<{ success?: boolean; error?: string }>,
        okText: string,
    ) {
        setPendingId(refereeId)
        setFeedback((f) => {
            const next = { ...f }
            delete next[refereeId]
            return next
        })
        startTransition(async () => {
            const result = await fn(refereeId)
            setPendingId(null)
            if (result?.error) {
                setFeedback((f) => ({ ...f, [refereeId]: { type: 'error', text: result.error! } }))
            } else {
                setFeedback((f) => ({ ...f, [refereeId]: { type: 'success', text: okText } }))
                router.refresh()
            }
        })
    }

    return (
        <div className="space-y-3">
            {rows.map((row) => {
                const age = row.date_of_birth ? ageOnDate(row.date_of_birth) : null
                const awaiting = row.parental_consent_status === 'awaiting'
                const busy = pendingId === row.referee_id
                const fb = feedback[row.referee_id]
                return (
                    <div key={row.referee_id} className="rounded-xl border border-[var(--border-color)] bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-semibold text-[var(--foreground)]">{row.full_name}</p>
                                <p className="text-xs text-[var(--foreground-muted)]">
                                    {age !== null ? `Age ${age}` : 'Age unknown'}
                                    {row.parent_email ? ` • parent: ${row.parent_email}` : ' • no parent email on file'}
                                </p>
                            </div>
                            <span
                                className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                    awaiting
                                        ? 'border border-amber-200 bg-amber-50 text-amber-700'
                                        : 'border border-red-200 bg-red-50 text-red-700'
                                }`}
                            >
                                {awaiting ? 'Awaiting' : 'Rejected'}
                            </span>
                        </div>

                        {fb && (
                            <p className={`mt-2 text-xs ${fb.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
                                {fb.text}
                            </p>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2">
                            {awaiting && row.has_token && (
                                <button
                                    onClick={() => run(row.referee_id, resendParentConsent, 'Reminder sent to the parent/guardian.')}
                                    disabled={busy}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-medium hover:bg-[var(--neutral-100)] disabled:opacity-50"
                                >
                                    <Mail className="h-3.5 w-3.5" /> Resend parent email
                                </button>
                            )}
                            <button
                                onClick={() => run(row.referee_id, approveParentalConsent, 'Account approved.')}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                                <Check className="h-3.5 w-3.5" /> Approve
                            </button>
                            {awaiting && (
                                <button
                                    onClick={() => run(row.referee_id, rejectParentalConsent, 'Account rejected.')}
                                    disabled={busy}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                                >
                                    <X className="h-3.5 w-3.5" /> Reject
                                </button>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
