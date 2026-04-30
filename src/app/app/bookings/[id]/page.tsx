import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { StatusChip } from '@/components/ui/StatusChip'
import { formatDate, formatTime, getStatusCardStyle } from '@/lib/utils'
import { BookingActions } from './BookingActions'
import { CoachInterestActions } from '@/components/app/CoachInterestActions'
import { BookingOffer, Profile } from '@/lib/types'
import { ChevronLeft, CalendarDays, MapPin, MessageCircle } from 'lucide-react'
import { VenueMap } from '@/components/ui/VenueMap'

export default async function BookingDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    const { data: booking, error } = await supabase
        .from('bookings')
        .select(`
      *,
      coach:profiles!bookings_coach_id_fkey(*),
      club:clubs(*),
      assignment:booking_assignments(*, referee:profiles(*)),
      offers:booking_offers(*, referee:profiles(*)),
      thread:threads(id)
    `)
        .eq('id', id)
        .is('deleted_at', null)
        .single()

    if (error || !booking) {
        notFound()
    }

    const isCoach = profile?.role === 'coach' && booking.coach_id === user.id
    const isReferee = profile?.role === 'referee'
    const isAdmin = profile?.role === 'admin'

    const assignment = Array.isArray(booking.assignment)
        ? booking.assignment[0]
        : booking.assignment

    // Get user's offer if referee
    const userOffer = isReferee
        ? booking.offers?.find((o: BookingOffer) => o.referee_id === user.id)
        : null

    // ── Page-level ownership / participation gate ──────────────────────────
    // Defence-in-depth: even though Supabase RLS ought to scope reads, we
    // re-verify here so a misconfigured policy can't leak third-party bookings.
    // Allowed: the coach who owns the booking, the assigned referee, any referee
    // with an offer on the booking, or an admin.
    const isAssignedReferee = !!assignment && assignment.referee_id === user.id
    const hasOfferOnBooking = !!userOffer
    const canViewBooking = isCoach || isAdmin || isAssignedReferee || hasOfferOnBooking

    if (!canViewBooking) {
        notFound()
    }

    const thread = Array.isArray(booking.thread)
        ? booking.thread[0]
        : booking.thread

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/app/bookings" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold">Booking Details</h1>
                </div>
                <StatusChip status={booking.status} />
            </div>

            {/* Main Card */}
            <div className={`card p-4 mb-4 ${getStatusCardStyle(booking.status)}`}>
                <h2 className="text-xl font-bold mb-1">
                    {booking.home_team && booking.away_team
                        ? `${booking.home_team} vs ${booking.away_team}`
                        : (booking.address_text || booking.ground_name || booking.location_postcode)}
                </h2>

                <div className="space-y-3 mt-4">
                    {/* Date & Time */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[var(--neutral-100)] flex items-center justify-center">
                            <CalendarDays className="w-5 h-5 text-[var(--neutral-600)]" />
                        </div>
                        <div>
                            <p className="font-medium">{formatDate(booking.match_date)}</p>
                            <p className="text-sm text-[var(--foreground-muted)]">
                                Kickoff: {formatTime(booking.kickoff_time)}
                            </p>
                        </div>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[var(--neutral-100)] flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-[var(--neutral-600)]" />
                        </div>
                        <div>
                            <p className="font-medium">{booking.location_postcode}</p>
                            {(booking.address_text || booking.ground_name) && (
                                <p className="text-sm text-[var(--foreground-muted)]">
                                    {booking.address_text || booking.ground_name}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Map View */}
                    <VenueMap
                        postcode={booking.location_postcode}
                        height={200}
                        interactive
                    />

                    {/* Match Info */}
                    <div className="flex flex-wrap gap-2 pt-2">
                        {booking.format && (
                            <span className="px-2.5 py-1 bg-[var(--neutral-100)] rounded text-sm font-medium">
                                {booking.format}
                            </span>
                        )}
                        {booking.age_group && (
                            <span className="px-2.5 py-1 bg-[var(--neutral-100)] rounded text-sm font-medium">
                                {booking.age_group}
                            </span>
                        )}
                        {booking.competition_type && (
                            <span className="px-2.5 py-1 bg-[var(--neutral-100)] rounded text-sm font-medium capitalize">
                                {booking.competition_type}
                            </span>
                        )}
                    </div>

                    {/* Match Fee — prominent so referees see the price clearly */}
                    {booking.budget_pounds && (
                        <div className="pt-3 mt-1 border-t border-[var(--border-color)]">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                                <div>
                                    <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-700">
                                        Match Fee
                                    </p>
                                    <p className="text-[11px] text-emerald-700/80">
                                        Set by the coach for this fixture
                                    </p>
                                </div>
                                <p className="text-2xl font-bold text-emerald-700">
                                    £{booking.budget_pounds}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    {booking.notes && (
                        <div className="pt-2 border-t border-[var(--border-color)]">
                            <p className="text-sm text-[var(--foreground-muted)]">Notes:</p>
                            <p className="text-sm mt-1">{booking.notes}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Coach Info (for referees) — once the booking is confirmed,
                surface a Message button right on the card so the ref can
                reach the coach without scrolling to the actions block. */}
            {isReferee && booking.coach && (
                <div className="card p-4 mb-4">
                    <h3 className="text-sm font-semibold text-[var(--foreground-muted)] mb-3">COACH</h3>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--wc-coach-blue)] flex items-center justify-center text-white font-semibold">
                            {booking.coach.full_name.charAt(0)}
                        </div>
                        <div className="flex-1">
                            <p className="font-medium">{booking.coach.full_name}</p>
                            {booking.club && <p className="text-sm text-[var(--foreground-muted)]">{booking.club.name}</p>}
                        </div>
                    </div>
                    {thread?.id && (booking.status === 'confirmed' || booking.status === 'completed') && (
                        <Link
                            href={`/app/messages/${thread.id}`}
                            className="mt-3 flex items-center justify-center gap-2 w-full rounded-xl bg-[var(--brand-primary)] text-white font-semibold py-2.5 text-sm hover:opacity-90 transition-opacity"
                        >
                            <MessageCircle className="w-4 h-4" />
                            Message {booking.coach.full_name}
                        </Link>
                    )}
                </div>
            )}

            {/* Assigned Referee (for coaches) — same treatment: button to
                message the assigned ref appears the moment they accept. */}
            {isCoach && assignment?.referee && (
                <div className="card p-4 mb-4">
                    <h3 className="text-sm font-semibold text-[var(--foreground-muted)] mb-3">ASSIGNED REFEREE</h3>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--brand-primary)] flex items-center justify-center text-white font-semibold">
                            {assignment.referee.full_name.charAt(0)}
                        </div>
                        <div className="flex-1">
                            <p className="font-medium">{assignment.referee.full_name}</p>
                            <p className="text-sm text-[var(--foreground-muted)]">Confirmed Referee</p>
                        </div>
                        <StatusChip status="verified" size="sm" />
                    </div>
                    {thread?.id && (booking.status === 'confirmed' || booking.status === 'completed') && (
                        <Link
                            href={`/app/messages/${thread.id}`}
                            className="mt-3 flex items-center justify-center gap-2 w-full rounded-xl bg-[var(--brand-primary)] text-white font-semibold py-2.5 text-sm hover:opacity-90 transition-opacity"
                        >
                            <MessageCircle className="w-4 h-4" />
                            Message {assignment.referee.full_name}
                        </Link>
                    )}
                </div>
            )}

            {/* Actions */}
            <BookingActions
                booking={booking}
                userOffer={userOffer}
                isCoach={isCoach}
                isReferee={isReferee}
                threadId={thread?.id}
            />

            {/* Offers List (for coaches) — always show when offers exist and no assignment yet */}
            {isCoach && booking.offers && booking.offers.length > 0 && !assignment && (
                <div className="card p-4 mt-4">
                    <h3 className="text-sm font-semibold text-[var(--foreground-muted)] mb-3">
                        OFFERS ({booking.offers.length})
                    </h3>
                    <div className="space-y-3">
                        {booking.offers.map((offer: BookingOffer & { referee: Profile | null }) => {
                            // A ref-initiated "I'm Available" offer = status sent + no price set yet
                            const isRefInitiated = offer.status === 'sent' && !offer.price_pence
                            return (
                                <div
                                    key={offer.id}
                                    className={`p-2 rounded-lg ${getStatusCardStyle(offer.status) || 'bg-[var(--neutral-50)]'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-[var(--brand-primary)] flex items-center justify-center text-white text-sm font-semibold">
                                            {offer.referee?.full_name?.charAt(0) || '?'}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium">{offer.referee?.full_name || 'Unknown'}</p>
                                            {offer.status === 'accepted_priced' && offer.price_pence && (
                                                <p className="text-xs text-green-600 font-medium">
                                                    Quoted: &pound;{(offer.price_pence / 100).toFixed(2)}
                                                </p>
                                            )}
                                            {isRefInitiated && (
                                                <p className="text-xs text-amber-700 font-medium">
                                                    Tapped &quot;I&apos;m Available&quot; — needs your response
                                                </p>
                                            )}
                                        </div>
                                        <StatusChip status={offer.status} size="sm" />
                                    </div>
                                    {isRefInitiated && (
                                        <CoachInterestActions
                                            offerId={offer.id}
                                            refereeName={offer.referee?.full_name || 'this referee'}
                                            defaultPricePounds={booking.budget_pounds ?? null}
                                        />
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
