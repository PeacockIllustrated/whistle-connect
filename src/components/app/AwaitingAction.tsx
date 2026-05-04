'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBookingUpdates } from './BookingUpdatesProvider'
import { useToast } from '@/components/ui/Toast'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn, formatTime, getStatusCardStyle } from '@/lib/utils'
import { StatusChip } from '@/components/ui/StatusChip'
import { ConfirmDialog } from '@/components/ui/Modal'
import { SwipeableCard } from '@/components/ui/SwipeableCard'
import {
    cancelBooking,
    archiveOfferAsCoach,
    archiveOfferAsReferee,
} from '@/app/app/bookings/actions'
import { Check, X, Clock } from 'lucide-react'

/* ──────────────────────────────────────────────
   Supabase join result type for offer queries
   ────────────────────────────────────────────── */
interface OfferQueryResult {
    id: string
    status: string
    price_pence?: number | null
    booking: {
        id: string
        status: string
        match_date: string
        kickoff_time: string
        ground_name: string | null
        location_postcode: string
        address_text: string | null
        coach_id?: string
    } | {
        id: string
        status: string
        match_date: string
        kickoff_time: string
        ground_name: string | null
        location_postcode: string
        address_text: string | null
        coach_id?: string
    }[]
    referee?: { full_name: string } | { full_name: string }[]
    coach?: { coach: { full_name: string } | { full_name: string }[] } | { coach: { full_name: string } | { full_name: string }[] }[]
    created_at: string
}

/* ──────────────────────────────────────────────
   Shared types
   ────────────────────────────────────────────── */
export interface ActionItem {
    id: string            // offer id
    bookingId: string
    status: string        // offer status
    bookingStatus: string
    matchDate: string
    kickoffTime: string
    venue: string
    price?: number | null // pence
    refereeName?: string
    coachName?: string
}

/* ──────────────────────────────────────────────
   COACH:  Awaiting Action
   - accepted_priced offers (legacy: ref proposed price)
   - sent offers with no price set (ref tapped "I'm Available" → coach
     must confirm with a fee, handled on the booking detail page)
   ────────────────────────────────────────────── */
export function CoachAwaitingAction({ initialItems }: { initialItems: ActionItem[] }) {
    const [items, setItems] = useState<ActionItem[]>(initialItems)
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [cancelId, setCancelId] = useState<string | null>(null)
    const { subscribe } = useBookingUpdates()
    const { showToast } = useToast()
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        setItems(initialItems)
    }, [initialItems])

    const refetch = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Two queries unioned in JS — Supabase JS doesn't natively OR across
        // distinct status values cleanly, and keeping them separate makes the
        // intent obvious.
        const [{ data: priced }, { data: unpriced }] = await Promise.all([
            supabase
                .from('booking_offers')
                .select(`
                    id, status, price_pence,
                    booking:bookings!inner(
                        id, status, match_date, kickoff_time,
                        ground_name, location_postcode, address_text, coach_id
                    ),
                    referee:profiles!booking_offers_referee_id_fkey(full_name)
                `)
                .eq('status', 'accepted_priced')
                .is('coach_archived_at', null)
                .eq('bookings.coach_id', user.id)
                .neq('bookings.status', 'cancelled')
                .order('created_at', { ascending: false }),
            supabase
                .from('booking_offers')
                .select(`
                    id, status, price_pence,
                    booking:bookings!inner(
                        id, status, match_date, kickoff_time,
                        ground_name, location_postcode, address_text, coach_id
                    ),
                    referee:profiles!booking_offers_referee_id_fkey(full_name)
                `)
                .eq('status', 'sent')
                .is('price_pence', null)
                .is('coach_archived_at', null)
                .eq('bookings.coach_id', user.id)
                .neq('bookings.status', 'cancelled')
                .order('created_at', { ascending: false }),
        ])

        const combined = [...(priced || []), ...(unpriced || [])] as OfferQueryResult[]

        setItems(
            combined.map((o) => {
                const booking = Array.isArray(o.booking) ? o.booking[0] : o.booking
                const referee = o.referee ? (Array.isArray(o.referee) ? o.referee[0] : o.referee) : null
                return {
                    id: o.id,
                    bookingId: booking.id,
                    status: o.status,
                    bookingStatus: booking.status,
                    matchDate: booking.match_date,
                    kickoffTime: booking.kickoff_time,
                    venue: booking.address_text || booking.ground_name || booking.location_postcode,
                    price: o.price_pence ?? null,
                    refereeName: referee?.full_name,
                }
            })
        )
    }, [supabase])

    useEffect(() => {
        return subscribe((update) => {
            if (update.table === 'booking_offers') {
                const offerId = update.new?.id as string
                const newStatus = update.new?.status as string

                if (offerId && newStatus && !['accepted_priced', 'sent'].includes(newStatus)) {
                    setItems(prev => prev.filter(i => i.id !== offerId))
                }
                if (newStatus === 'accepted_priced' || newStatus === 'sent') {
                    refetch()
                }
            }

            if (update.table === 'bookings') {
                const newStatus = update.new?.status as string
                if (newStatus === 'confirmed' || newStatus === 'cancelled') {
                    refetch()
                }
            }
        })
    }, [subscribe, refetch])

    // Legacy accepted_priced flow now redirects refs to confirm directly. Kept
    // as a hint so coaches don't think the card is broken.
    const handleAcceptInfo = () => {
        showToast({ message: 'Referees now confirm bookings directly when accepting.', type: 'info' })
    }

    const handleCancel = async (item: ActionItem) => {
        setLoadingId(item.id)
        try {
            const result = await cancelBooking(item.bookingId)
            if (result.error) {
                showToast({ message: result.error, type: 'error' })
            } else {
                showToast({ message: 'Booking cancelled', type: 'success' })
                setItems(prev => prev.filter(i => i.id !== item.id))
                await refetch()
                router.refresh()
            }
        } catch {
            showToast({ message: 'Failed to cancel booking', type: 'error' })
        } finally {
            setLoadingId(null)
            setCancelId(null)
        }
    }

    const handleArchive = async (offerId: string) => {
        // Optimistic remove
        setItems(prev => prev.filter(i => i.id !== offerId))
        const result = await archiveOfferAsCoach(offerId)
        if (result.error) {
            showToast({ message: result.error, type: 'error' })
            // Re-sync from server on failure
            refetch()
        }
    }

    if (items.length === 0) return null

    const cancelItem = cancelId ? items.find(i => i.id === cancelId) : null

    // Split by sub-flow
    const acceptedPriced = items.filter(i => i.status === 'accepted_priced')
    const sentUnpriced = items.filter(i => i.status === 'sent')

    return (
        <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
                <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                </span>
                <h2 className="font-semibold text-[var(--foreground)]">Awaiting Your Action</h2>
                <span className="ml-auto px-2 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full">
                    {items.length}
                </span>
            </div>

            {/* Refs ready to confirm — tap card to set fee on the detail page */}
            {sentUnpriced.length > 0 && (
                <>
                    <p className="text-xs text-[var(--foreground-muted)] mb-2">
                        Referees who tapped &quot;I&apos;m Available&quot; — set a fee to confirm.
                    </p>
                    <div className="space-y-2 mb-3">
                        {sentUnpriced.map((item) => (
                            <SwipeableCard
                                key={item.id}
                                onArchive={() => handleArchive(item.id)}
                            >
                                <Link
                                    href={`/app/bookings/${item.bookingId}`}
                                    className={cn(
                                        'flex items-center gap-3 p-3 rounded-xl border border-[var(--border-color)]',
                                        'bg-amber-50/60 hover:bg-amber-50',
                                        'transition-colors'
                                    )}
                                >
                                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-100 flex flex-col items-center justify-center">
                                        <span className="text-xs font-bold text-amber-700">
                                            {new Date(item.matchDate).getDate()}
                                        </span>
                                        <span className="text-[10px] text-amber-500 uppercase">
                                            {new Date(item.matchDate).toLocaleDateString('en', { month: 'short' })}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">
                                            {item.refereeName || 'A referee'} is available
                                        </p>
                                        <p className="text-xs text-[var(--foreground-muted)] truncate">
                                            {item.venue} · {formatTime(item.kickoffTime)}
                                        </p>
                                    </div>
                                    <span className="text-[10px] font-semibold text-amber-700">
                                        Confirm
                                    </span>
                                </Link>
                            </SwipeableCard>
                        ))}
                    </div>
                </>
            )}

            {/* Legacy accepted_priced — ref proposed a price, coach confirms */}
            {acceptedPriced.length > 0 && (
                <div className="space-y-3">
                    {acceptedPriced.map((item) => {
                        const isLoading = loadingId === item.id
                        const displayPrice = item.price != null ? (item.price / 100).toFixed(2) : null
                        return (
                            <SwipeableCard
                                key={item.id}
                                onArchive={() => handleArchive(item.id)}
                            >
                                <div
                                    className={cn(
                                        'rounded-xl border border-[var(--border-color)] overflow-hidden',
                                        'transition-all duration-200',
                                        getStatusCardStyle('accepted_priced')
                                    )}
                                >
                                    <Link
                                        href={`/app/bookings/${item.bookingId}`}
                                        className="flex items-center gap-3 p-3"
                                    >
                                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 flex flex-col items-center justify-center">
                                            <span className="text-xs font-bold text-indigo-700">
                                                {new Date(item.matchDate).getDate()}
                                            </span>
                                            <span className="text-[10px] text-indigo-500 uppercase">
                                                {new Date(item.matchDate).toLocaleDateString('en', { month: 'short' })}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">{item.venue}</p>
                                            <p className="text-xs text-[var(--foreground-muted)]">
                                                {item.refereeName && <span>{item.refereeName} · </span>}
                                                {formatTime(item.kickoffTime)}
                                            </p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            {displayPrice && (
                                                <p className="text-lg font-bold text-green-700">&pound;{displayPrice}</p>
                                            )}
                                        </div>
                                    </Link>
                                    <div className="flex border-t border-[var(--border-color)]">
                                        <button
                                            onClick={handleAcceptInfo}
                                            disabled={isLoading}
                                            className={cn(
                                                'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold',
                                                'text-green-700 bg-green-50 hover:bg-green-100 active:bg-green-200',
                                                'transition-colors disabled:opacity-50',
                                                'border-r border-[var(--border-color)]'
                                            )}
                                        >
                                            <Check className="w-4 h-4" strokeWidth={2.5} />
                                            Accept
                                        </button>
                                        <button
                                            onClick={() => setCancelId(item.id)}
                                            disabled={isLoading}
                                            className={cn(
                                                'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold',
                                                'text-red-600 bg-red-50 hover:bg-red-100 active:bg-red-200',
                                                'transition-colors disabled:opacity-50'
                                            )}
                                        >
                                            <X className="w-4 h-4" strokeWidth={2.5} />
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </SwipeableCard>
                        )
                    })}
                </div>
            )}

            <ConfirmDialog
                isOpen={!!cancelId}
                onClose={() => setCancelId(null)}
                onConfirm={() => cancelItem && handleCancel(cancelItem)}
                title="Cancel Booking"
                message="Are you sure you want to cancel this booking? The referee will be notified and this action cannot be undone."
                confirmLabel="Yes, Cancel"
                variant="danger"
            />
        </section>
    )
}

/* ──────────────────────────────────────────────
   REFEREE:  New Offers + Awaiting Coach
   - "New Offers" — sent offers with price_pence > 0 (coach offered a fee,
     ref must respond)
   - "Awaiting Coach" — sent offers with no price yet (ref tapped
     "I'm Available", waiting on coach to confirm with a fee)
   ────────────────────────────────────────────── */
export function RefereeAwaitingAction({ initialItems }: { initialItems: ActionItem[] }) {
    const [items, setItems] = useState<ActionItem[]>(initialItems)
    const { subscribe } = useBookingUpdates()
    const { showToast } = useToast()
    const supabase = createClient()

    useEffect(() => {
        setItems(initialItems)
    }, [initialItems])

    const refetch = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('booking_offers')
            .select(`
                id,
                status,
                price_pence,
                booking:bookings!inner(
                    id, status, match_date, kickoff_time,
                    ground_name, location_postcode, address_text
                ),
                coach:bookings!inner(coach:profiles!bookings_coach_id_fkey(full_name))
            `)
            .eq('referee_id', user.id)
            .eq('status', 'sent')
            .is('referee_archived_at', null)
            .order('created_at', { ascending: false })

        if (!data) return

        setItems(
            (data as OfferQueryResult[]).map((o) => {
                const booking = Array.isArray(o.booking) ? o.booking[0] : o.booking
                const coachJoin = o.coach ? (Array.isArray(o.coach) ? o.coach[0] : o.coach) : null
                const coach = coachJoin?.coach
                    ? (Array.isArray(coachJoin.coach) ? coachJoin.coach[0] : coachJoin.coach)
                    : null
                return {
                    id: o.id,
                    bookingId: booking.id,
                    status: o.status,
                    bookingStatus: booking.status,
                    matchDate: booking.match_date,
                    kickoffTime: booking.kickoff_time,
                    venue: booking.address_text || booking.ground_name || booking.location_postcode,
                    price: o.price_pence ?? null,
                    coachName: coach?.full_name,
                }
            })
        )
    }, [supabase])

    useEffect(() => {
        return subscribe((update) => {
            if (update.table === 'booking_offers') {
                const offerId = update.new?.id as string
                const newStatus = update.new?.status as string

                if (offerId && newStatus && newStatus !== 'sent') {
                    setItems(prev => prev.filter(i => i.id !== offerId))
                }
                if (newStatus === 'sent') {
                    refetch()
                }
            }
            if (update.table === 'bookings') {
                const newStatus = update.new?.status as string
                if (newStatus === 'cancelled') {
                    refetch()
                }
            }
        })
    }, [subscribe, refetch])

    const handleArchive = async (offerId: string) => {
        setItems(prev => prev.filter(i => i.id !== offerId))
        const result = await archiveOfferAsReferee(offerId)
        if (result.error) {
            showToast({ message: result.error, type: 'error' })
            refetch()
        }
    }

    const priced = items.filter(i => (i.price ?? 0) > 0)
    const unpriced = items.filter(i => !((i.price ?? 0) > 0))

    if (items.length === 0) return null

    return (
        <>
            {/* New Offers — coach has set a fee, ref needs to respond */}
            {priced.length > 0 && (
                <section className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                        </span>
                        <h2 className="font-semibold text-[var(--foreground)]">New Offers</h2>
                        <span className="ml-auto px-2 py-0.5 text-[10px] font-bold bg-blue-500 text-white rounded-full">
                            {priced.length}
                        </span>
                    </div>
                    <div className="space-y-2">
                        {priced.map((item) => (
                            <SwipeableCard key={item.id} onArchive={() => handleArchive(item.id)}>
                                <Link
                                    href={`/app/bookings/${item.bookingId}`}
                                    className={cn(
                                        'flex items-center gap-3 p-3 rounded-xl border border-[var(--border-color)]',
                                        'transition-all duration-200 hover:shadow-md',
                                        getStatusCardStyle('sent')
                                    )}
                                >
                                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex flex-col items-center justify-center">
                                        <span className="text-xs font-bold text-blue-700">
                                            {new Date(item.matchDate).getDate()}
                                        </span>
                                        <span className="text-[10px] text-blue-500 uppercase">
                                            {new Date(item.matchDate).toLocaleDateString('en', { month: 'short' })}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{item.venue}</p>
                                        <p className="text-xs text-[var(--foreground-muted)]">
                                            {item.coachName && <span>{item.coachName} · </span>}
                                            {formatTime(item.kickoffTime)}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        {item.price != null && item.price > 0 && (
                                            <p className="text-sm font-bold text-green-700">
                                                &pound;{(item.price / 100).toFixed(2)}
                                            </p>
                                        )}
                                        <StatusChip status="sent" size="sm" />
                                        <span className="text-[10px] text-blue-600 font-semibold">Respond</span>
                                    </div>
                                </Link>
                            </SwipeableCard>
                        ))}
                    </div>
                </section>
            )}

            {/* Awaiting Coach — ref tapped I'm Available, waiting on coach to confirm + price */}
            {unpriced.length > 0 && (
                <section className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <h2 className="font-semibold text-[var(--foreground)]">Awaiting Coach</h2>
                        <span className="ml-auto px-2 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full">
                            {unpriced.length}
                        </span>
                    </div>
                    <p className="text-xs text-[var(--foreground-muted)] mb-2">
                        You tapped &quot;I&apos;m Available&quot; on these matches. The coach will confirm a fee and book you in.
                    </p>
                    <div className="space-y-2">
                        {unpriced.map((item) => (
                            <SwipeableCard key={item.id} onArchive={() => handleArchive(item.id)}>
                                <Link
                                    href={`/app/bookings/${item.bookingId}`}
                                    className={cn(
                                        'flex items-center gap-3 p-3 rounded-xl border border-amber-200',
                                        'bg-amber-50/60 hover:bg-amber-50',
                                        'transition-colors'
                                    )}
                                >
                                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-100 flex flex-col items-center justify-center">
                                        <span className="text-xs font-bold text-amber-700">
                                            {new Date(item.matchDate).getDate()}
                                        </span>
                                        <span className="text-[10px] text-amber-500 uppercase">
                                            {new Date(item.matchDate).toLocaleDateString('en', { month: 'short' })}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{item.venue}</p>
                                        <p className="text-xs text-[var(--foreground-muted)]">
                                            {item.coachName && <span>{item.coachName} · </span>}
                                            {formatTime(item.kickoffTime)}
                                        </p>
                                    </div>
                                    <span className="text-[10px] text-amber-700 font-semibold">
                                        Waiting
                                    </span>
                                </Link>
                            </SwipeableCard>
                        ))}
                    </div>
                </section>
            )}
        </>
    )
}
