'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getMatchFeed, expressInterest, getMyOffers, FeedBooking, FeedOffer } from './actions'
import { MatchFeedCard } from '@/components/app/MatchFeedCard'
import { useToast } from '@/components/ui/Toast'
import { CelebrationOverlay } from '@/components/ui/CelebrationOverlay'
import { StatusChip } from '@/components/ui/StatusChip'
import { useBookingUpdates } from '@/components/app/BookingUpdatesProvider'
import { ChevronLeft, Radar, MapPin, Inbox, CalendarDays, Clock, ChevronRight, Users } from 'lucide-react'
import { formatDate, formatTime, getStatusCardStyle } from '@/lib/utils'
import { cn } from '@/lib/utils'

type Tab = 'matches' | 'offers'

export default function FeedPage() {
    const [tab, setTab] = useState<Tab>('matches')
    const [bookings, setBookings] = useState<FeedBooking[]>([])
    const [offers, setOffers] = useState<FeedOffer[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [celebration, setCelebration] = useState<{ title: string; subtitle: string } | null>(null)
    const { showToast } = useToast()
    const { offerCount } = useBookingUpdates()

    const loadFeed = useCallback(async () => {
        setLoading(true)
        const result = await getMatchFeed()
        if (result.error) {
            setError(result.error)
        } else {
            setBookings(result.data || [])
        }
        setLoading(false)
    }, [])

    const loadOffers = useCallback(async () => {
        const result = await getMyOffers()
        if (!result.error) {
            setOffers(result.data || [])
        }
    }, [])

    useEffect(() => {
        // Initial fetch on mount. State updates happen after the awaited fetches
        // resolve, not synchronously in the effect body — the textbook
        // "subscribe for external updates" pattern.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadFeed()
        void loadOffers()
    }, [loadFeed, loadOffers])

    async function handleExpressInterest(bookingId: string) {
        const result = await expressInterest(bookingId)
        if (result.success) {
            setCelebration({
                title: 'Interest Sent!',
                subtitle: 'The coach has been notified',
            })
            setBookings(prev => prev.filter(b => b.id !== bookingId))
        } else if (result.error) {
            showToast({ message: result.error, type: 'error' })
        }
        return result
    }

    const sosBookings = bookings.filter(b => b.is_sos)
    const regularBookings = bookings.filter(b => !b.is_sos)

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto pb-24">
            {/* Celebration Overlay */}
            {celebration && (
                <CelebrationOverlay
                    icon="check-circle"
                    title={celebration.title}
                    subtitle={celebration.subtitle}
                    onComplete={() => setCelebration(null)}
                />
            )}

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <Link href="/app" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold">Feed</h1>
                    <p className="text-sm text-[var(--foreground-muted)]">
                        Matches &amp; offers
                    </p>
                </div>
                <Radar className="w-5 h-5 text-[var(--brand-primary)]" />
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-1 p-1 bg-[var(--neutral-100)] rounded-xl mb-6">
                <button
                    onClick={() => setTab('matches')}
                    className={cn(
                        'flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all',
                        tab === 'matches'
                            ? 'bg-white text-[var(--foreground)] shadow-sm'
                            : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                    )}
                >
                    <span className="flex items-center justify-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        Nearby Matches
                    </span>
                </button>
                <button
                    onClick={() => setTab('offers')}
                    className={cn(
                        'flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all relative',
                        tab === 'offers'
                            ? 'bg-white text-[var(--foreground)] shadow-sm'
                            : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                    )}
                >
                    <span className="flex items-center justify-center gap-1.5">
                        <Inbox className="w-3.5 h-3.5" />
                        My Offers
                        {offerCount > 0 && (
                            <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[var(--wc-red)] text-white text-[10px] font-bold">
                                {offerCount > 9 ? '9+' : offerCount}
                            </span>
                        )}
                    </span>
                </button>
            </div>

            {/* Matches Tab */}
            {tab === 'matches' && (
                <>
                    {/* Loading */}
                    {loading && (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="card p-4 animate-pulse">
                                    <div className="h-4 bg-[var(--neutral-200)] rounded w-1/3 mb-3" />
                                    <div className="h-3 bg-[var(--neutral-200)] rounded w-2/3 mb-2" />
                                    <div className="h-3 bg-[var(--neutral-200)] rounded w-1/2 mb-4" />
                                    <div className="h-9 bg-[var(--neutral-200)] rounded" />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Error */}
                    {error && !loading && (
                        <div className="card p-6 text-center">
                            <p className="text-sm text-red-500 mb-2">{error}</p>
                            <button
                                onClick={loadFeed}
                                className="text-sm font-medium text-[var(--brand-primary)] hover:underline"
                            >
                                Try again
                            </button>
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && !error && bookings.length === 0 && (
                        <div className="card p-8 text-center">
                            <MapPin className="w-12 h-12 mx-auto mb-3 text-[var(--neutral-300)]" />
                            <h2 className="font-semibold text-sm mb-1">No matches nearby</h2>
                            <p className="text-xs text-[var(--foreground-muted)] mb-4">
                                There are no available matches in your area right now. Check back later or increase your travel radius in Availability settings.
                            </p>
                            <Link
                                href="/app/availability"
                                className="text-sm font-medium text-[var(--brand-primary)] hover:underline"
                            >
                                Update travel radius
                            </Link>
                        </div>
                    )}

                    {/* SOS Bookings */}
                    {sosBookings.length > 0 && (
                        <div className="mb-6">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-red-500 mb-3">
                                Urgent Requests
                            </h2>
                            <div className="space-y-3">
                                {sosBookings.map(booking => (
                                    <MatchFeedCard
                                        key={booking.id}
                                        booking={booking}
                                        onExpressInterest={handleExpressInterest}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Regular Bookings */}
                    {regularBookings.length > 0 && (
                        <div>
                            {sosBookings.length > 0 && (
                                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground-muted)] mb-3">
                                    Available Matches
                                </h2>
                            )}
                            <div className="space-y-3">
                                {regularBookings.map(booking => (
                                    <MatchFeedCard
                                        key={booking.id}
                                        booking={booking}
                                        onExpressInterest={handleExpressInterest}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Offers Tab */}
            {tab === 'offers' && (
                <>
                    {offers.length > 0 ? (
                        <div className="space-y-4">
                            {offers.map((offer) => {
                                const isSent = offer.status === 'sent'
                                return (
                                    <Link
                                        key={offer.id}
                                        href={`/app/bookings/${offer.booking.id}`}
                                        className={`block card p-4 hover:border-[var(--color-primary)] transition-colors group ${getStatusCardStyle(offer.status)}`}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${isSent ? 'text-[var(--color-primary)] bg-blue-50' : 'text-emerald-700 bg-emerald-50'}`}>
                                                        {isSent ? 'New Request' : 'Price Sent'}
                                                    </span>
                                                    <span className="text-xs text-[var(--foreground-muted)]">
                                                        {formatDate(offer.created_at)}
                                                    </span>
                                                </div>
                                                <h2 className="text-base font-bold group-hover:text-[var(--color-primary)] transition-colors">
                                                    {offer.booking.ground_name || offer.booking.location_postcode}
                                                </h2>
                                                {!isSent && offer.price_pence && (
                                                    <p className="text-sm text-emerald-600 font-medium mt-0.5">
                                                        Your quote: &pound;{(offer.price_pence / 100).toFixed(2)}
                                                    </p>
                                                )}
                                            </div>
                                            <StatusChip status={isSent ? 'pending' : 'accepted_priced'} size="sm" />
                                        </div>

                                        {/* Teams */}
                                        {(offer.booking.home_team || offer.booking.away_team) && (
                                            <div className="flex items-center gap-2 mb-3 p-2.5 bg-[var(--neutral-50)] rounded-lg">
                                                <Users className="w-4 h-4 text-[var(--foreground-muted)] flex-shrink-0" />
                                                <div className="flex items-center gap-2 text-sm font-medium">
                                                    <span>{offer.booking.home_team || 'TBC'}</span>
                                                    <span className="text-[var(--foreground-muted)] text-xs">vs</span>
                                                    <span>{offer.booking.away_team || 'TBC'}</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                            <div className="flex items-center gap-2 text-sm">
                                                <CalendarDays className="w-4 h-4 text-[var(--foreground-muted)]" />
                                                <span className="font-medium">{formatDate(offer.booking.match_date)}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <Clock className="w-4 h-4 text-[var(--foreground-muted)]" />
                                                <span className="font-medium">{formatTime(offer.booking.kickoff_time)}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 mb-3">
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

                                        <div className="pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-[var(--wc-coach-blue)] flex items-center justify-center text-[10px] text-white font-bold">
                                                    {offer.booking.coach_name[0]}
                                                </div>
                                                <span className="text-xs text-[var(--foreground-muted)]">
                                                    From <span className="font-semibold text-[var(--foreground)]">{offer.booking.coach_name}</span>
                                                </span>
                                            </div>
                                            <span className="text-xs font-bold text-[var(--color-primary)] flex items-center gap-1">
                                                View
                                                <ChevronRight className="w-3 h-3" />
                                            </span>
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-[var(--border-color)]">
                            <div className="w-14 h-14 bg-[var(--neutral-50)] rounded-full flex items-center justify-center mx-auto mb-3">
                                <Inbox className="w-7 h-7 text-[var(--neutral-400)]" />
                            </div>
                            <h3 className="text-base font-bold mb-1">All caught up!</h3>
                            <p className="text-[var(--foreground-muted)] text-sm">
                                No pending offers at the moment.
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
