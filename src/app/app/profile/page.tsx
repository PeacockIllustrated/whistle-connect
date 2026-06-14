import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { ProfileClient } from './ProfileClient'
import { getMyAchievements } from '@/lib/achievements'
import { SignOutButton } from '@/components/app/SignOutButton'
import { Clock, ChevronRight, ShieldCheck } from 'lucide-react'
import { NotificationTester } from '@/components/app/NotificationTester'

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

    const achievements = await getMyAchievements()

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto pb-24">
            <ProfileClient
                user={user}
                profile={profile}
                refereeProfile={refereeProfile}
                achievements={achievements}
            />


            {/* Quick Links — only render when there's actually a link to show.
                Coaches match neither branch, so rendering the card for them left
                an empty shadowed sliver under the Danger Zone. The mt-6 gives a
                clear gap between the Danger Zone and the Set Availability link. */}
            {(profile?.role === 'referee' || profile?.role === 'admin') && (
                <Card variant="default" padding="none" className="mt-6 mb-4 overflow-hidden">
                    {profile?.role === 'referee' && (
                        <Link
                            href="/app/availability"
                            className="flex items-center justify-between p-4 border-b border-[var(--border-color)] hover:bg-[var(--neutral-50)] transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-[var(--color-primary)]" />
                                </div>
                                <span className="font-medium">Set Availability</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-[var(--neutral-400)]" />
                        </Link>
                    )}

                    {profile?.role === 'admin' && (
                        <Link
                            href="/app/admin/referees"
                            className="flex items-center justify-between p-4 border-b border-[var(--border-color)] hover:bg-[var(--neutral-50)] transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                                    <ShieldCheck className="w-5 h-5 text-violet-600" />
                                </div>
                                <span className="font-medium">Manage Referees</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-[var(--neutral-400)]" />
                        </Link>
                    )}
                </Card>
            )}

            {/* Notification Test — dev / preview only. Excluded from prod
                bundle so end users don't see a "fire test notification" panel. */}
            {process.env.NODE_ENV !== 'production' && <NotificationTester />}

            {/* Sign Out — mt-8 keeps a clear gap above it for coaches, who
                don't get the Quick Links card (refs/admins) that otherwise
                separates Sign Out from the section above. */}
            <div className="mt-8">
                <SignOutButton />
            </div>

            <p className="mt-6 text-center text-xs text-[var(--foreground-subtle)]">
                Need a hand?{' '}
                <a href="mailto:support@whistleconnect.co.uk" className="hover:underline">
                    support@whistleconnect.co.uk
                </a>
            </p>
        </div>
    )
}
