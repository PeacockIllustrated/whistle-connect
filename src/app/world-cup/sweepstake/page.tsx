import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus, Shuffle, Users, ArrowRight } from 'lucide-react'
import { WcShell } from '@/components/world-cup/WcShell'
import { createClient } from '@/lib/supabase/server'
import { getMySweepstakes } from '@/lib/world-cup/data'

export const metadata: Metadata = {
    title: 'Your World Cup sweepstakes | Whistle Connect',
}

export default async function SweepstakeHubPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return (
            <WcShell>
                <div className="max-w-md mx-auto px-4 py-12 text-center">
                    <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--wc-red)]/10 text-[var(--wc-red)]">
                        <Shuffle className="h-7 w-7" />
                    </span>
                    <h1 className="wc-display mt-4 text-3xl text-[var(--foreground)]">Run a World Cup sweepstake</h1>
                    <p className="mt-2 text-[var(--foreground-muted)]">
                        Create a free account to set one up. It takes a minute, and there&apos;s no need
                        to be a coach or referee. You can sort that out later.
                    </p>
                    <div className="mt-6 space-y-3">
                        <Link
                            href="/world-cup/signup?returnTo=/world-cup/sweepstake/new"
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--wc-red)] px-6 py-3.5 font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5"
                        >
                            Get started <ArrowRight className="h-5 w-5" />
                        </Link>
                        <Link
                            href="/auth/login?returnTo=/world-cup/sweepstake"
                            className="block text-sm font-medium text-[var(--brand-primary)] hover:underline"
                        >
                            Already have an account? Sign in
                        </Link>
                    </div>
                </div>
            </WcShell>
        )
    }

    const sweepstakes = await getMySweepstakes()

    return (
        <WcShell>
            <div className="max-w-[var(--content-max-width)] mx-auto px-4 py-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="wc-display text-3xl text-[var(--foreground)]">Your sweepstakes</h1>
                    <Link
                        href="/world-cup/sweepstake/new"
                        className="inline-flex items-center gap-2 rounded-xl bg-[var(--wc-red)] px-4 py-2.5 text-sm font-bold text-white shadow transition-transform hover:-translate-y-0.5"
                    >
                        <Plus className="h-4 w-4" /> New sweepstake
                    </Link>
                </div>

                {sweepstakes.length === 0 ? (
                    <div className="mt-8 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-color)] p-10 text-center">
                        <p className="text-[var(--foreground-muted)]">You haven&apos;t created a sweepstake yet.</p>
                        <Link
                            href="/world-cup/sweepstake/new"
                            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--wc-ink)] px-5 py-2.5 text-sm font-bold text-white"
                        >
                            <Plus className="h-4 w-4" /> Create your first one
                        </Link>
                    </div>
                ) : (
                    <ul className="mt-6 space-y-3">
                        {sweepstakes.map((s) => (
                            <li key={s.id}>
                                <Link
                                    href={`/world-cup/sweepstake/${s.id}`}
                                    className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border-color)] bg-white p-4 transition-shadow hover:shadow-md"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate font-semibold text-[var(--foreground)]">{s.name}</p>
                                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--foreground-muted)]">
                                            <Users className="h-3.5 w-3.5" />
                                            {s.status === 'draft' ? 'Not drawn yet' : s.status === 'complete' ? 'Complete' : 'Live'}
                                        </p>
                                    </div>
                                    <ArrowRight className="h-5 w-5 shrink-0 text-[var(--foreground-muted)]" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </WcShell>
    )
}
