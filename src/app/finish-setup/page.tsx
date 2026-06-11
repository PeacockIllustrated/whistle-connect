import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FinishSetupForm } from './FinishSetupForm'

/**
 * Deferred-onboarding screen. A generic (World Cup) signup lands here the first
 * time they open the main app — the middleware gate redirects setup_complete=false
 * users from /app/* to here. They choose coach/referee and finish their account.
 */
export default async function FinishSetupPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login?returnTo=/finish-setup')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, setup_complete')
        .eq('id', user.id)
        .maybeSingle()

    // Already done — nothing to finish.
    if (profile?.setup_complete) {
        redirect('/app')
    }

    return (
        <div className="min-h-screen bg-[var(--background)] flex flex-col">
            <header className="bg-[var(--brand-navy)] text-white py-4 px-4">
                <div className="max-w-[var(--content-max-width)] mx-auto flex items-center justify-between">
                    <Link href="/world-cup" className="flex items-center gap-3">
                        <Image src="/assets/logo-main-white.svg" alt="Whistle Connect" width={130} height={45} priority />
                    </Link>
                    <span className="text-sm font-medium text-white/60">Finish setup</span>
                </div>
            </header>

            <main className="flex-1 px-4 py-6 overflow-y-auto">
                <div className="max-w-[var(--content-max-width)] mx-auto w-full">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-[var(--foreground)]">
                            {profile?.full_name ? `Almost there, ${profile.full_name.split(' ')[0]}` : 'Finish setting up your account'}
                        </h1>
                        <p className="text-[var(--foreground-muted)] mt-1">
                            You joined through the World Cup sweepstake. Tell us how you&apos;ll use Whistle Connect
                            to unlock the full app — booking referees or refereeing matches.
                        </p>
                    </div>

                    <FinishSetupForm />
                </div>
            </main>
        </div>
    )
}
