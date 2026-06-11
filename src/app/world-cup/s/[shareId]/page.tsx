import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Shuffle, Radio } from 'lucide-react'
import { WcShell } from '@/components/world-cup/WcShell'
import { Leaderboard } from '@/components/world-cup/Leaderboard'
import { ChampionBanner } from '@/components/world-cup/ChampionBanner'
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
    const champion = leaderboard.flatMap((r) => r.teams).find((t) => t.stage === 'champion') ?? null

    const { data: { user } } = await (await createClient()).auth.getUser()

    const unclaimed = leaderboard
        .filter((r) => !r.entry.claimed_by)
        .map((r) => ({ token: r.entry.claim_token, name: r.entry.participant_name }))

    return (
        <WcShell>
            {/* Promo header band */}
            <section className="relative overflow-hidden bg-[var(--wc-ink)] text-white">
                <div className="absolute inset-0 wc-pitch-grid opacity-50" aria-hidden />
                <div className="absolute inset-0 wc-stripes opacity-30" aria-hidden />
                <div className="relative mx-auto w-full max-w-3xl px-4 py-9">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/30">
                                <Radio className="h-3.5 w-3.5" /> Live
                            </span>
                            <h1 className="wc-display mt-3 text-4xl sm:text-5xl">{sweepstake.name}</h1>
                            <p className="mt-2 text-sm text-white/70">
                                {leaderboard.length} players · {aliveCount} teams still standing
                            </p>
                        </div>
                        <Link
                            href="/world-cup/sweepstake"
                            className="inline-flex items-center gap-2 rounded-xl bg-[var(--wc-red)] px-4 py-2.5 text-sm font-extrabold text-white shadow transition-transform hover:-translate-y-0.5"
                        >
                            <Shuffle className="h-4 w-4" /> Run your own
                        </Link>
                    </div>
                </div>
            </section>

            <div className="mx-auto w-full max-w-3xl px-4 py-8">
                {champion && (
                    <div className="mb-6">
                        <ChampionBanner team={champion} />
                    </div>
                )}

                {leaderboard.length > 0 && <Leaderboard rows={leaderboard} />}

                {unclaimed.length > 0 && (
                    <div className="mt-8">
                        <ClaimPanel shareId={shareId} entries={unclaimed} isLoggedIn={!!user} />
                    </div>
                )}
            </div>
        </WcShell>
    )
}
