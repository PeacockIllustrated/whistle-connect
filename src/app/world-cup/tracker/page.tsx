import type { Metadata } from 'next'
import Link from 'next/link'
import { Shuffle } from 'lucide-react'
import { WcShell } from '@/components/world-cup/WcShell'
import { GroupTable } from '@/components/world-cup/GroupTable'
import { Bracket } from '@/components/world-cup/Bracket'
import { ChampionBanner } from '@/components/world-cup/ChampionBanner'
import { NationsTicker } from '@/components/world-cup/NationsTicker'
import { getGroups, getMatches, getTeams, getChampion } from '@/lib/world-cup/data'
import type { WcTeam } from '@/lib/world-cup/types'

export const metadata: Metadata = {
    title: 'World Cup 2026 Tracker: groups, results & bracket | Whistle Connect',
    description: 'Live group standings and the full knockout bracket for the 2026 FIFA World Cup. Free from Whistle Connect.',
}

export const dynamic = 'force-dynamic'

export default async function TrackerPage() {
    const [groups, teams, knockout, champion] = await Promise.all([
        getGroups(),
        getTeams(),
        getMatches(),
        getChampion(),
    ])

    const teamByCode = new Map<string, WcTeam>(teams.map((t) => [t.code, t]))
    const knockoutMatches = knockout.filter((m) => m.stage !== 'group')

    return (
        <WcShell>
            {/* Promo header band */}
            <section className="relative overflow-hidden bg-[var(--wc-ink)] text-white">
                <div className="absolute inset-0 wc-pitch-grid opacity-50" aria-hidden />
                <div className="absolute inset-0 wc-stripes opacity-30" aria-hidden />
                <div className="relative mx-auto w-full max-w-4xl px-4 py-9">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">World Cup 2026</p>
                            <h1 className="wc-display mt-1 text-4xl sm:text-5xl">The Tracker</h1>
                            <p className="mt-2 text-sm text-white/70">12 groups · 104 matches · one trophy.</p>
                        </div>
                        <Link
                            href="/world-cup/sweepstake"
                            className="inline-flex items-center gap-2 rounded-xl bg-[var(--wc-red)] px-4 py-2.5 text-sm font-extrabold text-white shadow transition-transform hover:-translate-y-0.5"
                        >
                            <Shuffle className="h-4 w-4" /> Run a sweepstake
                        </Link>
                    </div>
                </div>
                <NationsTicker tone="dark" />
            </section>

            <div className="mx-auto w-full max-w-4xl px-4 py-8">
                {champion && (
                    <div className="mb-8">
                        <ChampionBanner team={champion} />
                    </div>
                )}

                {groups.length === 0 ? (
                    <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-color)] p-10 text-center text-[var(--foreground-muted)]">
                        Tournament data is loading. Check back shortly.
                    </div>
                ) : (
                    <>
                        <section>
                            <h2 className="wc-display mb-4 text-2xl text-[var(--foreground)]">Group stage</h2>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {groups.map((g) => (
                                    <GroupTable key={g.letter} letter={g.letter} teams={g.teams} />
                                ))}
                            </div>
                            <p className="mt-3 flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--wc-green)]" /> Top two qualify automatically; the eight best third-placed teams also advance.
                            </p>
                        </section>

                        <section className="mt-10">
                            <h2 className="wc-display mb-4 text-2xl text-[var(--foreground)]">Knockout bracket</h2>
                            <Bracket matches={knockoutMatches} teamByCode={teamByCode} />
                        </section>
                    </>
                )}
            </div>
        </WcShell>
    )
}
