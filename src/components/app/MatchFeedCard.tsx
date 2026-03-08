'use client'

import { useState, useTransition } from 'react'
import { MapPin, Clock, Users, Banknote, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { FeedBooking } from '@/app/app/feed/actions'

interface MatchFeedCardProps {
    booking: FeedBooking
    onExpressInterest: (bookingId: string) => Promise<{ success?: boolean; error?: string }>
}

export function MatchFeedCard({ booking, onExpressInterest }: MatchFeedCardProps) {
    const [isPending, startTransition] = useTransition()
    const [expressed, setExpressed] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleInterest = () => {
        startTransition(async () => {
            setError(null)
            const result = await onExpressInterest(booking.id)
            if (result.error) {
                setError(result.error)
            } else {
                setExpressed(true)
            }
        })
    }

    const matchDate = new Date(booking.match_date + 'T00:00:00')
    const isToday = matchDate.toDateString() === new Date().toDateString()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const isTomorrow = matchDate.toDateString() === tomorrow.toDateString()

    const dateLabel = isToday
        ? 'Today'
        : isTomorrow
            ? 'Tomorrow'
            : matchDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

    const kickoff = booking.kickoff_time?.slice(0, 5) || ''

    return (
        <div className={`card overflow-hidden transition-all ${booking.is_sos ? 'ring-2 ring-red-400' : ''}`}>
            {/* SOS Banner */}
            {booking.is_sos && (
                <div className="bg-red-500 text-white px-4 py-1.5 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Urgent - SOS Request</span>
                </div>
            )}

            <div className="p-4">
                {/* Top row: date/time + distance badge */}
                <div className="flex items-start justify-between mb-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{dateLabel}</span>
                            {(isToday || isTomorrow) && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${isToday ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                    {isToday ? 'Today' : 'Tomorrow'}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-[var(--foreground-muted)]">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-xs">{kickoff} kick-off</span>
                        </div>
                    </div>
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] text-xs font-bold">
                        <MapPin className="w-3.5 h-3.5" />
                        {booking.distance_km} km
                    </span>
                </div>

                {/* Match info */}
                <div className="space-y-2 mb-3">
                    {booking.ground_name && (
                        <p className="font-semibold text-sm truncate">{booking.ground_name}</p>
                    )}
                    {(booking.home_team || booking.away_team) && (
                        <p className="text-xs text-[var(--foreground-muted)]">
                            {booking.home_team || 'TBC'} vs {booking.away_team || 'TBC'}
                        </p>
                    )}
                </div>

                {/* Tags row */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {booking.age_group && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--neutral-100)] text-[var(--foreground-muted)] text-[10px] font-medium">
                            <Users className="w-3 h-3" />
                            {booking.age_group}
                        </span>
                    )}
                    {booking.format && (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--neutral-100)] text-[var(--foreground-muted)] text-[10px] font-medium">
                            {booking.format}
                        </span>
                    )}
                    {booking.budget_pounds && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                            <Banknote className="w-3 h-3" />
                            &pound;{booking.budget_pounds}
                        </span>
                    )}
                </div>

                {/* Coach info */}
                <p className="text-[10px] text-[var(--foreground-muted)] mb-3">
                    Posted by {booking.coach_name}
                </p>

                {/* Action */}
                {error && (
                    <p className="text-xs text-red-500 mb-2">{error}</p>
                )}
                {expressed ? (
                    <div className="text-center py-2 text-sm font-semibold text-emerald-600">
                        Interest sent — awaiting coach response
                    </div>
                ) : (
                    <Button
                        fullWidth
                        size="sm"
                        onClick={handleInterest}
                        loading={isPending}
                        variant={booking.is_sos ? 'danger' : 'primary'}
                    >
                        {booking.is_sos ? "I'm Available (Urgent)" : "I'm Available"}
                    </Button>
                )}
            </div>
        </div>
    )
}
