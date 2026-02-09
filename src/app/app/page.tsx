import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ActionCard } from '@/components/app/ActionCard'
import { BookingCardCompact } from '@/components/app/BookingCard'
import { StatusChip } from '@/components/ui/StatusChip'
import { EmptyState } from '@/components/ui/EmptyState'
import { CoachAwaitingAction, RefereeAwaitingAction } from '@/components/app/AwaitingAction'
import { Plus, Clock, ClipboardList, ShieldCheck, CalendarDays } from 'lucide-react'

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
                                <Plus className="w-6 h-6" />
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
                                <Clock className="w-6 h-6" />
                            }
                            title="Set Availability"
                            subtitle="Update when you can referee"
                            variant="primary"
                        />

                        <ActionCard
                            href="/app/bookings"
                            icon={
                                <ClipboardList className="w-6 h-6" />
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
                            <ShieldCheck className="w-6 h-6" />
                        }
                        title="Manage Referees"
                        subtitle="Verify FA registration and credentials"
                        variant="primary"
                    />

                    <ActionCard
                        href="/app/bookings"
                        icon={
                            <CalendarDays className="w-6 h-6" />
                        }
                        title="All Bookings"
                        subtitle="View and manage all bookings"
                    />
                </div>
            )}
        </div>
    )
}
