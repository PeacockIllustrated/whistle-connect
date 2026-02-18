import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ActionCard } from '@/components/app/ActionCard'
import { BookingCardCompact } from '@/components/app/BookingCard'
import { DashboardStats } from '@/components/app/DashboardStats'
import { StatsAccordion } from '@/components/app/StatsAccordion'
import { FAStatusBadge } from '@/components/ui/FAStatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Plus, Clock, ClipboardList, ShieldCheck, CalendarDays, FileCheck } from 'lucide-react'
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

    const today = new Date().toISOString().split('T')[0]

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

    if (isAdmin) {
        const [
            { count: totalReferees },
            { count: totalCoaches },
            { count: pendingVerifications },
            { count: unverifiedReferees },
            { count: bookingsThisMonth },
            { count: pendingFAQueue },
        ] = await Promise.all([
            supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'referee'),
            supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'coach'),
            supabase
                .from('referee_profiles')
                .select('*', { count: 'exact', head: true })
                .eq('fa_verification_status', 'pending'),
            supabase
                .from('referee_profiles')
                .select('*', { count: 'exact', head: true })
                .eq('verified', false),
            supabase
                .from('bookings')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
            supabase
                .from('fa_verification_requests')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'awaiting_fa_response'),
        ])

        adminStats = [
            { label: 'Total Referees', value: totalReferees || 0, color: 'blue' },
            { label: 'Total Coaches', value: totalCoaches || 0, color: 'blue' },
            { label: 'FA Pending Verification', value: pendingVerifications || 0, color: pendingVerifications ? 'amber' : 'default' },
            { label: 'Unverified Referees', value: unverifiedReferees || 0, color: unverifiedReferees ? 'red' : 'default' },
            { label: 'Bookings This Month', value: bookingsThisMonth || 0, color: 'green' },
            { label: 'FA Queue Awaiting', value: pendingFAQueue || 0, color: pendingFAQueue ? 'amber' : 'default' },
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
                    <div className="mb-4">
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
                            icon={
                                <ClipboardList className="w-6 h-6" />
                            }
                            title="View Offers"
                            subtitle="View and respond to match requests"
                        />
                    </div>

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
                <>
                    {/* Stats */}
                    <div className="mb-6">
                        <DashboardStats stats={adminStats} />
                    </div>

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
                            href="/app/admin/verification"
                            icon={
                                <FileCheck className="w-6 h-6" />
                            }
                            title="FA Verification Queue"
                            subtitle="Review pending County FA responses"
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
                </>
            )}
        </div>
    )
}
