import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { StatusChip } from '@/components/ui/StatusChip'
import { FAStatusBadge } from '@/components/ui/FAStatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ChevronLeft, ShieldAlert } from 'lucide-react'
import { getTodayDate, getThirtyDaysAheadDate } from '@/lib/admin/triage-windows'

export default async function AdminRefereesPage({
    searchParams,
}: {
    searchParams: Promise<{ filter?: string }>
}) {
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

    const { filter } = await searchParams
    const dbsExpiringFilter = filter === 'dbs-expiring'

    const todayStr = getTodayDate()
    const thirtyDaysAheadStr = getThirtyDaysAheadDate()

    // Get all referees, optionally filtered to those with DBS expiring in the next 30 days
    let refereesQuery = supabase
        .from('profiles')
        .select(`
      *,
      referee_profile:referee_profiles!inner(*)
    `)
        .eq('role', 'referee')
        .order('created_at', { ascending: false })

    if (dbsExpiringFilter) {
        refereesQuery = refereesQuery
            .gte('referee_profile.dbs_expires_at', todayStr)
            .lte('referee_profile.dbs_expires_at', thirtyDaysAheadStr)
    }

    const { data: referees } = await refereesQuery

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/app" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold">
                        {dbsExpiringFilter ? 'Referees: DBS expiring within 30 days' : 'Manage Referees'}
                    </h1>
                    <p className="text-sm text-[var(--foreground-muted)]">
                        {referees?.length || 0} {dbsExpiringFilter ? 'matching' : 'registered'} referees
                    </p>
                </div>
                {dbsExpiringFilter && (
                    <Link
                        href="/app/admin/referees"
                        className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium text-[var(--foreground-muted)] hover:bg-[var(--neutral-50)]"
                    >
                        Clear filter
                    </Link>
                )}
            </div>

            {dbsExpiringFilter && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                    <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <p>Referees whose DBS check expires in the next 30 days. Reach out to renew before the date passes.</p>
                </div>
            )}

            {/* Referee List */}
            {referees && referees.length > 0 ? (
                <div className="space-y-2">
                    {referees.map((referee) => {
                        const refProfile = Array.isArray(referee.referee_profile)
                            ? referee.referee_profile[0]
                            : referee.referee_profile

                        return (
                            <Link
                                key={referee.id}
                                href={`/app/admin/referees/${referee.id}`}
                                className="card p-4 block hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-[var(--brand-primary)] flex items-center justify-center text-white font-semibold">
                                        {referee.full_name?.charAt(0) || '?'}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold">{referee.full_name}</h3>
                                            {refProfile?.verified && (
                                                <StatusChip status="verified" size="sm" />
                                            )}
                                        </div>
                                        <p className="text-sm text-[var(--foreground-muted)]">
                                            {referee.postcode || 'No postcode'}
                                        </p>
                                    </div>

                                    <div className="text-right">
                                        <FAStatusBadge status={refProfile?.fa_verification_status || 'not_provided'} />
                                    </div>
                                </div>
                            </Link>
                        )
                    })}
                </div>
            ) : (
                <EmptyState
                    title="No referees yet"
                    description="Referees will appear here when they register"
                />
            )}
        </div>
    )
}
