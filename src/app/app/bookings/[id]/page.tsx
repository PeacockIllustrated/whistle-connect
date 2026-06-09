import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { StatusChip } from '@/components/ui/StatusChip'
import { formatDate, formatTime, getStatusCardStyle } from '@/lib/utils'
import { BookingActions } from './BookingActions'
import { SOSStatusPanel } from '@/components/app/SOSStatusPanel'
import { CoachOfferRow } from '@/components/app/CoachOfferRow'
import { BookingOffer, Profile } from '@/lib/types'
import { requiresParentalConsent } from '@/lib/constants'
import { ChevronLeft, CalendarDays, MapPin, MessageCircle, Mail } from 'lucide-react'
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

    // Safeguarding: under-16 referees cannot use in-app messaging. The coach
    // contacts the parent/guardian instead, and the under-16 referee sees a
    // note rather than a (blocked) message button.
    // Fail closed: a referee with a null/unknown DOB is treated as under-16.
    // The assigned ref is always a referee, so NULL DOB routes the coach to the
    // parent-email path. viewerIsUnder16 only applies to a referee viewer
    // (coaches are not age-gated).
    const assignedRefDob: string | null = assignment?.referee?.date_of_birth ?? null
    const assignedRefUnder16 = requiresParentalConsent(assignedRefDob)
    const viewerIsUnder16 = isReferee && requiresParentalConsent(profile?.date_of_birth)

    let assignedRefParentEmail: string | null = null
    if (isCoach && assignedRefUnder16 && assignment?.referee_id) {
        const { data: consent } = await supabase
            .from('parental_consents')
            .select('parent_email')
            .eq('referee_id', assignment.referee_id)
            .maybeSingle()
        assignedRefParentEmail = consent?.parent_email ?? null
    }

    // Tournament / central: load the read-only fixture schedule.
    const isMultiMatch = booking.booking_type === 'tournament' || booking.booking_type === 'central'
    let tournamentMatches: {
        id: string
        sort_order: number
        kickoff_time: string
        home_team: string | null
        away_team: string | null
    }[] = []
    if (isMultiMatch) {
        const { data: tm } = await supabase
            .from('tournament_matches')
            .select('id, sort_order, kickoff_time, home_team, away_team')
            .eq('booking_id', booking.id)
            .order('sort_order', { ascending: true })
        tournamentMatches = tm ?? []
    }

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
                    {booking.tournament_name
                        ? booking.tournament_name
                        : booking.home_team && booking.away_team
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

            {/* Tournament / central fixture schedule (read-only) */}
            {isMultiMatch && (
                <div className="card p-4 mb-4">
                    <h3 className="text-sm font-semibold text-[var(--foreground-muted)] mb-3">
                        {booking.tournament_name
                            ? `SCHEDULE — ${booking.tournament_name}`
                            : 'MATCH SCHEDULE'}
                    </h3>
                    {tournamentMatches.length === 0 ? (
                        <p className="text-sm text-[var(--foreground-muted)]">No matches listed.</p>
                    ) : (
                        <ol className="space-y-2">
                            {tournamentMatches.map((m, i) => (
                                <li key={m.id} className="flex items-center gap-3 p-2 rounded-lg bg-[var(--neutral-50)]">
                                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--brand-primary)] text-white text-xs font-bold flex items-center justify-center">
                                        {i + 1}
                                    </span>
                                    <span className="text-sm font-semibold tabular-nums">
                                        {formatTime(m.kickoff_time)}
                                    </span>
                                    <span className="text-sm text-[var(--foreground-muted)] truncate">
                                        {m.home_team || m.away_team
                                            ? `${m.home_team || 'TBC'} vs ${m.away_team || 'TBC'}`
                                            : 'Teams TBC'}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            )}

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
                    {(booking.status === 'confirmed' || booking.status === 'completed') && (
                        viewerIsUnder16 ? (
                            <p className="mt-3 text-xs text-[var(--foreground-muted)] bg-[var(--neutral-50)] rounded-lg p-3">
                                In-app messaging is unavailable for under-16 referees.
                                Important updates about this match are sent to your parent
                                or guardian.
                            </p>
                        ) : thread?.id ? (
                            <Link
                                href={`/app/messages/${thread.id}`}
                                className="mt-3 flex items-center justify-center gap-2 w-full rounded-xl bg-[var(--brand-primary)] text-white font-semibold py-2.5 text-sm hover:opacity-90 transition-opacity"
                            >
                                <MessageCircle className="w-4 h-4" />
                                Message {booking.coach.full_name}
                            </Link>
                        ) : null
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
                    {(booking.status === 'confirmed' || booking.status === 'completed') && (
                        assignedRefUnder16 ? (
                            assignedRefParentEmail ? (
                                <a
                                    href={`mailto:${assignedRefParentEmail}?subject=${encodeURIComponent('Whistle Connect — match update')}`}
                                    className="mt-3 flex items-center justify-center gap-2 w-full rounded-xl bg-[var(--brand-primary)] text-white font-semibold py-2.5 text-sm hover:opacity-90 transition-opacity"
                                >
                                    <Mail className="w-4 h-4" />
                                    Email parent for important updates
                                </a>
                            ) : (
                                <p className="mt-3 text-xs text-[var(--foreground-muted)] bg-[var(--neutral-50)] rounded-lg p-3">
                                    This referee is under 16. In-app messaging is unavailable —
                                    important updates must go via their parent/guardian. No
                                    parent contact email is on file; please contact support.
                                </p>
                            )
                        ) : thread?.id ? (
                            <Link
                                href={`/app/messages/${thread.id}`}
                                className="mt-3 flex items-center justify-center gap-2 w-full rounded-xl bg-[var(--brand-primary)] text-white font-semibold py-2.5 text-sm hover:opacity-90 transition-opacity"
                            >
                                <MessageCircle className="w-4 h-4" />
                                Message {assignment.referee.full_name}
                            </Link>
                        ) : null
                    )}
                </div>
            )}

            {/* SOS broadcast status — replaces the (misleading) OFFERS list for
                SOS bookings. Shows broadcast count + a live countdown to
                sos_expires_at while waiting for a ref to claim. Once an
                assignment exists, the ASSIGNED REFEREE section above takes over. */}
            {isCoach && booking.is_sos && !assignment && (
                <SOSStatusPanel
                    expiresAt={booking.sos_expires_at ?? null}
                    broadcastCount={
                        booking.offers?.filter((o: BookingOffer) => o.status === 'sent').length ?? 0
                    }
                />
            )}

            {/* Actions */}
            <BookingActions
                booking={booking}
                userOffer={userOffer}
                isCoach={isCoach}
                isReferee={isReferee}
                threadId={thread?.id}
            />

            {/* Offers List (for coaches) — always show when offers exist and no
                assignment yet.

                Hidden for SOS bookings: createSOSBooking inserts a status='sent'
                booking_offers row for every broadcast-notified referee (up to 15)
                with no price_pence. Those rows are visually indistinguishable
                from a ref-initiated "I'm Available" offer in this list, so the
                coach was seeing 15 strangers labelled as if they had personally
                tapped accept — misleading. SOS resolution happens atomically via
                claim_sos_booking → assignment, so there's never a meaningful
                OFFERS view for an SOS booking; the Find Referees CTA in
                BookingActions remains as the manual fallback. */}
            {isCoach && booking.offers && (() => {
                // OFFERS list filtering rules:
                //  - Always exclude per-coach archived rows (migration 0151).
                //  - For SOS bookings: only show offers where responded_at IS NOT
                //    NULL. SOS broadcasts pre-insert a passive "you were
                //    notified" row for every nearby ref (status='sent',
                //    responded_at=null). Those would otherwise appear as 15
                //    strangers labelled "ref-initiated" — misleading. Once a
                //    ref taps "Accept SOS Call", expressInterest stamps
                //    responded_at and the row appears here for the coach to
                //    confirm.
                //  - For non-SOS bookings: show all non-archived offers.
                const offers = booking.offers as (BookingOffer & {
                    referee: Profile | null
                    coach_archived_at: string | null
                    responded_at: string | null
                })[]
                const visibleOffers = offers.filter((o) => {
                    if (o.coach_archived_at) return false
                    if (booking.is_sos && !o.responded_at) return false
                    return true
                })
                if (visibleOffers.length === 0 || assignment) return null
                const heading = booking.is_sos ? 'SOS RESPONSES' : 'OFFERS'
                return (
                    <div className="card p-4 mt-4">
                        <h3 className="text-sm font-semibold text-[var(--foreground-muted)] mb-3">
                            {heading} ({visibleOffers.length})
                        </h3>
                        <div className="space-y-3">
                            {visibleOffers.map((offer) => (
                                <CoachOfferRow
                                    key={offer.id}
                                    offer={offer}
                                    bookingFeePounds={booking.budget_pounds ?? null}
                                />
                            ))}
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
