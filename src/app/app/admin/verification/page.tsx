import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/EmptyState'
import { ChevronLeft } from 'lucide-react'
import { VerificationRequestList } from './VerificationRequestList'

export default async function AdminVerificationPage() {
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

    // Get all verification requests with referee details
    const { data: requests } = await supabase
        .from('fa_verification_requests')
        .select(`
            *,
            referee:profiles!fa_verification_requests_referee_id_fkey(id, full_name, avatar_url)
        `)
        .order('requested_at', { ascending: false })

    const openRequests = (requests || []).filter(r => r.status === 'awaiting_fa_response')
    const resolvedRequests = (requests || []).filter(r => r.status !== 'awaiting_fa_response')

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/app" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-lg font-semibold">FA Verification Queue</h1>
                    <p className="text-sm text-[var(--foreground-muted)]">
                        {openRequests.length} awaiting response
                    </p>
                </div>
            </div>

            {openRequests.length > 0 ? (
                <div className="space-y-4">
                    <h2 className="text-sm font-semibold text-[var(--foreground-muted)] uppercase tracking-wide">
                        Awaiting County FA Response
                    </h2>
                    <VerificationRequestList requests={openRequests} />
                </div>
            ) : (
                <EmptyState
                    title="No pending verifications"
                    description="All FA verification requests have been resolved"
                />
            )}

            {resolvedRequests.length > 0 && (
                <div className="mt-8 space-y-4">
                    <h2 className="text-sm font-semibold text-[var(--foreground-muted)] uppercase tracking-wide">
                        Resolved
                    </h2>
                    <div className="space-y-2">
                        {resolvedRequests.map(req => {
                            const referee = Array.isArray(req.referee) ? req.referee[0] : req.referee
                            return (
                                <div key={req.id} className="card p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Link
                                                href={`/app/admin/referees/${referee?.id}`}
                                                className="text-sm font-semibold hover:underline"
                                            >
                                                {referee?.full_name || 'Unknown'}
                                            </Link>
                                            <p className="text-xs text-[var(--foreground-muted)]">
                                                FAN: {req.fa_id} — {req.county} FA
                                            </p>
                                            <p className="text-xs text-[var(--foreground-muted)]">
                                                {new Date(req.requested_at).toLocaleDateString('en-GB')}
                                                {req.resolved_at && ` → ${new Date(req.resolved_at).toLocaleDateString('en-GB')}`}
                                            </p>
                                            {req.notes && (
                                                <p className="text-xs italic text-[var(--foreground-muted)] mt-1">{req.notes}</p>
                                            )}
                                        </div>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                                            req.status === 'confirmed'
                                                ? 'text-green-700 bg-green-50 border-green-200'
                                                : 'text-red-600 bg-red-50 border-red-200'
                                        }`}>
                                            {req.status === 'confirmed' ? 'Confirmed' : 'Rejected'}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
