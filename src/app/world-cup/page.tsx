import Link from 'next/link'
import type { Metadata } from 'next'
import { Trophy, Users, ChevronRight, Shuffle, BarChart3, Share2 } from 'lucide-react'
import { WcShell } from '@/components/world-cup/WcShell'
import { getChampion } from '@/lib/world-cup/data'

export const metadata: Metadata = {
    title: 'World Cup 2026 Sweepstake & Tracker | Whistle Connect',
    description:
        'Run a free World Cup 2026 sweepstake or follow every group and knockout match. Draw teams to your friends, track a live leaderboard, share with the group — from Whistle Connect.',
}

export default async function WorldCupLandingPage() {
    const champion = await getChampion()

    return (
        <WcShell>
            {/* Hero */}
            <section className="relative overflow-hidden bg-[var(--wc-ink)] text-white">
                <div className="absolute inset-0 opacity-[0.15]" aria-hidden
                    style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #cd1719 0, transparent 40%), radial-gradient(circle at 80% 0%, #44418a 0, transparent 45%)' }} />
                <div className="relative max-w-[var(--content-max-width)] mx-auto px-4 py-12 sm:py-16">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                        <Trophy className="h-3.5 w-3.5" /> Canada · Mexico · USA 2026
                    </span>
                    <h1 className="mt-4 text-3xl sm:text-5xl font-extrabold leading-tight">
                        The World Cup sweepstake,<br className="hidden sm:block" /> done properly.
                    </h1>
                    <p className="mt-4 max-w-xl text-base sm:text-lg text-white/75">
                        Draw the 48 teams out to your mates, track a live leaderboard as the
                        tournament unfolds, and share it with one link. Free, no catch — from
                        Whistle Connect.
                    </p>
                    <div className="mt-7 flex flex-col sm:flex-row gap-3">
                        <Link
                            href="/world-cup/sweepstake"
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--wc-red)] px-6 py-3.5 text-base font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5"
                        >
                            <Shuffle className="h-5 w-5" /> Run a sweepstake
                        </Link>
                        <Link
                            href="/world-cup/tracker"
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-6 py-3.5 text-base font-bold text-white ring-1 ring-white/20 transition-colors hover:bg-white/15"
                        >
                            <BarChart3 className="h-5 w-5" /> Follow the tracker
                        </Link>
                    </div>
                    {champion && (
                        <p className="mt-6 inline-flex items-center gap-2 rounded-lg bg-amber-400/15 px-3 py-2 text-sm font-semibold text-amber-200">
                            <Trophy className="h-4 w-4" /> Champions: {champion.name}
                        </p>
                    )}
                </div>
            </section>

            {/* Two modes */}
            <section className="max-w-[var(--content-max-width)] mx-auto px-4 py-10 grid gap-4 sm:grid-cols-2">
                <Link
                    href="/world-cup/sweepstake"
                    className="group rounded-2xl border border-[var(--border-color)] bg-white p-6 transition-shadow hover:shadow-lg"
                >
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--wc-red)]/10 text-[var(--wc-red)]">
                        <Shuffle className="h-6 w-6" />
                    </span>
                    <h2 className="mt-4 flex items-center gap-1 text-xl font-bold text-[var(--foreground)]">
                        Sweepstake <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </h2>
                    <p className="mt-1 text-[var(--foreground-muted)]">
                        Add your players, hit draw, and the 48 teams are dealt out at random.
                        A live points leaderboard keeps everyone hooked to the final.
                    </p>
                </Link>

                <Link
                    href="/world-cup/tracker"
                    className="group rounded-2xl border border-[var(--border-color)] bg-white p-6 transition-shadow hover:shadow-lg"
                >
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--wc-blue)]/10 text-[var(--wc-blue)]">
                        <BarChart3 className="h-6 w-6" />
                    </span>
                    <h2 className="mt-4 flex items-center gap-1 text-xl font-bold text-[var(--foreground)]">
                        Tracker <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </h2>
                    <p className="mt-1 text-[var(--foreground-muted)]">
                        All 12 groups, every result and the full knockout bracket — no account
                        needed. Just follow the tournament.
                    </p>
                </Link>
            </section>

            {/* How the sweepstake works */}
            <section className="bg-[var(--background-soft)] border-y border-[var(--border-color)]">
                <div className="max-w-[var(--content-max-width)] mx-auto px-4 py-10">
                    <h2 className="text-center text-2xl font-bold text-[var(--foreground)]">How it works</h2>
                    <div className="mt-8 grid gap-6 sm:grid-cols-3">
                        {[
                            { icon: Users, title: 'Add your players', body: 'Name everyone in the office, the family, the team WhatsApp.' },
                            { icon: Shuffle, title: 'Draw the teams', body: 'All 48 nations are dealt out evenly and at random.' },
                            { icon: Share2, title: 'Share the link', body: 'Everyone follows the live leaderboard — no sign-up to watch.' },
                        ].map((s, i) => (
                            <div key={i} className="text-center">
                                <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wc-ink)] text-white">
                                    <s.icon className="h-6 w-6" />
                                </span>
                                <h3 className="mt-3 font-bold text-[var(--foreground)]">{s.title}</h3>
                                <p className="mt-1 text-sm text-[var(--foreground-muted)]">{s.body}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </WcShell>
    )
}
