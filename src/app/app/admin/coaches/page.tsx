import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/EmptyState'
import { ChevronLeft } from 'lucide-react'

export default async function AdminCoachesPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login')
    }

    // Verify admin role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        redirect('/app')
    }

    // Get all coaches with booking count
    const { data: coaches } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'coach')
        .order('created_at', { ascending: false })

    // Get booking counts per coach
    const coachIds = (coaches || []).map(c => c.id)
    const { data: bookingCounts } = coachIds.length > 0
        ? await supabase
            .from('bookings')
            .select('coach_id')
            .in('coach_id', coachIds)
            .is('deleted_at', null)
        : { data: [] }

    const countMap = new Map<string, number>()
    for (const b of bookingCounts || []) {
        countMap.set(b.coach_id, (countMap.get(b.coach_id) || 0) + 1)
    }

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/app" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-lg font-semibold">Manage Coaches</h1>
                    <p className="text-sm text-[var(--foreground-muted)]">
                        {coaches?.length || 0} registered coaches
                    </p>
                </div>
            </div>

            {/* Coach List */}
            {coaches && coaches.length > 0 ? (
                <div className="space-y-2">
                    {coaches.map((coach) => {
                        const bookingCount = countMap.get(coach.id) || 0

                        return (
                            <div
                                key={coach.id}
                                className="card p-4 block"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-[var(--brand-primary)] flex items-center justify-center text-white font-semibold">
                                        {coach.full_name?.charAt(0) || '?'}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold">{coach.full_name}</h3>
                                        {coach.club_name && (
                                            <p className="text-sm text-[var(--foreground-muted)]">
                                                {coach.club_name}
                                            </p>
                                        )}
                                        <p className="text-sm text-[var(--foreground-muted)]">
                                            {coach.postcode || 'No postcode'}
                                        </p>
                                    </div>

                                    <div className="text-right">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--neutral-100)] text-[var(--foreground-muted)]">
                                            {bookingCount} booking{bookingCount !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <EmptyState
                    title="No coaches yet"
                    description="Coaches will appear here when they register"
                />
            )}
        </div>
    )
}
