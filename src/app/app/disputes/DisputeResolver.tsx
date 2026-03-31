'use client'

import { useState } from 'react'
import { resolveDispute } from './actions'
import type { Dispute } from '@/lib/types'

export default function DisputeResolver({ dispute }: { dispute: Dispute }) {
    const [resolution, setResolution] = useState<string>('')
    const [notes, setNotes] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleResolve() {
        if (!resolution || !notes) return
        setLoading(true)
        setError(null)

        const result = await resolveDispute(
            dispute.id,
            resolution as 'resolved_coach' | 'resolved_referee' | 'resolved_split',
            notes
        )

        if (result.error) {
            setError(result.error)
            setLoading(false)
            return
        }
    }

    return (
        <div className="rounded-xl border-2 border-red-200 dark:border-red-800 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Booking: {dispute.booking_id.substring(0, 8)}...</p>
                <span className="text-xs rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-2 py-1">
                    Open
                </span>
            </div>

            <p className="text-sm">{dispute.reason}</p>
            <p className="text-xs text-muted-foreground">
                Raised: {new Date(dispute.created_at).toLocaleDateString('en-GB')}
            </p>

            <div className="border-t pt-3 space-y-2">
                <label className="text-sm font-medium">Resolution</label>
                <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full rounded-lg border bg-background p-2 text-sm"
                >
                    <option value="">Select resolution...</option>
                    <option value="resolved_coach">Refund to Coach</option>
                    <option value="resolved_referee">Release to Referee</option>
                    <option value="resolved_split">Split</option>
                </select>

                <label className="text-sm font-medium">Admin Notes (required)</label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Explain the resolution..."
                    className="w-full rounded-lg border bg-background p-2 text-sm min-h-[80px]"
                />

                {error && <p className="text-xs text-red-500">{error}</p>}

                <button
                    onClick={handleResolve}
                    disabled={!resolution || !notes || loading}
                    className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                    {loading ? 'Processing...' : 'Resolve Dispute'}
                </button>
            </div>
        </div>
    )
}
