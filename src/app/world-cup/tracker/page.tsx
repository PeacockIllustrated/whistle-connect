import type { Metadata } from 'next'
import Link from 'next/link'
import { Shuffle } from 'lucide-react'
import { WcShell } from '@/components/world-cup/WcShell'
import { GroupTable } from '@/components/world-cup/GroupTable'
import { Bracket } from '@/components/world-cup/Bracket'
import { getGroups, getMatches, getTeams } from '@/lib/world-cup/data'
import type { WcTeam } from '@/lib/world-cup/types'

export const metadata: Metadata = {
    title: 'World Cup 2026 Tracker — groups, results & bracket | Whistle Connect',
    description: 'Live group standings and the full knockout bracket for the 2026 FIFA World Cup. Free from Whistle Connect.',
}

// Live tournament data — render per request (the page reads auth cookies).
export const dynamic = 'force-dynamic'

export default async function TrackerPage() {
    const [groups, teams, knockout] = await Promise.all([
        getGroups(),
        getTeams(),
        getMatches(),
    ])

    const teamByCode = new Map<string, WcTeam>(teams.map((t) => [t.code, t]))
    const knockoutMatches = knockout.filter((m) => m.stage !== 'group')

    return (
        <WcShell>
            <div className="max-w-[var(--content-max-width)] mx-auto px-4 py-8">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">World Cup 2026 tracker</h1>
                        <p className="mt-1 text-[var(--foreground-muted)]">12 groups, 104 matches, one champion.</p>
                    </div>
                    <Link
                        href="/world-cup/sweepstake"
                        className="inline-flex items-center gap-2 rounded-xl bg-[var(--wc-red)] px-4 py-2.5 text-sm font-bold text-white shadow transition-transform hover:-translate-y-0.5"
                    >
                        <Shuffle className="h-4 w-4" /> Run a sweepstake
                    </Link>
                </div>

                {groups.length === 0 ? (
                    <div className="mt-10 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-color)] p-10 text-center text-[var(--foreground-muted)]">
                        Tournament data is loading. Check back shortly.
                    </div>
                ) : (
                    <>
                        <section className="mt-8">
                            <h2 className="mb-3 text-lg font-bold text-[var(--foreground)]">Group stage</h2>
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
                            <h2 className="mb-3 text-lg font-bold text-[var(--foreground)]">Knockout bracket</h2>
                            <Bracket matches={knockoutMatches} teamByCode={teamByCode} />
                        </section>
                    </>
                )}
            </div>
        </WcShell>
    )
}
