import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ActionCard } from '@/components/app/ActionCard'
import { SwipeableBookingList } from '@/components/app/SwipeableBookingList'
import { StatsAccordion } from '@/components/app/StatsAccordion'
import { FAStatusBadge } from '@/components/ui/FAStatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { AdminDashboard } from '@/components/app/AdminDashboard'
import { getAdminOverview, getAdminTriage, type AdminOverview, type AdminTriage } from '@/app/app/admin/actions'
import { toLocalDateString } from '@/lib/utils'
import { Clock, ClipboardList, Siren, Banknote, CalendarDays, MapPin, Trophy } from 'lucide-react'
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

    // ── Admin overview ──────────────────────────────────
    // The redesigned admin dashboard is an analytics + control center. Both
    // aggregators run service-side; we fan them out together.
    let adminOverview: AdminOverview | null = null
    let adminTriage: AdminTriage | null = null

    if (isAdmin) {
        const [overviewResult, triageResult] = await Promise.all([
            getAdminOverview(),
            getAdminTriage(),
        ])
        adminOverview = overviewResult.data ?? null
        adminTriage = triageResult.data ?? null
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
                    {/* Quick Actions — three-card booking chooser mirrors the
                        pre-login /book page so coaches always have a clear path
                        to Central Venue / Tournament without hunting for them. */}
                    <div className="space-y-3 mb-4">
                        <ActionCard
                            href="/app/bookings/new?type=individual"
                            icon={
                                <div className="w-12 h-12 rounded-xl bg-[var(--wc-blue)]/10 flex items-center justify-center text-[var(--wc-blue)]">
                                    <CalendarDays className="w-6 h-6" />
                                </div>
                            }
                            title="Individual Game"
                            subtitle="Book a referee for a single match"
                        />
                        <ActionCard
                            href="/app/bookings/new?type=central"
                            icon={
                                <div className="w-12 h-12 rounded-xl bg-[var(--wc-red)]/10 flex items-center justify-center text-[var(--wc-red)]">
                                    <MapPin className="w-6 h-6" />
                                </div>
                            }
                            title="Central Venue"
                            subtitle="Multiple games at one location"
                        />
                        <ActionCard
                            href="/app/bookings/new?type=tournament"
                            icon={
                                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                                    <Trophy className="w-6 h-6" />
                                </div>
                            }
                            title="Tournament"
                            subtitle="Cover a tournament across multiple matches"
                        />
                        <ActionCard
                            href="/app/bookings/sos"
                            icon={<Siren className="w-6 h-6" />}
                            title="Referee SOS"
                            subtitle="Emergency broadcast to nearby refs"
                            variant="danger"
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

            {/* Admin View — analytics + control center */}
            {isAdmin && adminOverview && (
                <AdminDashboard overview={adminOverview} triage={adminTriage} />
            )}
            {isAdmin && !adminOverview && (
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--background-elevated)] p-6 text-center text-sm text-[var(--foreground-muted)]">
                    Couldn&apos;t load the admin dashboard. Refresh to try again.
                </div>
            )}
        </div>
    )
}
