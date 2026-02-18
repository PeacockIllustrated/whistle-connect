'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { resolveVerificationRequest } from '../actions'

interface VerificationRequest {
    id: string
    fa_id: string
    county: string
    status: string
    requested_at: string
    referee: { id: string; full_name: string; avatar_url: string | null } | { id: string; full_name: string; avatar_url: string | null }[]
}

export function VerificationRequestList({ requests }: { requests: VerificationRequest[] }) {
    const [resolvingId, setResolvingId] = useState<string | null>(null)
    const [notes, setNotes] = useState<Record<string, string>>({})
    const [error, setError] = useState('')

    async function handleResolve(requestId: string, resolution: 'confirmed' | 'rejected') {
        setResolvingId(requestId)
        setError('')
        const result = await resolveVerificationRequest(requestId, resolution, notes[requestId] || undefined)
        if (result.error) setError(result.error)
        setResolvingId(null)
    }

    return (
        <div className="space-y-2">
            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {error}
                </div>
            )}
            {requests.map(req => {
                const referee = Array.isArray(req.referee) ? req.referee[0] : req.referee
                return (
                    <div key={req.id} className="card p-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-[var(--brand-primary)] flex items-center justify-center text-white font-semibold flex-shrink-0">
                                {referee?.full_name?.charAt(0) || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <Link
                                    href={`/app/admin/referees/${referee?.id}`}
                                    className="text-sm font-semibold hover:underline"
                                >
                                    {referee?.full_name || 'Unknown'}
                                </Link>
                                <p className="text-xs text-[var(--foreground-muted)]">
                                    FAN: <span className="font-mono">{req.fa_id}</span> — {req.county} FA
                                </p>
                                <p className="text-xs text-[var(--foreground-muted)]">
                                    Requested {new Date(req.requested_at).toLocaleDateString('en-GB')}
                                </p>
                                <div className="flex gap-2 mt-3">
                                    <input
                                        type="text"
                                        placeholder="Notes (optional)"
                                        value={notes[req.id] || ''}
                                        onChange={(e) => setNotes({ ...notes, [req.id]: e.target.value })}
                                        className="flex-1 px-2 py-1 text-sm border border-[var(--border-color)] rounded-md"
                                    />
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        loading={resolvingId === req.id}
                                        onClick={() => handleResolve(req.id, 'confirmed')}
                                    >
                                        Confirmed
                                    </Button>
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        loading={resolvingId === req.id}
                                        onClick={() => handleResolve(req.id, 'rejected')}
                                    >
                                        Rejected
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
