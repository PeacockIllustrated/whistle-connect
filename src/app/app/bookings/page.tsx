export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { BookingCard } from '@/components/app/BookingCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { CoachAwaitingAction, RefereeAwaitingAction } from '@/components/app/AwaitingAction'
import { LocalStorageArchiveMigration } from '@/components/app/LocalStorageArchiveMigration'
import { AdminBookingsView } from '@/components/app/AdminBookingsView'
import type { AdminBooking } from '@/components/app/AdminBookingsView'
import { BookingStatus, BookingWithDetails } from '@/lib/types'
import { formatDate, formatTime, toLocalDateString } from '@/lib/utils'
import { CalendarDays, XCircle } from 'lucide-react'
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
    price_pence: number | null
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
    price: number | null
}

interface DeclinedOfferItem {
    id: string
    bookingId: string
    matchDate: string
    kickoffTime: string
    venue: string
    refereeName: string | null
    declinedAt: string
}

// Coach status pills shown only inside the Upcoming tab. Confirmed-only fixtures
// after kickoff but before completion are still "Upcoming" workflow-wise.
const upcomingStatusFilters: { value: BookingStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'offered', label: 'Offered' },
    { value: 'confirmed', label: 'Confirmed' },
]

type ListTab = 'upcoming' | 'past' | 'archived'

const tabs: { value: ListTab; label: string }[] = [
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'past', label: 'Past' },
    { value: 'archived', label: 'Archived' },
]

const UPCOMING_STATUSES: BookingStatus[] = ['draft', 'pending', 'offered', 'confirmed']
const PAST_STATUSES: BookingStatus[] = ['completed', 'cancelled']

export default async function BookingsPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string; page?: string; tab?: string }>
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
    const tab: ListTab = (params.tab === 'past' || params.tab === 'archived') ? params.tab : 'upcoming'
    const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1)
    const offset = (currentPage - 1) * PAGE_SIZE

    let bookings: (BookingWithDetails & { archivedForViewer?: boolean })[] = []
    let totalBookings = 0

    // ── Admin bookings data ───────────────────────────────
    let adminUpcoming: AdminBooking[] = []
    let adminCompleted: AdminBooking[] = []

    if (isAdmin) {
        const today = toLocalDateString(new Date())

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
        // Tab filter: Upcoming = active workflow + not archived; Past = completed/cancelled + not archived;
        // Archived = coach_archived_at IS NOT NULL. deleted_at always excluded (that's the pre-confirmation withdraw path).
        let countQuery = supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .eq('coach_id', user.id)
            .is('deleted_at', null)

        if (tab === 'archived') {
            countQuery = countQuery.not('coach_archived_at', 'is', null)
        } else {
            countQuery = countQuery
                .is('coach_archived_at', null)
                .in('status', tab === 'past' ? PAST_STATUSES : UPCOMING_STATUSES)
            if (tab === 'upcoming' && statusFilter && statusFilter !== 'all') {
                countQuery = countQuery.eq('status', statusFilter)
            }
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
            .order('match_date', { ascending: tab === 'upcoming' })
            .range(offset, offset + PAGE_SIZE - 1)

        if (tab === 'archived') {
            query = query.not('coach_archived_at', 'is', null)
        } else {
            query = query
                .is('coach_archived_at', null)
                .in('status', tab === 'past' ? PAST_STATUSES : UPCOMING_STATUSES)
            if (tab === 'upcoming' && statusFilter && statusFilter !== 'all') {
                query = query.eq('status', statusFilter)
            }
        }

        const { data } = await query
        bookings = (data || []).map(b => ({ ...b, archivedForViewer: tab === 'archived' }))
    } else if (isReferee) {
        // Refs see bookings via two paths: open offers (sent/accepted_priced) and
        // assignments (after offer accepted). Past also includes declined/withdrawn
        // offers — they're history. Archive flag lives on the assignment row.
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

        // Build an index of which assignments are archived.
        const assignmentByBooking = new Map<string, { archived_at: string | null }>()
        ;(assignments || []).forEach((a: { booking?: { id?: string }; archived_at: string | null }) => {
            const bid = a.booking?.id
            if (bid) assignmentByBooking.set(bid, { archived_at: a.archived_at })
        })

        const offerBookings = (offers || [])
            .filter(o => o.booking)
            .map(o => ({ ...o.booking, offer_status: o.status }))
        const assignedBookings = (assignments || [])
            .filter(a => a.booking)
            .map(a => ({ ...a.booking, is_assigned: true }))

        const bookingMap = new Map<string, BookingWithDetails & { offer_status?: string; is_assigned?: boolean; archivedForViewer?: boolean }>()
        assignedBookings.forEach(b => bookingMap.set(b.id, b))
        offerBookings.forEach(b => {
            if (!bookingMap.has(b.id)) bookingMap.set(b.id, b)
        })

        // Decorate each entry with the viewer's archive flag.
        bookingMap.forEach((b, id) => {
            b.archivedForViewer = assignmentByBooking.get(id)?.archived_at != null
        })

        const all = Array.from(bookingMap.values())
        const filtered = all.filter(b => {
            if (tab === 'archived') return b.archivedForViewer === true
            if (b.archivedForViewer) return false
            const isPastStatus = b.status === 'completed' || b.status === 'cancelled'
            const isDeadOffer = !b.is_assigned && (b.offer_status === 'declined' || b.offer_status === 'withdrawn')
            if (tab === 'past') return isPastStatus || isDeadOffer
            // upcoming
            return !isPastStatus && !isDeadOffer
        })

        filtered.sort((a, b) => {
            const ta = new Date(a.match_date).getTime()
            const tb = new Date(b.match_date).getTime()
            return tab === 'upcoming' ? ta - tb : tb - ta
        })

        totalBookings = filtered.length
        bookings = filtered.slice(offset, offset + PAGE_SIZE)
    }

    // ── Awaiting Action data ────────────────────────────
    let coachActionItems: CoachActionItem[] = []
    let refereeActionItems: RefereeActionItem[] = []
    let coachDeclinedItems: DeclinedOfferItem[] = []

    if (isCoach) {
        // Coach awaiting action covers two flows:
        // 1. Legacy accepted_priced — ref proposed a price, coach must confirm
        // 2. New: sent + price_pence IS NULL — ref tapped "I'm Available" via the
        //    nearby feed, coach must set a fee and confirm via the detail page.
        // Both filtered by coach_archived_at IS NULL so the swipe-to-archive
        // pattern hides items the coach has dismissed.
        const [{ data: awaitingPriced }, { data: awaitingUnpriced }] = await Promise.all([
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

        const awaitingOffers = [...(awaitingPriced || []), ...(awaitingUnpriced || [])]

        if (awaitingOffers.length > 0) {
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

        // ── Declined offers — last 10, future matches only ──
        const today = toLocalDateString(new Date())
        const { data: declinedOffers } = await supabase
            .from('booking_offers')
            .select(`
                id, responded_at,
                booking:bookings!inner(
                    id, match_date, kickoff_time,
                    ground_name, location_postcode, address_text,
                    coach_id, deleted_at
                ),
                referee:profiles!booking_offers_referee_id_fkey(full_name)
            `)
            .eq('status', 'declined')
            .eq('bookings.coach_id', user.id)
            .gte('bookings.match_date', today)
            .order('responded_at', { ascending: false })
            .limit(10)

        if (declinedOffers) {
            coachDeclinedItems = (declinedOffers as Array<{
                id: string
                responded_at: string | null
                booking: OfferBookingJoin & { deleted_at: string | null } | Array<OfferBookingJoin & { deleted_at: string | null }>
                referee: { full_name: string } | { full_name: string }[] | null
            }>)
                .map((o) => {
                    const booking = Array.isArray(o.booking) ? o.booking[0] : o.booking
                    if (!booking || booking.deleted_at) return null
                    const referee = o.referee
                        ? (Array.isArray(o.referee) ? o.referee[0] : o.referee)
                        : null
                    return {
                        id: o.id,
                        bookingId: booking.id,
                        matchDate: booking.match_date,
                        kickoffTime: booking.kickoff_time,
                        venue: booking.address_text || booking.ground_name || booking.location_postcode,
                        refereeName: referee?.full_name ?? null,
                        declinedAt: o.responded_at ?? '',
                    }
                })
                .filter((i): i is DeclinedOfferItem => i !== null)
        }
    }

    if (isReferee) {
        // Referee awaiting covers both:
        //   - priced sent offers (coach posted a fee → ref must respond)
        //   - unpriced sent offers (ref tapped "I'm Available" → ref is waiting)
        // The component splits these into "New Offers" and "Awaiting Coach"
        // sections internally based on price_pence.
        const { data: sentOffers } = await supabase
            .from('booking_offers')
            .select(`
                id, status, price_pence,
                booking:bookings!inner(
                    id, status, match_date, kickoff_time,
                    ground_name, location_postcode, address_text
                )
            `)
            .eq('referee_id', user.id)
            .eq('status', 'sent')
            .is('referee_archived_at', null)
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
                    price: o.price_pence ?? null,
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

            {/* One-shot migration: flush localStorage-based ref archive into the DB */}
            {isReferee && <LocalStorageArchiveMigration />}

            {/* Awaiting Action — real-time updates */}
            {isCoach && <CoachAwaitingAction initialItems={coachActionItems} />}
            {isReferee && <RefereeAwaitingAction initialItems={refereeActionItems} />}

            {/* Declined Offers — coach view, read-only summary */}
            {isCoach && coachDeclinedItems.length > 0 && (
                <section className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <XCircle className="w-4 h-4 text-red-500" />
                        <h2 className="font-semibold text-[var(--foreground)]">Declined</h2>
                        <span className="ml-auto px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                            {coachDeclinedItems.length}
                        </span>
                    </div>
                    <p className="text-xs text-[var(--foreground-muted)] mb-3">
                        Referees who declined offers for upcoming matches.
                    </p>
                    <div className="space-y-2">
                        {coachDeclinedItems.map((item) => (
                            <Link
                                key={item.id}
                                href={`/app/bookings/${item.bookingId}`}
                                className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-color)] bg-red-50/50 hover:bg-red-50 transition-colors"
                            >
                                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-100 flex flex-col items-center justify-center">
                                    <span className="text-xs font-bold text-red-700">
                                        {new Date(item.matchDate).getDate()}
                                    </span>
                                    <span className="text-[10px] text-red-500 uppercase">
                                        {new Date(item.matchDate).toLocaleDateString('en', { month: 'short' })}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{item.venue}</p>
                                    <p className="text-xs text-[var(--foreground-muted)]">
                                        {item.refereeName ? <span className="font-medium">{item.refereeName}</span> : 'A referee'}
                                        {' · '}declined{item.declinedAt ? ` ${formatDate(item.declinedAt)}` : ''}
                                    </p>
                                </div>
                                <span className="text-xs text-[var(--foreground-muted)] flex-shrink-0">
                                    {formatTime(item.kickoffTime)}
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Top-level tabs (Upcoming / Past / Archived) — both roles */}
            {!isAdmin && (
                <div className="flex gap-2 mb-3" role="tablist">
                    {tabs.map((t) => {
                        const isActive = tab === t.value
                        const href = t.value === 'upcoming' ? '/app/bookings' : `/app/bookings?tab=${t.value}`
                        return (
                            <Link
                                key={t.value}
                                href={href}
                                role="tab"
                                aria-selected={isActive}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${isActive
                                    ? 'bg-[var(--brand-navy)] text-white'
                                    : 'bg-[var(--neutral-100)] text-[var(--neutral-600)] hover:bg-[var(--neutral-200)]'
                                    }`}
                            >
                                {t.label}
                            </Link>
                        )
                    })}
                </div>
            )}

            {/* Coach status pills — only inside Upcoming */}
            {isCoach && tab === 'upcoming' && (
                <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-4 px-4">
                    {upcomingStatusFilters.map((filter) => {
                        const isActive = (statusFilter === filter.value) || (!statusFilter && filter.value === 'all')
                        const href = filter.value === 'all' ? '/app/bookings' : `/app/bookings?status=${filter.value}`
                        return (
                            <Link
                                key={filter.value}
                                href={href}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${isActive
                                    ? 'bg-[var(--brand-navy)] text-white'
                                    : 'bg-[var(--neutral-100)] text-[var(--neutral-600)] hover:bg-[var(--neutral-200)]'
                                    }`}
                            >
                                {filter.label}
                            </Link>
                        )
                    })}
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
                                    archivedForViewer={booking.archivedForViewer}
                                />
                            ))}

                            <Pagination
                                currentPage={currentPage}
                                totalItems={totalBookings}
                                pageSize={PAGE_SIZE}
                                basePath="/app/bookings"
                                params={{
                                    ...(tab !== 'upcoming' ? { tab } : {}),
                                    ...(tab === 'upcoming' && statusFilter && statusFilter !== 'all' ? { status: statusFilter } : {}),
                                }}
                            />
                        </div>
                    ) : (
                        <EmptyState
                            icon={
                                <CalendarDays className="w-12 h-12" strokeWidth={1.5} />
                            }
                            title={
                                tab === 'archived' ? 'No archived bookings'
                                    : tab === 'past' ? 'No past bookings'
                                        : isCoach ? 'No upcoming bookings' : 'No upcoming offers'
                            }
                            description={
                                tab === 'archived'
                                    ? 'Bookings you archive will appear here.'
                                    : tab === 'past'
                                        ? 'Once matches are completed or cancelled, they will appear here.'
                                        : isCoach
                                            ? 'Create your first booking to find a referee for your match'
                                            : 'Set your availability to start receiving match offers'
                            }
                            action={
                                tab === 'upcoming' ? (
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
                                ) : null
                            }
                        />
                    )}
                </>
            )}
        </div>
    )
}
