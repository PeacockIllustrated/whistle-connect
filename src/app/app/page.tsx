import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ActionCard } from '@/components/app/ActionCard'
import { BookingCardCompact } from '@/components/app/BookingCard'
import { StatusChip } from '@/components/ui/StatusChip'
import { EmptyState } from '@/components/ui/EmptyState'
import { CoachAwaitingAction, RefereeAwaitingAction } from '@/components/app/AwaitingAction'

export default async function AppHomePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    // Get user profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    if (!profile) {
        return (
            <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-[var(--foreground)]">
                        Welcome to Whistle Connect
                    </h1>
                    <p className="text-[var(--foreground-muted)] mb-4">
                        It looks like your profile setup is incomplete.
                    </p>
                    <Link
                        href="/auth/login"
                        className="text-[var(--brand-primary)] font-medium hover:underline"
                    >
                        Return to Sign In
                    </Link>
                </div>
            </div>
        )
    }

    const isCoach = profile.role === 'coach'
    const isReferee = profile.role === 'referee'
    const isAdmin = profile.role === 'admin'

    // ── Coach data ──────────────────────────────────────
    let recentBookings: any[] = []
    let coachActionItems: any[] = []

    if (isCoach) {
        // Recent bookings
        const { data } = await supabase
            .from('bookings')
            .select('*, coach:profiles!bookings_coach_id_fkey(*)')
            .eq('coach_id', user.id)
            .order('match_date', { ascending: true })
            .limit(3)
        recentBookings = data || []

        // Offers awaiting coach confirmation (accepted_priced)
        const { data: awaitingOffers } = await supabase
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
            .order('created_at', { ascending: false })

        if (awaitingOffers) {
            coachActionItems = awaitingOffers
                .filter((o: any) => {
                    const booking = Array.isArray(o.booking) ? o.booking[0] : o.booking
                    return booking?.coach_id === user.id
                })
                .map((o: any) => {
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

    // ── Referee data ────────────────────────────────────
    let refereeActionItems: any[] = []
    let refereeProfile = null

    if (isReferee) {
        // Referee profile
        const { data: refData } = await supabase
            .from('referee_profiles')
            .select('*')
            .eq('profile_id', user.id)
            .single()
        refereeProfile = refData

        // Offers awaiting referee response (sent)
        const { data: sentOffers } = await supabase
            .from('booking_offers')
            .select(`
                id,
                status,
                booking:bookings!inner(
                    id, status, match_date, kickoff_time,
                    ground_name, location_postcode, address_text
                )
            `)
            .eq('referee_id', user.id)
            .eq('status', 'sent')
            .order('created_at', { ascending: false })

        if (sentOffers) {
            refereeActionItems = sentOffers.map((o: any) => {
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
            {/* Welcome Section */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-[var(--foreground)]">
                    Hello{profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}!
                </h1>
                <p className="text-[var(--foreground-muted)]">
                    {isCoach && 'Manage your bookings and find referees'}
                    {isReferee && 'View offers and manage your availability'}
                    {isAdmin && 'Manage users and verify referees'}
                </p>
            </div>

            {/* Coach View */}
            {isCoach && (
                <>
                    {/* Awaiting Action — real-time updates */}
                    <CoachAwaitingAction initialItems={coachActionItems} />

                    {/* Quick Actions */}
                    <div className="mb-6">
                        <ActionCard
                            href="/app/bookings/new"
                            icon={
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            }
                            title="Book a Referee"
                            subtitle="Create a new booking request"
                            variant="primary"
                        />
                    </div>

                    {/* Recent Bookings */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-semibold text-[var(--foreground)]">Recent Bookings</h2>
                            <Link href="/app/bookings" className="text-sm text-[var(--color-primary)] font-medium">
                                View All
                            </Link>
                        </div>
                        {recentBookings.length > 0 ? (
                            <div className="space-y-2">
                                {recentBookings.map((booking) => (
                                    <BookingCardCompact key={booking.id} booking={booking} />
                                ))}
                            </div>
                        ) : (
                            <EmptyState
                                title="No bookings yet"
                                description="Create your first booking to get started"
                                action={
                                    <Link
                                        href="/app/bookings/new"
                                        className="text-[var(--color-primary)] font-medium"
                                    >
                                        Create Booking
                                    </Link>
                                }
                            />
                        )}
                    </div>
                </>
            )}

            {/* Referee View */}
            {isReferee && (
                <>
                    {/* Awaiting Action — real-time updates */}
                    <RefereeAwaitingAction initialItems={refereeActionItems} />

                    {/* Verification Status */}
                    <div className="card p-4 mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-semibold">Verification Status</h2>
                            <StatusChip
                                status={refereeProfile?.verified ? 'verified' : 'pending'}
                                size="sm"
                            />
                        </div>
                        <div className="p-3 bg-[var(--neutral-50)] rounded-lg flex items-center justify-between">
                            <p className="text-xs text-[var(--foreground-muted)]">FA Verified</p>
                            <StatusChip
                                status={refereeProfile?.verified ? 'verified' : 'pending'}
                                size="sm"
                            />
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="space-y-3 mb-6">
                        <ActionCard
                            href="/app/availability"
                            icon={
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            }
                            title="Set Availability"
                            subtitle="Update when you can referee"
                            variant="primary"
                        />

                        <ActionCard
                            href="/app/bookings"
                            icon={
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            }
                            title="View Offers"
                            subtitle={`${refereeActionItems.length} pending offers`}
                        />
                    </div>
                </>
            )}

            {/* Admin View */}
            {isAdmin && (
                <div className="space-y-3">
                    <ActionCard
                        href="/app/admin/referees"
                        icon={
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        }
                        title="Manage Referees"
                        subtitle="Verify FA registration and credentials"
                        variant="primary"
                    />

                    <ActionCard
                        href="/app/bookings"
                        icon={
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        }
                        title="All Bookings"
                        subtitle="View and manage all bookings"
                    />
                </div>
            )}
        </div>
    )
}
