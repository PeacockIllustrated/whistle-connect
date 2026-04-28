'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { StatusChip } from '@/components/ui/StatusChip'
import { ConfirmDialog } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { VenueMap } from '@/components/ui/VenueMap'
import { declineOffer } from '@/app/app/bookings/actions'
import { formatDate, formatTime, getStatusCardStyle } from '@/lib/utils'
import { Users, CalendarDays, Clock, ChevronRight, X } from 'lucide-react'

export interface RefereeOfferCardData {
    id: string
    status: string
    price_pence: number | null
    match_fee_pence: number | null
    travel_cost_pence: number | null
    travel_distance_km: number | null
    created_at: string
    booking: {
        id: string
        match_date: string
        kickoff_time: string
        ground_name: string | null
        location_postcode: string
        age_group: string | null
        format: string | null
        home_team: string | null
        away_team: string | null
        coach: { full_name: string }
    }
}

export function RefereeOfferCard({ offer }: { offer: RefereeOfferCardData }) {
    const router = useRouter()
    const { showToast } = useToast()
    const [showConfirm, setShowConfirm] = useState(false)
    const [removed, setRemoved] = useState(false)
    const [isPending, startTransition] = useTransition()

    if (removed) return null

    const handleRemove = () => {
        startTransition(async () => {
            const result = await declineOffer(offer.id)
            if (result.error) {
                showToast({ message: result.error, type: 'error' })
                return
            }
            setRemoved(true)
            showToast({ message: 'Offer removed', type: 'info' })
            router.refresh()
        })
    }

    return (
        <>
            <div className={`relative card p-4 transition-colors group ${getStatusCardStyle(offer.status)}`}>
                {/* Remove button — top-right corner, outside the link */}
                <button
                    type="button"
                    aria-label="Remove this offer"
                    onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setShowConfirm(true)
                    }}
                    disabled={isPending}
                    className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/80 hover:bg-red-50 border border-[var(--border-color)] hover:border-red-200 flex items-center justify-center text-[var(--neutral-500)] hover:text-red-600 transition-colors disabled:opacity-50"
                >
                    <X className="w-4 h-4" />
                </button>

                <Link
                    href={`/app/bookings/${offer.booking.id}`}
                    className="block hover:opacity-95 transition-opacity"
                >
                    <div className="flex justify-between items-start mb-4 pr-10">
                        <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded text-emerald-700 bg-emerald-50">
                                    {offer.price_pence ? `£${(offer.price_pence / 100).toFixed(2)} offered` : 'New Offer'}
                                </span>
                                <span className="text-xs text-[var(--foreground-muted)]">
                                    Received {formatDate(offer.created_at)}
                                </span>
                            </div>
                            <h2 className="text-lg font-bold group-hover:text-[var(--color-primary)] transition-colors">
                                {offer.booking.ground_name || offer.booking.location_postcode}
                            </h2>
                            {offer.match_fee_pence != null && offer.travel_cost_pence != null && offer.travel_cost_pence > 0 && (
                                <p className="text-[10px] text-[var(--foreground-muted)] mt-0.5">
                                    Fee £{(offer.match_fee_pence / 100).toFixed(2)} + Travel £{(offer.travel_cost_pence / 100).toFixed(2)}
                                    {offer.travel_distance_km ? ` (${offer.travel_distance_km} km)` : ''}
                                </p>
                            )}
                        </div>
                        <StatusChip status="pending" size="sm" />
                    </div>

                    {(offer.booking.home_team || offer.booking.away_team) && (
                        <div className="flex items-center gap-2 mb-4 p-3 bg-[var(--neutral-50)] rounded-lg">
                            <Users className="w-5 h-5 text-[var(--foreground-muted)] flex-shrink-0" />
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <span>{offer.booking.home_team || 'TBC'}</span>
                                <span className="text-[var(--foreground-muted)] text-xs">vs</span>
                                <span>{offer.booking.away_team || 'TBC'}</span>
                            </div>
                        </div>
                    )}

                    <div className="mb-4">
                        <VenueMap postcode={offer.booking.location_postcode} height={120} />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="flex items-center gap-2 text-sm">
                            <CalendarDays className="w-4 h-4 text-[var(--foreground-muted)]" />
                            <span className="font-medium">{formatDate(offer.booking.match_date)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4 text-[var(--foreground-muted)]" />
                            <span className="font-medium">{formatTime(offer.booking.kickoff_time)}</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                        {offer.booking.age_group && (
                            <span className="text-xs bg-[var(--neutral-100)] px-2 py-1 rounded font-medium">
                                {offer.booking.age_group}
                            </span>
                        )}
                        {offer.booking.format && (
                            <span className="text-xs bg-[var(--neutral-100)] px-2 py-1 rounded font-medium">
                                {offer.booking.format}
                            </span>
                        )}
                    </div>

                    <div className="pt-4 border-t border-[var(--border-color)] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[var(--wc-coach-blue)] flex items-center justify-center text-[10px] text-white font-bold">
                                {offer.booking.coach.full_name[0]}
                            </div>
                            <span className="text-xs text-[var(--foreground-muted)]">
                                Sent by <span className="font-semibold text-[var(--foreground)]">{offer.booking.coach.full_name}</span>
                            </span>
                        </div>
                        <span className="text-xs font-bold text-[var(--color-primary)] flex items-center gap-1">
                            View Details
                            <ChevronRight className="w-3 h-3" />
                        </span>
                    </div>
                </Link>
            </div>

            <ConfirmDialog
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleRemove}
                title="Remove this offer?"
                message="This will decline the offer and remove it from your list. The coach will be notified."
                confirmLabel="Remove"
                variant="danger"
            />
        </>
    )
}
