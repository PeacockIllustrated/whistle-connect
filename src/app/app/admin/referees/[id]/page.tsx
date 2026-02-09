import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { StatusChip } from '@/components/ui/StatusChip'
import { AdminRefereeActions } from './AdminRefereeActions'

export default async function AdminRefereeDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login')
    }

    // Verify admin role
    const { data: adminProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (adminProfile?.role !== 'admin') {
        redirect('/app')
    }

    // Get referee profile
    const { data: referee, error } = await supabase
        .from('profiles')
        .select(`
      *,
      referee_profile:referee_profiles(*)
    `)
        .eq('id', id)
        .eq('role', 'referee')
        .single()

    if (error || !referee) {
        notFound()
    }

    const refProfile = Array.isArray(referee.referee_profile)
        ? referee.referee_profile[0]
        : referee.referee_profile

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/app/admin/referees" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>
                <h1 className="text-lg font-semibold">Referee Details</h1>
            </div>

            {/* Profile Card */}
            <div className="card p-4 mb-4">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-[var(--brand-primary)] flex items-center justify-center text-white text-2xl font-bold">
                        {referee.full_name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-bold">{referee.full_name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <StatusChip status="referee" size="sm" />
                            {refProfile?.verified && (
                                <StatusChip status="verified" size="sm" />
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-[var(--border-color)]">
                    <div className="flex justify-between">
                        <span className="text-[var(--foreground-muted)]">Postcode</span>
                        <span className="font-medium">{referee.postcode || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[var(--foreground-muted)]">Phone</span>
                        <span className="font-medium">{referee.phone || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[var(--foreground-muted)]">FA Number</span>
                        <span className="font-medium">{refProfile?.fa_id || 'Not provided'}</span>
                    </div>
                    {refProfile?.level && (
                        <div className="flex justify-between">
                            <span className="text-[var(--foreground-muted)]">Level</span>
                            <span className="font-medium">{refProfile.level}</span>
                        </div>
                    )}
                    {refProfile?.county && (
                        <div className="flex justify-between">
                            <span className="text-[var(--foreground-muted)]">County</span>
                            <span className="font-medium">{refProfile.county}</span>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span className="text-[var(--foreground-muted)]">Joined</span>
                        <span className="font-medium">
                            {new Date(referee.created_at).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Admin Actions */}
            <AdminRefereeActions
                refereeId={referee.id}
                refereeProfile={refProfile}
            />
        </div>
    )
}
