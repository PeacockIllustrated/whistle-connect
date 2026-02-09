import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { StatusChip } from '@/components/ui/StatusChip'
import { Button } from '@/components/ui/Button'
import { formatDate, formatTime, getStatusCardStyle } from '@/lib/utils'
import { BookingActions } from './BookingActions'
import { BookingOffer, Profile } from '@/lib/types'

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
        .single()

    if (error || !booking) {
        notFound()
    }

    const isCoach = profile?.role === 'coach' && booking.coach_id === user.id
    const isReferee = profile?.role === 'referee'
    const isAdmin = profile?.role === 'admin'

    // Get user's offer if referee
    const userOffer = isReferee
        ? booking.offers?.find((o: BookingOffer) => o.referee_id === user.id)
        : null

    const assignment = Array.isArray(booking.assignment)
        ? booking.assignment[0]
        : booking.assignment

    const thread = Array.isArray(booking.thread)
        ? booking.thread[0]
        : booking.thread

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/app/bookings" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
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
                            <svg className="w-5 h-5 text-[var(--neutral-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
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
                            <svg className="w-5 h-5 text-[var(--neutral-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
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

                    {/* Budget */}
                    {booking.budget_pounds && (
                        <div className="pt-2">
                            <p className="text-sm text-[var(--foreground-muted)]">
                                Budget: <span className="font-semibold text-[var(--foreground)]">£{booking.budget_pounds}</span>
                            </p>
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

            {/* Coach Info (for referees) */}
            {isReferee && booking.coach && (
                <div className="card p-4 mb-4">
                    <h3 className="text-sm font-semibold text-[var(--foreground-muted)] mb-3">COACH</h3>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--wc-coach-blue)] flex items-center justify-center text-white font-semibold">
                            {booking.coach.full_name.charAt(0)}
                        </div>
                        <div>
                            <p className="font-medium">{booking.coach.full_name}</p>
                            {booking.club && <p className="text-sm text-[var(--foreground-muted)]">{booking.club.name}</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* Assigned Referee (for coaches) */}
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
                    <div className="space-y-2">
                        {booking.offers.map((offer: BookingOffer & { referee: Profile | null }) => (
                            <div
                                key={offer.id}
                                className={`flex items-center gap-3 p-2 rounded-lg ${getStatusCardStyle(offer.status) || 'bg-[var(--neutral-50)]'}`}
                            >
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
                                </div>
                                <StatusChip status={offer.status} size="sm" />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
