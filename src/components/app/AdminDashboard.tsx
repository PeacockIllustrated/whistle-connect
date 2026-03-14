'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DashboardStats } from '@/components/app/DashboardStats'
import { StatsAccordion } from '@/components/app/StatsAccordion'
import { ActionCard } from '@/components/app/ActionCard'
import { BookingCardCompact } from '@/components/app/BookingCard'
import { FAStatusBadge } from '@/components/ui/FAStatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import type { StatItem } from '@/components/app/DashboardStats'
import type { BookingWithDetails, FAVerificationStatus } from '@/lib/types'
import {
    ShieldCheck, FileCheck, CalendarDays, Plus, Clock,
    ClipboardList, Siren, Banknote, Eye, Monitor, Users
} from 'lucide-react'

type ViewMode = 'admin' | 'coach' | 'referee'

interface AdminDashboardProps {
    profileName: string
    adminStats: StatItem[]
    coachStats: StatItem[]
    refereeStats: StatItem[]
    recentBookings: BookingWithDetails[]
    refereeProfile: {
        verified: boolean
        fa_verification_status: FAVerificationStatus
        county: string | null
    } | null
}

export function AdminDashboard({
    profileName,
    adminStats,
    coachStats,
    refereeStats,
    recentBookings,
    refereeProfile,
}: AdminDashboardProps) {
    const [activeView, setActiveView] = useState<ViewMode>('admin')

    const views: { value: ViewMode; label: string; icon: typeof Monitor }[] = [
        { value: 'admin', label: 'Admin', icon: Monitor },
        { value: 'coach', label: 'Coach Preview', icon: Eye },
        { value: 'referee', label: 'Referee Preview', icon: Eye },
    ]

    return (
        <>
            {/* View Toggle */}
            <div className="mb-6">
                <div className="flex rounded-xl bg-[var(--neutral-100)] p-1 gap-1">
                    {views.map((view) => {
                        const Icon = view.icon
                        return (
                            <button
                                key={view.value}
                                onClick={() => setActiveView(view.value)}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                    activeView === view.value
                                        ? 'bg-white text-[var(--foreground)] shadow-sm'
                                        : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span className="hidden sm:inline">{view.label}</span>
                                <span className="sm:hidden">
                                    {view.value === 'admin' ? 'Admin' : view.value === 'coach' ? 'Coach' : 'Referee'}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Preview Banner */}
            {activeView !== 'admin' && (
                <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
                    <Eye className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <p className="text-sm text-amber-700 font-medium">
                        Viewing {activeView === 'coach' ? 'Coach' : 'Referee'} dashboard preview
                    </p>
                </div>
            )}

            {/* Admin View */}
            {activeView === 'admin' && (
                <>
                    <div className="mb-6">
                        <DashboardStats stats={adminStats} />
                    </div>

                    <div className="space-y-3">
                        <ActionCard
                            href="/app/admin/referees"
                            icon={<ShieldCheck className="w-6 h-6" />}
                            title="Manage Referees"
                            subtitle="Verify FA registration and credentials"
                            variant="primary"
                        />
                        <ActionCard
                            href="/app/admin/coaches"
                            icon={<Users className="w-6 h-6" />}
                            title="Manage Coaches"
                            subtitle="View registered coaches and their bookings"
                        />
                        <ActionCard
                            href="/app/admin/verification"
                            icon={<FileCheck className="w-6 h-6" />}
                            title="FA Verification Queue"
                            subtitle="Review pending County FA responses"
                        />
                        <ActionCard
                            href="/app/bookings"
                            icon={<CalendarDays className="w-6 h-6" />}
                            title="All Bookings"
                            subtitle="View and manage all bookings"
                        />
                    </div>
                </>
            )}

            {/* Coach Preview */}
            {activeView === 'coach' && (
                <>
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

                    <StatsAccordion stats={coachStats} />

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

            {/* Referee Preview */}
            {activeView === 'referee' && (
                <>
                    <div className="space-y-3 mb-4">
                        <ActionCard
                            href="/app/availability"
                            icon={<Clock className="w-6 h-6" />}
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

                    <StatsAccordion stats={refereeStats}>
                        <div className="flex items-center justify-between py-2 px-1">
                            <span className="text-sm text-[var(--foreground-muted)]">FA Status</span>
                            <FAStatusBadge status={refereeProfile?.fa_verification_status || 'not_provided'} />
                        </div>
                    </StatsAccordion>
                </>
            )}
        </>
    )
}
