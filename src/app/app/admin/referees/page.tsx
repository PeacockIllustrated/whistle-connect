import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { StatusChip } from '@/components/ui/StatusChip'
import { EmptyState } from '@/components/ui/EmptyState'

export default async function AdminRefereesPage() {
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

    // Get all referees
    const { data: referees } = await supabase
        .from('profiles')
        .select(`
      *,
      referee_profile:referee_profiles(*)
    `)
        .eq('role', 'referee')
        .order('created_at', { ascending: false })

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/app" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>
                <div>
                    <h1 className="text-lg font-semibold">Manage Referees</h1>
                    <p className="text-sm text-[var(--foreground-muted)]">
                        {referees?.length || 0} registered referees
                    </p>
                </div>
            </div>

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
                                        {refProfile?.fa_id ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                                FA Verified
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                                FA Unverified
                                            </span>
                                        )}
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
