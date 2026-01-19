import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { StatusChip } from '@/components/ui/StatusChip'
import { formatDate, formatTime } from '@/lib/utils'

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
        redirect('/app/bookings')
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
                    {offers.map((offer: any) => (
                        <Link
                            key={offer.id}
                            href={`/app/bookings/${offer.booking.id}`}
                            className="block card p-4 hover:border-[var(--color-primary)] transition-colors group"
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

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="flex items-center gap-2 text-sm">
                                    <svg className="w-4 h-4 text-[var(--foreground-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span className="font-medium">{formatDate(offer.booking.match_date)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <svg className="w-4 h-4 text-[var(--foreground-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
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
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-[var(--border-color)]">
                    <div className="w-16 h-16 bg-[var(--neutral-50)] rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-[var(--neutral-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
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
