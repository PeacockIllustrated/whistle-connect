'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBookingUpdates } from './BookingUpdatesProvider'
import { useToast } from '@/components/ui/Toast'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn, formatDate, formatTime, getStatusCardStyle } from '@/lib/utils'
import { StatusChip } from '@/components/ui/StatusChip'
import { ConfirmDialog } from '@/components/ui/Modal'
import { confirmPrice, cancelBooking } from '@/app/app/bookings/actions'
import { Check, X } from 'lucide-react'

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
interface ActionItem {
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
   Shows offers that are accepted_priced (referee
   proposed a price, coach needs to confirm)
   ────────────────────────────────────────────── */
export function CoachAwaitingAction({ initialItems }: { initialItems: ActionItem[] }) {
    const [items, setItems] = useState<ActionItem[]>(initialItems)
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [cancelId, setCancelId] = useState<string | null>(null) // which item shows cancel dialog
    const { subscribe } = useBookingUpdates()
    const { showToast } = useToast()
    const router = useRouter()
    const supabase = createClient()

    // Sync state when server re-renders with updated initialItems
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
                    ground_name, location_postcode, address_text, coach_id
                ),
                referee:profiles!booking_offers_referee_id_fkey(full_name)
            `)
            .eq('status', 'accepted_priced')
            .eq('bookings.coach_id', user.id)
            .order('created_at', { ascending: false })

        if (!data) return

        setItems(
            (data as OfferQueryResult[]).map((o) => {
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
                    price: o.price_pence,
                    refereeName: referee?.full_name,
                }
            })
        )
    }, [supabase])

    // Subscribe to real-time updates — optimistically remove confirmed items, refetch for new ones
    useEffect(() => {
        return subscribe((update) => {
            if (update.table === 'booking_offers') {
                const offerId = update.new?.id as string
                const newStatus = update.new?.status as string

                // If an offer we're tracking moved away from accepted_priced, remove it instantly
                if (offerId && newStatus && newStatus !== 'accepted_priced') {
                    setItems(prev => {
                        const next = prev.filter(i => i.id !== offerId)
                        if (next.length !== prev.length) return next
                        // Not one of ours — could be a new accepted_priced offer, so refetch
                        return prev
                    })
                }

                // If a new offer arrived at accepted_priced, refetch to pick it up
                if (newStatus === 'accepted_priced') {
                    refetch()
                }
            }

            // If a booking status changed to confirmed/cancelled, refetch to clean up
            if (update.table === 'bookings') {
                const newStatus = update.new?.status as string
                if (newStatus === 'confirmed' || newStatus === 'cancelled') {
                    refetch()
                }
            }
        })
    }, [subscribe, refetch])

    // ── Accept price & confirm booking ──
    const handleAccept = async (item: ActionItem) => {
        setLoadingId(item.id)
        try {
            const result = await confirmPrice(item.id)
            if (result.success) {
                showToast({ message: 'Booking confirmed!', type: 'success' })
                // Optimistically remove
                setItems(prev => prev.filter(i => i.id !== item.id))
                if (result.threadId) {
                    router.push(`/app/messages/${result.threadId}`)
                } else {
                    // Refetch from DB to confirm removal, then refresh server component
                    await refetch()
                    router.refresh()
                }
            } else {
                showToast({ message: result.error || 'Failed to confirm booking', type: 'error' })
            }
        } catch {
            showToast({ message: 'Something went wrong. Please try again.', type: 'error' })
        } finally {
            setLoadingId(null)
        }
    }

    // ── Cancel booking ──
    const handleCancel = async (item: ActionItem) => {
        setLoadingId(item.id)
        try {
            const result = await cancelBooking(item.bookingId)
            if (result.error) {
                showToast({ message: result.error, type: 'error' })
            } else {
                showToast({ message: 'Booking cancelled', type: 'success' })
                // Optimistically remove, then refetch from DB to confirm
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

    if (items.length === 0) return null

    // Item currently being cancelled (for dialog)
    const cancelItem = cancelId ? items.find(i => i.id === cancelId) : null

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

            <div className="space-y-3">
                {items.map((item) => {
                    const isLoading = loadingId === item.id
                    const displayPrice = item.price != null ? (item.price / 100).toFixed(2) : null
                    return (
                        <div
                            key={item.id}
                            className={cn(
                                'rounded-xl border border-[var(--border-color)] overflow-hidden',
                                'transition-all duration-200',
                                getStatusCardStyle('accepted_priced')
                            )}
                        >
                            {/* Top row — tap to see full details */}
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

                            {/* Action buttons */}
                            <div className="flex border-t border-[var(--border-color)]">
                                <button
                                    onClick={() => handleAccept(item)}
                                    disabled={isLoading}
                                    className={cn(
                                        'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold',
                                        'text-green-700 bg-green-50 hover:bg-green-100 active:bg-green-200',
                                        'transition-colors disabled:opacity-50',
                                        'border-r border-[var(--border-color)]'
                                    )}
                                >
                                    {isLoading && loadingId === item.id ? (
                                        <span className="w-4 h-4 border-2 border-green-700 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Check className="w-4 h-4" strokeWidth={2.5} />
                                    )}
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
                    )
                })}
            </div>

            {/* Cancel confirmation dialog */}
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
   REFEREE:  Awaiting Action
   Shows offers that are 'sent' (need response)
   ────────────────────────────────────────────── */
export function RefereeAwaitingAction({ initialItems }: { initialItems: ActionItem[] }) {
    const [items, setItems] = useState<ActionItem[]>(initialItems)
    const { subscribe } = useBookingUpdates()
    const supabase = createClient()

    // Sync state when server re-renders with updated initialItems
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
                booking:bookings!inner(
                    id, status, match_date, kickoff_time,
                    ground_name, location_postcode, address_text
                ),
                coach:bookings!inner(coach:profiles!bookings_coach_id_fkey(full_name))
            `)
            .eq('referee_id', user.id)
            .eq('status', 'sent')
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
                    coachName: coach?.full_name,
                }
            })
        )
    }, [supabase])

    // Subscribe to real-time updates — optimistically remove responded offers, refetch for new ones
    useEffect(() => {
        return subscribe((update) => {
            if (update.table === 'booking_offers') {
                const offerId = update.new?.id as string
                const newStatus = update.new?.status as string

                // If an offer moved away from sent, remove it instantly
                if (offerId && newStatus && newStatus !== 'sent') {
                    setItems(prev => {
                        const next = prev.filter(i => i.id !== offerId)
                        if (next.length !== prev.length) return next
                        return prev
                    })
                }

                // New sent offer arrived — refetch
                if (newStatus === 'sent') {
                    refetch()
                }
            }

            // Booking cancelled or withdrawn — refetch to clean up
            if (update.table === 'bookings') {
                const newStatus = update.new?.status as string
                if (newStatus === 'cancelled') {
                    refetch()
                }
            }
        })
    }, [subscribe, refetch])

    if (items.length === 0) return null

    return (
        <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
                <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                </span>
                <h2 className="font-semibold text-[var(--foreground)]">New Offers</h2>
                <span className="ml-auto px-2 py-0.5 text-[10px] font-bold bg-blue-500 text-white rounded-full">
                    {items.length}
                </span>
            </div>

            <div className="space-y-2">
                {items.map((item) => (
                    <Link
                        key={item.id}
                        href={`/app/bookings/${item.bookingId}`}
                        className={cn(
                            'flex items-center gap-3 p-3 rounded-lg border border-[var(--border-color)]',
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
                            <StatusChip status="sent" size="sm" />
                            <span className="text-[10px] text-blue-600 font-semibold">Respond</span>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    )
}
