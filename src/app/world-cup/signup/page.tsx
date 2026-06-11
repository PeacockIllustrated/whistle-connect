import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { WcShell } from '@/components/world-cup/WcShell'
import { createClient } from '@/lib/supabase/server'
import { GenericSignupForm } from './GenericSignupForm'

export const metadata: Metadata = { title: 'Join the World Cup sweepstake | Whistle Connect' }

export default async function WorldCupSignupPage({
    searchParams,
}: {
    searchParams: Promise<{ claim?: string; returnTo?: string }>
}) {
    const { claim, returnTo } = await searchParams
    const safeReturn = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
        ? returnTo
        : '/world-cup/sweepstake/new'

    // Already signed in - no need to create another account.
    const { data: { user } } = await (await createClient()).auth.getUser()
    if (user) redirect(safeReturn)

    return (
        <WcShell>
            <div className="max-w-md mx-auto px-4 py-10">
                <h1 className="text-2xl font-bold text-[var(--foreground)]">Create your free account</h1>
                <p className="mt-1 text-[var(--foreground-muted)]">
                    Just the basics to get you into the sweepstake. No need to pick coach or
                    referee now. You can finish that later if you ever want the full app.
                </p>
                <div className="mt-6">
                    <GenericSignupForm claimToken={claim} returnTo={safeReturn} />
                </div>
                <p className="mt-6 text-center text-sm text-[var(--foreground-muted)]">
                    Already have an account?{' '}
                    <Link href={`/auth/login?returnTo=${encodeURIComponent(safeReturn)}`} className="font-medium text-[var(--brand-primary)] hover:underline">
                        Sign in
                    </Link>
                </p>
            </div>
        </WcShell>
    )
}
