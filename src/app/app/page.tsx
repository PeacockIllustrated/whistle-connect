import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ActionCard } from '@/components/app/ActionCard'
import { SwipeableBookingList } from '@/components/app/SwipeableBookingList'
import { StatsAccordion } from '@/components/app/StatsAccordion'
import { FAStatusBadge } from '@/components/ui/FAStatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { AdminDashboard } from '@/components/app/AdminDashboard'
import { toLocalDateString } from '@/lib/utils'
import { Plus, Clock, ClipboardList, Siren, Banknote } from 'lucide-react'
import WalletWidget from '@/components/app/WalletWidget'
import type { BookingWithDetails, FAVerificationStatus } from '@/lib/types'
import type { StatItem } from '@/components/app/DashboardStats'

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

    const today = toLocalDateString(new Date())

    // ── Coach data & stats ──────────────────────────────
    let recentBookings: BookingWithDetails[] = []
    let coachStats: StatItem[] = []

    if (isCoach) {
        const [
            { data: bookings },
            { count: refereesInCounty },
            { count: verifiedRefereesInCounty },
            { count: upcomingCount },
            { count: pendingOffersCount },
            { count: unassignedCount },
            { count: completedCount },
        ] = await Promise.all([
            // Recent bookings for list
            supabase
                .from('bookings')
                .select('*, coach:profiles!bookings_coach_id_fkey(*)')
                .eq('coach_id', user.id)
                .order('match_date', { ascending: true })
                .limit(3),
            // Total referees available
            supabase
                .from('referee_profiles')
                .select('*', { count: 'exact', head: true }),
            // FA verified referees
            supabase
                .from('referee_profiles')
                .select('*', { count: 'exact', head: true })
                .eq('fa_verification_status', 'verified'),
            // Upcoming bookings (today or future)
            supabase
                .from('bookings')
                .select('*', { count: 'exact', head: true })
                .eq('coach_id', user.id)
                .gte('match_date', today)
                .in('status', ['pending', 'offered', 'confirmed']),
            // Pending offers (sent, not responded)
            supabase
                .from('booking_offers')
                .select('*, booking:bookings!inner(coach_id)', { count: 'exact', head: true })
                .eq('booking.coach_id', user.id)
                .eq('status', 'sent'),
            // Unassigned bookings (pending/offered, no assignment yet)
            supabase
                .from('bookings')
                .select('*', { count: 'exact', head: true })
                .eq('coach_id', user.id)
                .in('status', ['pending', 'offered'])
                .gte('match_date', today),
            // Completed bookings all time
            supabase
                .from('bookings')
                .select('*', { count: 'exact', head: true })
                .eq('coach_id', user.id)
                .eq('status', 'completed'),
        ])

        recentBookings = bookings || []

        coachStats = [
            { label: 'Referees Available', value: refereesInCounty || 0, color: 'blue' },
            { label: 'FA Verified Refs', value: verifiedRefereesInCounty || 0, color: 'green' },
            { label: 'Upcoming Matches', value: upcomingCount || 0 },
            { label: 'Offers Pending', value: pendingOffersCount || 0, color: pendingOffersCount ? 'amber' : 'default' },
            { label: 'Needing a Referee', value: unassignedCount || 0, color: unassignedCount ? 'red' : 'default' },
            { label: 'Completed Bookings', value: completedCount || 0, color: 'green' },
        ]
    }

    // ── Referee data & stats ────────────────────────────
    let refereeProfile: { verified: boolean; fa_verification_status: FAVerificationStatus; county: string | null } | null = null
    let refereeStats: StatItem[] = []

    if (isReferee) {
        const [
            { data: refData },
            { count: upcomingAssignments },
            { count: pendingOffers },
            { count: completedMatches },
            { count: activeCoaches },
        ] = await Promise.all([
            // Referee profile
            supabase
                .from('referee_profiles')
                .select('verified, fa_verification_status, county')
                .eq('profile_id', user.id)
                .single(),
            // Upcoming assignments
            supabase
                .from('booking_assignments')
                .select('*, booking:bookings!inner(match_date, status)', { count: 'exact', head: true })
                .eq('referee_id', user.id)
                .gte('booking.match_date', today)
                .in('booking.status', ['confirmed']),
            // Pending offers to review
            supabase
                .from('booking_offers')
                .select('*', { count: 'exact', head: true })
                .eq('referee_id', user.id)
                .eq('status', 'sent'),
            // Completed matches
            supabase
                .from('booking_assignments')
                .select('*, booking:bookings!inner(status)', { count: 'exact', head: true })
                .eq('referee_id', user.id)
                .eq('booking.status', 'completed'),
            // Active coaches
            supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'coach'),
        ])

        refereeProfile = refData

        refereeStats = [
            { label: 'Upcoming Assignments', value: upcomingAssignments || 0, color: 'blue' },
            { label: 'Offers to Review', value: pendingOffers || 0, color: pendingOffers ? 'amber' : 'default' },
            { label: 'Matches Completed', value: completedMatches || 0, color: 'green' },
            { label: 'Active Coaches', value: activeCoaches || 0 },
        ]
    }

    // ── Admin stats ─────────────────────────────────────
    let adminStats: StatItem[] = []
    let adminCoachStats: StatItem[] = []
    let adminRefereeStats: StatItem[] = []
    let adminRecentBookings: BookingWithDetails[] = []
    let adminRefereeProfile: { verified: boolean; fa_verification_status: FAVerificationStatus; county: string | null } | null = null

    if (isAdmin) {
        const [
            { count: totalReferees },
            { count: totalCoaches },
            { count: pendingVerifications },
            { count: unverifiedReferees },
            { count: bookingsThisMonth },
            { count: pendingFAQueue },
            { count: totalUsers },
            { count: totalBookings },
            { count: activeBookings },
            { count: completedBookingsAll },
            { count: totalMessages },
            { count: sosBookings },
            // Coach preview data
            { data: adminBookings },
            { count: adminRefereesAvailable },
            { count: adminVerifiedRefs },
            { count: adminUpcoming },
            { count: adminPendingOffers },
            { count: adminUnassigned },
            { count: adminCompleted },
            // Referee preview data
            { data: adminRefProfile },
            { count: adminUpcomingAssignments },
            { count: adminRefPendingOffers },
            { count: adminRefCompletedMatches },
            { count: adminActiveCoaches },
        ] = await Promise.all([
            // Existing admin stats
            supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'referee'),
            supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'coach'),
            supabase.from('referee_profiles').select('*', { count: 'exact', head: true }).eq('fa_verification_status', 'pending'),
            supabase.from('referee_profiles').select('*', { count: 'exact', head: true }).eq('verified', false),
            supabase.from('bookings').select('*', { count: 'exact', head: true }).gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
            supabase.from('fa_verification_requests').select('*', { count: 'exact', head: true }).eq('status', 'awaiting_fa_response'),
            // New admin stats
            supabase.from('profiles').select('*', { count: 'exact', head: true }),
            supabase.from('bookings').select('*', { count: 'exact', head: true }).is('deleted_at', null),
            supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'confirmed').gte('match_date', today),
            supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
            supabase.from('messages').select('*', { count: 'exact', head: true }),
            supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('is_sos', true),
            // Coach preview: recent bookings
            supabase.from('bookings').select('*, coach:profiles!bookings_coach_id_fkey(*)').is('deleted_at', null).order('match_date', { ascending: true }).limit(3),
            // Coach preview stats
            supabase.from('referee_profiles').select('*', { count: 'exact', head: true }),
            supabase.from('referee_profiles').select('*', { count: 'exact', head: true }).eq('fa_verification_status', 'verified'),
            supabase.from('bookings').select('*', { count: 'exact', head: true }).gte('match_date', today).in('status', ['pending', 'offered', 'confirmed']),
            supabase.from('booking_offers').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
            supabase.from('bookings').select('*', { count: 'exact', head: true }).in('status', ['pending', 'offered']).gte('match_date', today),
            supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
            // Referee preview data
            supabase.from('referee_profiles').select('verified, fa_verification_status, county').limit(1).maybeSingle(),
            supabase.from('booking_assignments').select('*, booking:bookings!inner(match_date, status)', { count: 'exact', head: true }).gte('booking.match_date', today).in('booking.status', ['confirmed']),
            supabase.from('booking_offers').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
            supabase.from('booking_assignments').select('*, booking:bookings!inner(status)', { count: 'exact', head: true }).eq('booking.status', 'completed'),
            supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'coach'),
        ])

        adminStats = [
            { label: 'Total Users', value: totalUsers || 0, color: 'blue' },
            { label: 'Total Referees', value: totalReferees || 0, color: 'blue' },
            { label: 'Total Coaches', value: totalCoaches || 0, color: 'blue' },
            { label: 'FA Pending', value: pendingVerifications || 0, color: pendingVerifications ? 'amber' : 'default' },
            { label: 'Unverified Referees', value: unverifiedReferees || 0, color: unverifiedReferees ? 'red' : 'default' },
            { label: 'FA Queue', value: pendingFAQueue || 0, color: pendingFAQueue ? 'amber' : 'default' },
            { label: 'Total Bookings', value: totalBookings || 0 },
            { label: 'Active Bookings', value: activeBookings || 0, color: 'green' },
            { label: 'Completed', value: completedBookingsAll || 0, color: 'green' },
            { label: 'Bookings This Month', value: bookingsThisMonth || 0, color: 'green' },
            { label: 'Total Messages', value: totalMessages || 0 },
            { label: 'SOS Bookings', value: sosBookings || 0, color: sosBookings ? 'red' : 'default' },
        ]

        adminRecentBookings = adminBookings || []

        adminCoachStats = [
            { label: 'Referees Available', value: adminRefereesAvailable || 0, color: 'blue' },
            { label: 'FA Verified Refs', value: adminVerifiedRefs || 0, color: 'green' },
            { label: 'Upcoming Matches', value: adminUpcoming || 0 },
            { label: 'Offers Pending', value: adminPendingOffers || 0, color: adminPendingOffers ? 'amber' : 'default' },
            { label: 'Needing a Referee', value: adminUnassigned || 0, color: adminUnassigned ? 'red' : 'default' },
            { label: 'Completed Bookings', value: adminCompleted || 0, color: 'green' },
        ]

        adminRefereeProfile = adminRefProfile

        adminRefereeStats = [
            { label: 'Upcoming Assignments', value: adminUpcomingAssignments || 0, color: 'blue' },
            { label: 'Offers to Review', value: adminRefPendingOffers || 0, color: adminRefPendingOffers ? 'amber' : 'default' },
            { label: 'Matches Completed', value: adminRefCompletedMatches || 0, color: 'green' },
            { label: 'Active Coaches', value: adminActiveCoaches || 0 },
        ]
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
                    {/* Quick Actions */}
                    <div className="space-y-3 mb-4">
                        <ActionCard
                            href="/app/bookings/new"
                            icon={<Plus className="w-6 h-6" />}
                            title="Book a Referee"
                            subtitle="Create a new booking request"
                            variant="primary"
                        />
                        <ActionCard
                            href="/app/bookings/sos"
                            icon={<Siren className="w-6 h-6" />}
                            title="Referee SOS"
                            subtitle="Emergency broadcast to nearby refs"
                            variant="secondary"
                            badge="URGENT"
                        />
                    </div>

                    <WalletWidget userRole="coach" />

                    {/* Stats Accordion */}
                    <StatsAccordion stats={coachStats} />

                    {/* Recent Bookings */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-semibold text-[var(--foreground)]">Recent Bookings</h2>
                            <Link href="/app/bookings" className="text-sm text-[var(--color-primary)] font-medium">
                                View All
                            </Link>
                        </div>
                        {recentBookings.length > 0 ? (
                            <SwipeableBookingList bookings={recentBookings} />
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
                    {/* Quick Actions */}
                    <div className="space-y-3 mb-4">
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
                            icon={<ClipboardList className="w-6 h-6" />}
                            title="View Offers"
                            subtitle="View and respond to match requests"
                        />

                        <ActionCard
                            href="/app/earnings"
                            icon={<Banknote className="w-6 h-6" />}
                            title="Earnings"
                            subtitle="Track your season earnings and stats"
                        />
                    </div>

                    <WalletWidget userRole="referee" />

                    {/* Stats Accordion */}
                    <StatsAccordion stats={refereeStats}>
                        <div className="flex items-center justify-between py-2 px-1">
                            <span className="text-sm text-[var(--foreground-muted)]">FA Status</span>
                            <FAStatusBadge status={refereeProfile?.fa_verification_status || 'not_provided'} />
                        </div>
                    </StatsAccordion>
                </>
            )}

            {/* Admin View */}
            {isAdmin && (
                <AdminDashboard
                    profileName={profile.full_name || ''}
                    adminStats={adminStats}
                    coachStats={adminCoachStats}
                    refereeStats={adminRefereeStats}
                    recentBookings={adminRecentBookings}
                    refereeProfile={adminRefereeProfile}
                />
            )}
        </div>
    )
}
