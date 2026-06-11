import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { WcShell } from '@/components/world-cup/WcShell'
import { createClient } from '@/lib/supabase/server'
import { CreateSweepstakeForm } from './CreateSweepstakeForm'

export const metadata: Metadata = {
    title: 'New sweepstake | Whistle Connect',
}

export default async function NewSweepstakePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/world-cup/signup?returnTo=/world-cup/sweepstake/new')
    }

    return (
        <WcShell>
            <div className="max-w-lg mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold text-[var(--foreground)]">New sweepstake</h1>
                <p className="mt-1 text-[var(--foreground-muted)]">
                    Name it, add everyone playing, then draw the teams. You can tweak players
                    right up until you draw.
                </p>
                <div className="mt-6">
                    <CreateSweepstakeForm />
                </div>
            </div>
        </WcShell>
    )
}
