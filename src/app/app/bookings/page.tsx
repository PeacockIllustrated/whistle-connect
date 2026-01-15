import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { BookingCard } from '@/components/app/BookingCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusChip } from '@/components/ui/StatusChip'
import { BookingStatus } from '@/lib/types'

const statusFilters: { value: BookingStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'offered', label: 'Offered' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'completed', label: 'Completed' },
]

export default async function BookingsPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string }>
}) {
    const params = await searchParams
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    const isCoach = profile?.role === 'coach'
    const isReferee = profile?.role === 'referee'
    const statusFilter = params.status as BookingStatus | 'all' | undefined

    let bookings: any[] = []

    if (isCoach) {
        let query = supabase
            .from('bookings')
            .select(`
        *,
        coach:profiles!bookings_coach_id_fkey(*),
        assignment:booking_assignments(*, referee:profiles(*)),
        thread:threads(*)
      `)
            .eq('coach_id', user.id)
            .order('match_date', { ascending: true })

        if (statusFilter && statusFilter !== 'all') {
            query = query.eq('status', statusFilter)
        }

        const { data } = await query
        bookings = data || []
    } else if (isReferee) {
        // Get bookings via offers or assignments
        const { data: offers } = await supabase
            .from('booking_offers')
            .select(`
        *,
        booking:bookings(*, coach:profiles!bookings_coach_id_fkey(*), thread:threads(*))
      `)
            .eq('referee_id', user.id)

        const { data: assignments } = await supabase
            .from('booking_assignments')
            .select(`
        *,
        booking:bookings(*, coach:profiles!bookings_coach_id_fkey(*), thread:threads(*))
      `)
            .eq('referee_id', user.id)

        // Combine and deduplicate
        const offerBookings = (offers || []).map(o => ({ ...o.booking, offer_status: o.status }))
        const assignedBookings = (assignments || []).map(a => ({ ...a.booking, is_assigned: true }))

        const bookingMap = new Map()
        assignedBookings.forEach(b => bookingMap.set(b.id, b))
        offerBookings.forEach(b => {
            if (!bookingMap.has(b.id)) {
                bookingMap.set(b.id, b)
            }
        })

        bookings = Array.from(bookingMap.values())
            .sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime())
    }

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-[var(--foreground)]">
                    {isCoach ? 'My Bookings' : 'Offers & Fixtures'}
                </h1>
                {isCoach && (
                    <Link
                        href="/app/bookings/new"
                        className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg font-medium text-sm"
                    >
                        + New
                    </Link>
                )}
            </div>

            {/* Status Filters */}
            {isCoach && (
                <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-4 px-4">
                    {statusFilters.map((filter) => (
                        <Link
                            key={filter.value}
                            href={filter.value === 'all' ? '/app/bookings' : `/app/bookings?status=${filter.value}`}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${(statusFilter === filter.value) || (!statusFilter && filter.value === 'all')
                                ? 'bg-[var(--brand-navy)] text-white'
                                : 'bg-[var(--neutral-100)] text-[var(--neutral-600)] hover:bg-[var(--neutral-200)]'
                                }`}
                        >
                            {filter.label}
                        </Link>
                    ))}
                </div>
            )}

            {/* Bookings List */}
            {bookings.length > 0 ? (
                <div className="space-y-3">
                    {bookings.map((booking) => (
                        <BookingCard
                            key={booking.id}
                            booking={booking}
                            showCoach={isReferee}
                            showReferee={isCoach && booking.assignment?.referee}
                        />
                    ))}
                </div>
            ) : (
                <EmptyState
                    icon={
                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    }
                    title={isCoach ? 'No bookings yet' : 'No offers yet'}
                    description={isCoach
                        ? 'Create your first booking to find a referee for your match'
                        : 'Set your availability to start receiving match offers'
                    }
                    action={
                        isCoach ? (
                            <Link
                                href="/app/bookings/new"
                                className="inline-flex items-center px-4 py-2 bg-[var(--brand-secondary)] text-white rounded-lg font-medium text-sm"
                            >
                                Create Booking
                            </Link>
                        ) : (
                            <Link
                                href="/app/availability"
                                className="inline-flex items-center px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg font-medium text-sm"
                            >
                                Set Availability
                            </Link>
                        )
                    }
                />
            )}
        </div>
    )
}
