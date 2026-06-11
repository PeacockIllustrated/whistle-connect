import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Shuffle, Radio } from 'lucide-react'
import { WcShell } from '@/components/world-cup/WcShell'
import { Leaderboard } from '@/components/world-cup/Leaderboard'
import { createClient } from '@/lib/supabase/server'
import { getSweepstakeByShareId } from '@/lib/world-cup/data'
import { ClaimPanel } from './ClaimPanel'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ shareId: string }> }): Promise<Metadata> {
    const { shareId } = await params
    const detail = await getSweepstakeByShareId(shareId)
    return {
        title: detail ? `${detail.sweepstake.name} — World Cup sweepstake` : 'Sweepstake',
        description: 'Follow this World Cup 2026 sweepstake live leaderboard on Whistle Connect.',
    }
}

export default async function PublicSweepstakePage({ params }: { params: Promise<{ shareId: string }> }) {
    const { shareId } = await params
    const detail = await getSweepstakeByShareId(shareId)
    if (!detail) notFound()

    const { sweepstake, leaderboard } = detail
    const aliveCount = leaderboard.flatMap((r) => r.teams).filter((t) => !t.eliminated).length

    const { data: { user } } = await (await createClient()).auth.getUser()

    const unclaimed = leaderboard
        .filter((r) => !r.entry.claimed_by)
        .map((r) => ({ token: r.entry.claim_token, name: r.entry.participant_name }))

    return (
        <WcShell>
            <div className="max-w-[var(--content-max-width)] mx-auto px-4 py-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            <Radio className="h-3.5 w-3.5" /> Live
                        </span>
                        <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-[var(--foreground)]">{sweepstake.name}</h1>
                        <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                            {leaderboard.length} players · {aliveCount} teams still standing
                        </p>
                    </div>
                    <Link
                        href="/world-cup/sweepstake"
                        className="inline-flex items-center gap-2 rounded-xl bg-[var(--wc-red)] px-4 py-2.5 text-sm font-bold text-white shadow transition-transform hover:-translate-y-0.5"
                    >
                        <Shuffle className="h-4 w-4" /> Run your own
                    </Link>
                </div>

                {leaderboard.length > 0 && (
                    <div className="mt-6">
                        <Leaderboard rows={leaderboard} />
                    </div>
                )}

                {unclaimed.length > 0 && (
                    <div className="mt-8">
                        <ClaimPanel shareId={shareId} entries={unclaimed} isLoggedIn={!!user} />
                    </div>
                )}
            </div>
        </WcShell>
    )
}
