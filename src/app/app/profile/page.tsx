import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { StatusChip } from '@/components/ui/StatusChip'
import { Card } from '@/components/ui/Card'
import { signOut } from '@/lib/auth/actions'
import { ThemePickerSection } from './ThemePickerSection'

export default async function ProfilePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    // Get referee profile if referee
    let refereeProfile = null
    if (profile?.role === 'referee') {
        const { data } = await supabase
            .from('referee_profiles')
            .select('*')
            .eq('profile_id', user.id)
            .single()
        refereeProfile = data
    }

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto pb-24">
            {/* Profile Header */}
            <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-dark)] flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                    {profile?.full_name?.charAt(0) || '?'}
                </div>
                <div className="flex-1">
                    <h1 className="text-xl font-bold">{profile?.full_name}</h1>
                    <p className="text-sm text-[var(--foreground-muted)]">{user.email}</p>
                </div>
                {profile?.role && (
                    <StatusChip status={profile.role} size="md" />
                )}
            </div>

            {/* Profile Info */}
            <Card variant="default" padding="md" className="mb-4">
                <h2 className="text-sm font-semibold text-[var(--foreground-muted)] uppercase tracking-wide mb-4">
                    Account Details
                </h2>
                <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
                        <span className="text-sm text-[var(--foreground-muted)]">Phone</span>
                        <span className="text-sm font-medium">{profile?.phone || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
                        <span className="text-sm text-[var(--foreground-muted)]">Postcode</span>
                        <span className="text-sm font-medium">{profile?.postcode || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-[var(--foreground-muted)]">Member Since</span>
                        <span className="text-sm font-medium">
                            {profile?.created_at
                                ? new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                                : '-'
                            }
                        </span>
                    </div>
                </div>
            </Card>

            {/* Referee Compliance (if referee) */}
            {profile?.role === 'referee' && refereeProfile && (
                <Card variant="default" padding="md" className="mb-4">
                    <h2 className="text-sm font-semibold text-[var(--foreground-muted)] uppercase tracking-wide mb-4">
                        Compliance Status
                    </h2>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
                            <span className="text-sm">DBS Check</span>
                            <StatusChip status={refereeProfile.dbs_status || 'not_provided'} size="sm" />
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
                            <span className="text-sm">Safeguarding</span>
                            <StatusChip status={refereeProfile.safeguarding_status || 'not_provided'} size="sm" />
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
                            <span className="text-sm">FA ID</span>
                            <span className="text-sm font-medium">{refereeProfile.fa_id || 'Not set'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-sm">Level</span>
                            <span className="text-sm font-medium">{refereeProfile.level || 'Not set'}</span>
                        </div>
                    </div>
                </Card>
            )}

            {/* Theme Settings */}
            <Card variant="default" padding="md" className="mb-4">
                <h2 className="text-sm font-semibold text-[var(--foreground-muted)] uppercase tracking-wide mb-4">
                    Appearance
                </h2>
                <ThemePickerSection />
            </Card>

            {/* Quick Links */}
            <Card variant="default" padding="none" className="mb-4 overflow-hidden">
                {profile?.role === 'referee' && (
                    <Link
                        href="/app/availability"
                        className="flex items-center justify-between p-4 border-b border-[var(--border-color)] hover:bg-[var(--neutral-50)] transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
                                <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <span className="font-medium">Set Availability</span>
                        </div>
                        <svg className="w-5 h-5 text-[var(--neutral-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                )}

                {profile?.role === 'admin' && (
                    <Link
                        href="/app/admin/referees"
                        className="flex items-center justify-between p-4 border-b border-[var(--border-color)] hover:bg-[var(--neutral-50)] transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                                <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <span className="font-medium">Manage Referees</span>
                        </div>
                        <svg className="w-5 h-5 text-[var(--neutral-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                )}

                <Link
                    href="/app/components"
                    className="flex items-center justify-between p-4 hover:bg-[var(--neutral-50)] transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--neutral-100)] flex items-center justify-center">
                            <svg className="w-5 h-5 text-[var(--neutral-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                            </svg>
                        </div>
                        <span className="font-medium">Component Library</span>
                    </div>
                    <svg className="w-5 h-5 text-[var(--neutral-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </Link>
            </Card>

            {/* Sign Out */}
            <form action={signOut}>
                <button
                    type="submit"
                    className="w-full p-4 rounded-2xl border-2 border-red-200 text-red-600 font-semibold text-center hover:bg-red-50 transition-colors"
                >
                    Sign Out
                </button>
            </form>
        </div>
    )
}
