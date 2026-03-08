export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { BookingCard } from '@/components/app/BookingCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { CoachAwaitingAction, RefereeAwaitingAction } from '@/components/app/AwaitingAction'
import { AdminBookingsView } from '@/components/app/AdminBookingsView'
import type { AdminBooking } from '@/components/app/AdminBookingsView'
import { BookingStatus, BookingWithDetails } from '@/lib/types'
import { CalendarDays } from 'lucide-react'
import { Pagination } from '@/components/app/Pagination'

const PAGE_SIZE = 20

// Supabase join result types for offer queries
interface OfferBookingJoin {
    id: string
    status: string
    match_date: string
    kickoff_time: string
    ground_name: string | null
    location_postcode: string
    address_text: string | null
    coach_id: string
}

interface CoachOfferResult {
    id: string
    status: string
    price_pence: number | null
    booking: OfferBookingJoin | OfferBookingJoin[]
    referee: { full_name: string } | { full_name: string }[]
    created_at: string
}

interface RefereeOfferResult {
    id: string
    status: string
    booking: OfferBookingJoin | OfferBookingJoin[]
    created_at: string
}

interface CoachActionItem {
    id: string
    bookingId: string
    status: string
    bookingStatus: string
    matchDate: string
    kickoffTime: string
    venue: string
    price: number | null
    refereeName?: string
}

interface RefereeActionItem {
    id: string
    bookingId: string
    status: string
    bookingStatus: string
    matchDate: string
    kickoffTime: string
    venue: string
}

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
    searchParams: Promise<{ status?: string; page?: string }>
}) {
    const params = await searchParams
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    const isCoach = profile?.role === 'coach'
    const isReferee = profile?.role === 'referee'
    const isAdmin = profile?.role === 'admin'
    const statusFilter = params.status as BookingStatus | 'all' | undefined
    const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1)
    const offset = (currentPage - 1) * PAGE_SIZE

    let bookings: BookingWithDetails[] = []
    let totalBookings = 0

    // ── Admin bookings data ───────────────────────────────
    let adminUpcoming: AdminBooking[] = []
    let adminCompleted: AdminBooking[] = []

    if (isAdmin) {
        const today = new Date().toISOString().split('T')[0]

        // Supabase join result types for admin booking queries
        interface AdminBookingRow {
            id: string
            status: string
            match_date: string
            kickoff_time: string
            home_team: string | null
            away_team: string | null
            ground_name: string | null
            location_postcode: string
            address_text: string | null
            format: string | null
            age_group: string | null
            is_sos: boolean
            coach: { full_name: string } | { full_name: string }[] | null
            assignment: Array<{
                referee: { full_name: string } | { full_name: string }[] | null
            }> | null
        }

        interface CompletedBookingRow extends AdminBookingRow {
            ratings: Array<{
                rating: number
                punctuality: number | null
                communication: number | null
                professionalism: number | null
                comment: string | null
            }> | null
        }

        const [
            { data: upcomingData },
            { data: completedData },
        ] = await Promise.all([
            // Upcoming/active bookings: pending, offered, confirmed — future dates
            supabase
                .from('bookings')
                .select(`
                    id, status, match_date, kickoff_time, home_team, away_team,
                    ground_name, location_postcode, address_text, format, age_group, is_sos,
                    coach:profiles!bookings_coach_id_fkey(full_name),
                    assignment:booking_assignments(referee:profiles(full_name))
                `)
                .is('deleted_at', null)
                .in('status', ['pending', 'offered', 'confirmed'])
                .gte('match_date', today)
                .order('match_date', { ascending: true })
                .limit(50),

            // Completed bookings with ratings
            supabase
                .from('bookings')
                .select(`
                    id, status, match_date, kickoff_time, home_team, away_team,
                    ground_name, location_postcode, address_text, format, age_group, is_sos,
                    coach:profiles!bookings_coach_id_fkey(full_name),
                    assignment:booking_assignments(referee:profiles(full_name)),
                    ratings:match_ratings(rating, punctuality, communication, professionalism, comment)
                `)
                .is('deleted_at', null)
                .eq('status', 'completed')
                .order('match_date', { ascending: false })
                .limit(50),
        ])

        // Helper to extract name from Supabase join result
        const getName = (v: { full_name: string } | { full_name: string }[] | null | undefined): string | null => {
            if (!v) return null
            if (Array.isArray(v)) return v[0]?.full_name || null
            return v.full_name || null
        }

        adminUpcoming = ((upcomingData || []) as AdminBookingRow[]).map((b) => ({
            id: b.id,
            status: b.status as BookingStatus,
            match_date: b.match_date,
            kickoff_time: b.kickoff_time,
            home_team: b.home_team,
            away_team: b.away_team,
            ground_name: b.ground_name,
            location_postcode: b.location_postcode,
            address_text: b.address_text,
            format: b.format,
            age_group: b.age_group,
            is_sos: b.is_sos,
            coach_name: getName(b.coach),
            referee_name: b.assignment?.[0] ? getName(b.assignment[0].referee) : null,
            rating: null,
            punctuality: null,
            communication: null,
            professionalism: null,
            comment: null,
        }))

        adminCompleted = ((completedData || []) as CompletedBookingRow[]).map((b) => {
            const r = b.ratings?.[0] || null
            return {
                id: b.id,
                status: b.status as BookingStatus,
                match_date: b.match_date,
                kickoff_time: b.kickoff_time,
                home_team: b.home_team,
                away_team: b.away_team,
                ground_name: b.ground_name,
                location_postcode: b.location_postcode,
                address_text: b.address_text,
                format: b.format,
                age_group: b.age_group,
                is_sos: b.is_sos,
                coach_name: getName(b.coach),
                referee_name: b.assignment?.[0] ? getName(b.assignment[0].referee) : null,
                rating: r?.rating ?? null,
                punctuality: r?.punctuality ?? null,
                communication: r?.communication ?? null,
                professionalism: r?.professionalism ?? null,
                comment: r?.comment ?? null,
            }
        })
    }

    if (isCoach) {
        // First get total count for pagination
        let countQuery = supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .eq('coach_id', user.id)
            .is('deleted_at', null)

        if (statusFilter && statusFilter !== 'all') {
            countQuery = countQuery.eq('status', statusFilter)
        }

        const { count } = await countQuery
        totalBookings = count || 0

        let query = supabase
            .from('bookings')
            .select(`
        *,
        coach:profiles!bookings_coach_id_fkey(*),
        assignment:booking_assignments(*, referee:profiles(*)),
        thread:threads(*)
      `)
            .eq('coach_id', user.id)
            .is('deleted_at', null)
            .order('match_date', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1)

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

    // ── Awaiting Action data ────────────────────────────
    let coachActionItems: CoachActionItem[] = []
    let refereeActionItems: RefereeActionItem[] = []

    if (isCoach) {
        const { data: awaitingOffers } = await supabase
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
            .eq('bookings.coach_id', user.id)
            .neq('bookings.status', 'cancelled')
            .order('created_at', { ascending: false })

        if (awaitingOffers) {
            coachActionItems = (awaitingOffers as CoachOfferResult[]).map((o) => {
                const booking = Array.isArray(o.booking) ? o.booking[0] : o.booking
                const referee = Array.isArray(o.referee) ? o.referee[0] : o.referee
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
        }
    }

    if (isReferee) {
        const { data: sentOffers } = await supabase
            .from('booking_offers')
            .select(`
                id, status,
                booking:bookings!inner(
                    id, status, match_date, kickoff_time,
                    ground_name, location_postcode, address_text
                )
            `)
            .eq('referee_id', user.id)
            .eq('status', 'sent')
            .order('created_at', { ascending: false })

        if (sentOffers) {
            refereeActionItems = (sentOffers as RefereeOfferResult[]).map((o) => {
                const booking = Array.isArray(o.booking) ? o.booking[0] : o.booking
                return {
                    id: o.id,
                    bookingId: booking.id,
                    status: o.status,
                    bookingStatus: booking.status,
                    matchDate: booking.match_date,
                    kickoffTime: booking.kickoff_time,
                    venue: booking.address_text || booking.ground_name || booking.location_postcode,
                }
            })
        }
    }

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-[var(--foreground)]">
                    {isAdmin ? 'All Bookings' : isCoach ? 'My Bookings' : 'Offers & Fixtures'}
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

            {/* Admin View */}
            {isAdmin && (
                <AdminBookingsView
                    upcomingBookings={adminUpcoming}
                    completedBookings={adminCompleted}
                />
            )}

            {/* Awaiting Action — real-time updates */}
            {isCoach && <CoachAwaitingAction initialItems={coachActionItems} />}
            {isReferee && <RefereeAwaitingAction initialItems={refereeActionItems} />}

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

            {/* Coach/Referee Bookings List */}
            {!isAdmin && (
                <>
                    {bookings.length > 0 ? (
                        <div className="space-y-3">
                            {bookings.map((booking) => (
                                <BookingCard
                                    key={booking.id}
                                    booking={booking}
                                    showCoach={isReferee}
                                    showReferee={isCoach && !!booking.assignment?.referee}
                                />
                            ))}

                            {isCoach && (
                                <Pagination
                                    currentPage={currentPage}
                                    totalItems={totalBookings}
                                    pageSize={PAGE_SIZE}
                                    basePath="/app/bookings"
                                    params={statusFilter && statusFilter !== 'all' ? { status: statusFilter } : {}}
                                />
                            )}
                        </div>
                    ) : (
                        <EmptyState
                            icon={
                                <CalendarDays className="w-12 h-12" strokeWidth={1.5} />
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
                                        className="inline-flex items-center px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium text-sm transition-colors"
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
                </>
            )}
        </div>
    )
}
