import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { StatusChip } from '@/components/ui/StatusChip'
import { formatDate, formatTime, getStatusCardStyle } from '@/lib/utils'
import { RoleAccessDenied } from '@/components/app/RoleAccessDenied'
import { UserRole } from '@/lib/types'
import { Users, CalendarDays, Clock, ChevronRight, Inbox } from 'lucide-react'

interface OfferWithBooking {
    id: string
    status: string
    created_at: string
    booking: {
        id: string
        match_date: string
        kickoff_time: string
        ground_name: string | null
        location_postcode: string
        age_group: string | null
        format: string | null
        competition_type: string | null
        notes: string | null
        home_team: string | null
        away_team: string | null
        coach: { full_name: string }
    }
}

export default async function OffersPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'referee') {
        return (
            <RoleAccessDenied
                requiredRole="referee"
                currentRole={profile?.role as UserRole}
                featureName="Incoming Offers"
                description="This feature is for referees to view and respond to match requests. As a coach, you can send offers from the booking pages."
            />
        )
    }

    // Fetch sent offers for this referee
    const { data: offers, error } = await supabase
        .from('booking_offers')
        .select(`
            *,
            booking:bookings(
                id,
                match_date,
                kickoff_time,
                ground_name,
                location_postcode,
                age_group,
                format,
                competition_type,
                notes,
                home_team,
                away_team,
                coach:profiles(full_name)
            )
        `)
        .eq('referee_id', user.id)
        .eq('status', 'sent')
        .order('created_at', { ascending: false })

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            <header className="mb-8">
                <h1 className="text-2xl font-bold mb-1">Incoming Offers</h1>
                <p className="text-[var(--foreground-muted)]">
                    Review and respond to match requests from coaches.
                </p>
            </header>

            {offers && offers.length > 0 ? (
                <div className="space-y-4">
                    {(offers as OfferWithBooking[]).map((offer) => (
                        <Link
                            key={offer.id}
                            href={`/app/bookings/${offer.booking.id}`}
                            className={`block card p-4 hover:border-[var(--color-primary)] transition-colors group ${getStatusCardStyle(offer.status)}`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-primary)] bg-blue-50 px-2 py-0.5 rounded">
                                            New Request
                                        </span>
                                        <span className="text-xs text-[var(--foreground-muted)]">
                                            Received {formatDate(offer.created_at)}
                                        </span>
                                    </div>
                                    <h2 className="text-lg font-bold group-hover:text-[var(--color-primary)] transition-colors">
                                        {offer.booking.ground_name || offer.booking.location_postcode}
                                    </h2>
                                </div>
                                <StatusChip status="pending" size="sm" />
                            </div>

                            {/* Teams Display */}
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
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-[var(--border-color)]">
                    <div className="w-16 h-16 bg-[var(--neutral-50)] rounded-full flex items-center justify-center mx-auto mb-4">
                        <Inbox className="w-8 h-8 text-[var(--neutral-400)]" />
                    </div>
                    <h3 className="text-lg font-bold mb-1">All caught up!</h3>
                    <p className="text-[var(--foreground-muted)] text-sm">
                        You don&apos;t have any pending match offers at the moment.
                    </p>
                </div>
            )}
        </div>
    )
}
