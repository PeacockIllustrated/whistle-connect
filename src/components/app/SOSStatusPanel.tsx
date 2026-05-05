'use client'

import { useEffect, useState } from 'react'
import { Radio, Clock, AlertTriangle } from 'lucide-react'

interface SOSStatusPanelProps {
    /** ISO timestamp of when the SOS broadcast expires (booking.sos_expires_at). */
    expiresAt: string | null
    /** Number of referees the SOS was broadcast to (count of status='sent' offers). */
    broadcastCount: number
}

/**
 * Small at-a-glance panel rendered on the booking detail page for SOS
 * bookings that haven't been claimed yet. Replaces the (misleading) OFFERS
 * list with concrete visibility into what's actually happening: how many
 * refs got the alert, and how long they have left to respond.
 *
 * Once `expiresAt` passes, the panel flips to an "expired" state nudging
 * the coach toward the Find Referees fallback.
 */
export function SOSStatusPanel({ expiresAt, broadcastCount }: SOSStatusPanelProps) {
    // Tick once per second only while the deadline is in the future. Using
    // Date.now() rather than memoising avoids drift when the tab is backgrounded.
    const [now, setNow] = useState(() => Date.now())
    const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : null
    const remainingMs = expiresAtMs ? expiresAtMs - now : null
    const expired = remainingMs !== null && remainingMs <= 0

    useEffect(() => {
        if (expired || !expiresAtMs) return
        const interval = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(interval)
    }, [expired, expiresAtMs])

    if (broadcastCount === 0 && !expiresAtMs) {
        return null
    }

    if (expired) {
        return (
            <div className="card p-4 mt-4 border-amber-200 bg-amber-50">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-amber-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-amber-900">SOS broadcast expired</p>
                        <p className="text-sm text-amber-800 mt-0.5">
                            Nobody claimed the alert in time. Use{' '}
                            <span className="font-semibold">Find Referees</span> below to
                            invite refs directly.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="card p-4 mt-4 border-[var(--wc-red)]/20 bg-[var(--wc-red)]/5">
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[var(--wc-red)]/15 flex items-center justify-center">
                    <Radio className="w-5 h-5 text-[var(--wc-red)]" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="font-semibold text-[var(--foreground)]">
                            SOS broadcast in progress
                        </p>
                        {remainingMs !== null && (
                            <span
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--wc-red)] bg-white px-2 py-0.5 rounded-full border border-[var(--wc-red)]/20"
                                aria-live="polite"
                            >
                                <Clock className="w-3 h-3" />
                                {formatRemaining(remainingMs)}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-[var(--foreground-muted)] mt-1">
                        Alert sent to{' '}
                        <span className="font-semibold text-[var(--foreground)]">
                            {broadcastCount}
                        </span>{' '}
                        nearby {broadcastCount === 1 ? 'referee' : 'referees'}. The first to
                        accept gets the booking.
                    </p>
                </div>
            </div>
        </div>
    )
}

/**
 * Formats a millisecond duration as the largest two units that read naturally
 * to a coach checking at a glance. Examples:
 *   1h 47m left   (more than an hour)
 *   12m 30s left  (less than an hour)
 *   45s left      (final minute)
 */
function formatRemaining(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
        return `${hours}h ${minutes}m left`
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds.toString().padStart(2, '0')}s left`
    }
    return `${seconds}s left`
}
