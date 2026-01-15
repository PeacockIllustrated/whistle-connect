import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { StatusChip } from '@/components/ui/StatusChip'
import { Card } from '@/components/ui/Card'
import { signOut } from '@/lib/auth/actions'
import { ProfileClient } from './ProfileClient'

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
            <ProfileClient
                user={user}
                profile={profile}
                refereeProfile={refereeProfile}
            />


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
